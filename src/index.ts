import { Worker } from 'worker_threads';
import { EventEmitter, once } from 'events';
import { AsyncResource } from 'async_hooks';
import { cpus } from 'os';
import { resolve } from 'path';
import { inspect } from 'util';
import assert from 'assert';
import { RequestMessage, ResponseMessage, commonState } from './common';
import { version } from '../package.json';

const cpuCount : number = (() => {
  try {
    return cpus().length;
  } catch {
    /* istanbul ignore next */
    return 1;
  }
})();

interface Options {
  // Probably also support URL here
  fileName? : string | null,
  minThreads? : number,
  maxThreads? : number,
  idleTimeout? : number,
  maxQueue? : number,
  concurrentTasksPerWorker? : number
}

interface FilledOptions extends Options {
  fileName : string | null,
  minThreads : number,
  maxThreads : number,
  idleTimeout : number,
  maxQueue : number,
  concurrentTasksPerWorker : number
}

const kDefaultOptions : FilledOptions = {
  fileName: null,
  minThreads: Math.max(cpuCount / 2, 1),
  maxThreads: cpuCount * 1.5,
  idleTimeout: 0,
  maxQueue: Infinity,
  concurrentTasksPerWorker: 1
};

let taskIdCounter = 0;

type TaskCallback = (err : Error, result: any) => void;

class TaskInfo extends AsyncResource {
  callback : TaskCallback;
  task : any;
  fileName : string;
  taskId : number;

  constructor (task : any, fileName : string, callback : TaskCallback) {
    super('Piscina.TaskInfo', { requireManualDestroy: false });
    this.callback = callback;
    this.task = task;
    this.fileName = fileName;
    this.taskId = taskIdCounter++;
  }

  releaseTask () : any {
    const ret = this.task;
    this.task = null;
    return ret;
  }

  done (err : Error | null, result? : any) : void {
    this.runInAsyncScope(this.callback, null, err, result);
    this.emitDestroy(); // `TaskInfo`s are used only once.
  }
}

class WorkerInfo {
  worker : Worker;
  taskInfos : Map<number, TaskInfo>;
  idleTimeout : NodeJS.Timeout | null = null;

  constructor (worker : Worker) {
    this.worker = worker;
    this.taskInfos = new Map();
  }

  destroy () : void {
    this.worker.terminate();
    this.clearIdleTimeout();
    for (const taskInfo of this.taskInfos.values()) {
      taskInfo.done(new Error('Terminating worker thread'));
    }
    this.taskInfos.clear();
  }

  clearIdleTimeout () : void {
    if (this.idleTimeout !== null) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }
  }
}

class ThreadPool {
  publicInterface : Piscina;
  workers : WorkerInfo[];
  options : FilledOptions;
  taskQueue : TaskInfo[]; // Maybe turn this into a priority queue?

  constructor (publicInterface : Piscina, options : Options) {
    this.publicInterface = publicInterface;
    this.workers = [];
    this.taskQueue = [];

    this.options = { ...kDefaultOptions, ...options };
    if (options.maxThreads !== undefined &&
        this.options.minThreads > options.maxThreads) {
      this.options.minThreads = options.maxThreads;
    }
    if (options.minThreads !== undefined &&
        this.options.maxThreads < options.minThreads) {
      this.options.maxThreads = options.minThreads;
    }

    this._ensureMinimumWorkers();
  }

  _ensureMinimumWorkers () : void {
    while (this.workers.length < this.options.minThreads) {
      this._addNewWorker(true);
    }
  }

  _addNewWorker (needsWarmup : boolean) : WorkerInfo {
    const worker = new Worker(resolve(__dirname, 'worker.js'));

    const workerInfo = new WorkerInfo(worker);
    worker.on('message', (message : ResponseMessage) => {
      const { taskId, result } = message;
      // In case of success: Call the callback that was passed to `runTask`,
      // remove the `TaskInfo` associated with the Worker, which marks it as
      // free again.
      const taskInfo = workerInfo.taskInfos.get(taskId);
      workerInfo.taskInfos.delete(taskId);

      this._onWorkerFree(workerInfo);

      /* istanbul ignore if */
      if (taskInfo === undefined) {
        const err = new Error(
          `Unexpected message from Worker: ${inspect(message)}`);
        this.publicInterface.emit('error', err);
      } else {
        taskInfo.done(message.error, result);
      }
    });

    worker.on('error', (err : Error) => {
      // In case of an uncaught exception: Call the callback that was passed to
      // `postTask` with the error, or emit an 'error' event if there is none.
      const taskInfos = [...workerInfo.taskInfos.values()];
      workerInfo.taskInfos.clear();

      // Remove the worker from the list and potentially start a new Worker to
      // replace the current one.
      this._removeWorker(workerInfo);
      this._ensureMinimumWorkers();

      if (taskInfos.length > 0) {
        for (const taskInfo of taskInfos) {
          taskInfo.done(err, null);
        }
      } else {
        this.publicInterface.emit('error', err);
      }
    });

    if (needsWarmup && this.options.fileName !== null) {
      worker.postMessage({ fileName: this.options.fileName, warmup: true });
    }

    worker.unref();

    this.workers.push(workerInfo);
    return workerInfo;
  }

  _removeWorker (workerInfo : WorkerInfo) : void {
    workerInfo.destroy();

    this.workers.splice(this.workers.indexOf(workerInfo), 1);
  }

  _onWorkerFree (workerInfo : WorkerInfo) : void {
    workerInfo.worker.unref();

    if (this.taskQueue.length > 0) {
      this._postTask(this.taskQueue.shift() as TaskInfo, workerInfo);
      return;
    }

    if (workerInfo.taskInfos.size === 0 &&
        this.workers.length > this.options.minThreads) {
      workerInfo.idleTimeout = setTimeout(() => {
        assert.strictEqual(workerInfo.taskInfos.size, 0);
        if (this.workers.length > this.options.minThreads) {
          this._removeWorker(workerInfo);
        }
      }, this.options.idleTimeout).unref();
    }
  }

  _postTask (taskInfo : TaskInfo, workerInfo : WorkerInfo) {
    assert(!workerInfo.taskInfos.has(taskInfo.taskId));
    workerInfo.taskInfos.set(taskInfo.taskId, taskInfo);
    const message : RequestMessage = {
      warmup: false,
      task: taskInfo.releaseTask(),
      taskId: taskInfo.taskId,
      fileName: taskInfo.fileName
    };
    workerInfo.worker.ref();
    workerInfo.worker.postMessage(message);
    workerInfo.clearIdleTimeout();
  }

  // Implement some kind of task cancellation mechanism?
  runTask (task : any, fileName : string | null) : Promise<any> {
    if (fileName === null) {
      fileName = this.options.fileName;
    }
    if (fileName === null) {
      return Promise.reject(new Error(
        'fileName must be provided to postTask() or in options object'));
    }

    let resolve : (result : any) => void;
    let reject : (err : Error) => void;
    // eslint-disable-next-line
    const ret = new Promise((res, rej) => { resolve = res; reject = rej; });
    const taskInfo = new TaskInfo(
      task, fileName, (err : Error | null, result : any) => {
        if (err !== null) {
          reject(err);
        } else {
          resolve(result);
        }
      });

    // If there is a task queue, there's no point in looking for an available
    // Worker thread. Add this task to the queue, if possible.
    if (this.taskQueue.length > 0) {
      if (this.taskQueue.length >= this.options.maxQueue) {
        return Promise.reject(new Error('Task queue is at limit'));
      } else {
        this.taskQueue.push(taskInfo);
      }

      return ret;
    }

    // Look for a Worker with a minimum number of tasks it is currently running.
    let workerInfo : WorkerInfo | null = null;
    let minimumCurrentTasks = Infinity;
    for (const candidate of this.workers) {
      if (candidate.taskInfos.size < minimumCurrentTasks) {
        workerInfo = candidate;
        minimumCurrentTasks = candidate.taskInfos.size;
        if (minimumCurrentTasks === 0) break;
      }
    }

    // If all Workers are at maximum usage, do not use any of them.
    if (minimumCurrentTasks >= this.options.concurrentTasksPerWorker) {
      workerInfo = null;
    }

    // If no Worker was found, or that Worker was handling another task in some
    // way, and we still have the ability to spawn new threads, do so.
    if ((workerInfo === null || minimumCurrentTasks > 0) &&
        this.workers.length < this.options.maxThreads) {
      // This doesn't account for Worker startup time yet. If another Worker
      // becomes available beefore the new one is up, we should use that.
      workerInfo = this._addNewWorker(false);
    }

    // If no Worker is found, try to put the task into the queue.
    if (workerInfo === null) {
      if (this.options.maxQueue <= 0) {
        return Promise.reject(
          new Error('No task queue available and all Workers are busy'));
      } else {
        this.taskQueue.push(taskInfo);
      }

      return ret;
    }

    this._postTask(taskInfo, workerInfo);
    return ret;
  }

  async destroy () {
    while (this.taskQueue.length > 0) {
      const taskInfo : TaskInfo = this.taskQueue.shift() as TaskInfo;
      taskInfo.done(new Error('Terminating worker thread'));
    }

    const exitEvents : Promise<any[]>[] = [];
    while (this.workers.length > 0) {
      exitEvents.push(once(this.workers[0].worker, 'exit'));
      this._removeWorker(this.workers[0]);
    }

    await Promise.all(exitEvents);
  }
}

class Piscina extends EventEmitter {
  #pool : ThreadPool;

  constructor (options : Options = {}) {
    super(options as any);

    if (typeof options.fileName !== 'string' && options.fileName != null) {
      throw new TypeError('options.fileName must be a string or null');
    }
    if (options.minThreads !== undefined &&
        (typeof options.minThreads !== 'number' || options.minThreads < 0)) {
      throw new TypeError('options.minThreads must be a non-negative integer');
    }
    if (options.maxThreads !== undefined &&
        (typeof options.maxThreads !== 'number' || options.maxThreads < 1)) {
      throw new TypeError('options.maxThreads must be a positive integer');
    }
    if (options.minThreads !== undefined && options.maxThreads !== undefined &&
        options.minThreads > options.maxThreads) {
      throw new RangeError('options.minThreads and options.maxThreads must not conflict');
    }
    if (options.idleTimeout !== undefined &&
        (typeof options.idleTimeout !== 'number' || options.idleTimeout < 0)) {
      throw new TypeError('options.idleTimeout must be a non-negative integer');
    }
    if (options.maxQueue !== undefined &&
        (typeof options.maxQueue !== 'number' || options.maxQueue < 0)) {
      throw new TypeError('options.maxQueue must be a non-negative integer');
    }
    if (options.concurrentTasksPerWorker !== undefined &&
        (typeof options.concurrentTasksPerWorker !== 'number' ||
         options.concurrentTasksPerWorker < 1)) {
      throw new TypeError(
        'options.concurrentTasksPerWorker must be a positive integer');
    }

    this.#pool = new ThreadPool(this, options);
  }

  runTask (task : any, fileName? : string) : Promise<any> {
    return this.#pool.runTask(task, fileName || null);
  }

  destroy () {
    return this.#pool.destroy();
  }

  get options () : Options {
    return this.#pool.options;
  }

  get threads () : Worker[] {
    return this.#pool.workers.map((workerInfo) => workerInfo.worker);
  }

  get queueSize () : number {
    return this.#pool.taskQueue.length;
  }

  static get isWorkerThread () : boolean {
    return commonState.isWorkerThread;
  }

  static get version () : string {
    return version;
  }

  static get Piscina () {
    return Piscina;
  }
}

export = Piscina;
