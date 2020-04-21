import { Worker, MessageChannel, MessagePort, receiveMessageOnPort } from 'worker_threads';
import { EventEmitter, once } from 'events';
import { AsyncResource } from 'async_hooks';
import { cpus } from 'os';
import { resolve } from 'path';
import { inspect } from 'util';
import assert from 'assert';
import { RequestMessage, ResponseMessage, WarmupMessage, commonState, kResponseCountField, kRequestCountField, kFieldCount } from './common';
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
  useAtomics? : boolean
}

interface FilledOptions extends Options {
  fileName : string | null,
  minThreads : number,
  maxThreads : number,
  idleTimeout : number,
  maxQueue : number,
  concurrentTasksPerWorker : number,
  useAtomics: boolean
}

const kDefaultOptions : FilledOptions = {
  fileName: null,
  minThreads: Math.max(cpuCount / 2, 1),
  maxThreads: cpuCount * 1.5,
  idleTimeout: 0,
  maxQueue: Infinity,
  concurrentTasksPerWorker: 1,
  useAtomics: true
};

let taskIdCounter = 0;

type TaskCallback = (err : Error, result: any) => void;
// Grab the type of `transferList` off `MessagePort`. At the time of writing,
// only ArrayBuffer and MessagePort are valid, but let's avoid having to update
// our types here every time Node.js adds support for more objects.
type TransferList = MessagePort extends { postMessage(value : any, transferList : infer T) : any; } ? T : never;

class TaskInfo extends AsyncResource {
  callback : TaskCallback;
  task : any;
  transferList : TransferList;
  fileName : string;
  taskId : number;

  constructor (
    task : any,
    transferList : TransferList,
    fileName : string,
    callback : TaskCallback) {
    super('Piscina.Task', { requireManualDestroy: false });
    this.callback = callback;
    this.task = task;
    this.transferList = transferList;
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

type ResponseCallback = (response : ResponseMessage) => void;

class WorkerInfo {
  worker : Worker;
  taskInfos : Map<number, TaskInfo>;
  idleTimeout : NodeJS.Timeout | null = null;
  port : MessagePort;
  sharedBuffer : Int32Array;
  lastSeenResponseCount : number = 0;
  onMessage : ResponseCallback;

  constructor (
    worker : Worker,
    port : MessagePort,
    onMessage : ResponseCallback) {
    this.worker = worker;
    this.port = port;
    this.port.on('message',
      (message : ResponseMessage) => this._handleResponse(message));
    this.onMessage = onMessage;
    this.taskInfos = new Map();
    this.sharedBuffer = new Int32Array(new SharedArrayBuffer(kFieldCount * 4));
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

  ref () : void {
    this.worker.ref();
    this.port.ref();
  }

  unref () : void {
    this.worker.unref();
    this.port.unref();
  }

  _handleResponse (message : ResponseMessage) : void {
    this.onMessage(message);

    if (this.taskInfos.size === 0) {
      this.unref();
    }
  }

  postTask (taskInfo : TaskInfo) {
    assert(!this.taskInfos.has(taskInfo.taskId));
    const message : RequestMessage = {
      task: taskInfo.releaseTask(),
      taskId: taskInfo.taskId,
      fileName: taskInfo.fileName
    };

    try {
      this.port.postMessage(message, taskInfo.transferList);
    } catch (err) {
      taskInfo.done(err);
      return;
    }

    this.taskInfos.set(taskInfo.taskId, taskInfo);
    this.ref();
    this.clearIdleTimeout();
    Atomics.add(this.sharedBuffer, kRequestCountField, 1);
    Atomics.notify(this.sharedBuffer, kRequestCountField, 1);
  }

  processPendingMessages () {
    const actualResponseCount =
      Atomics.load(this.sharedBuffer, kResponseCountField);
    if (actualResponseCount !== this.lastSeenResponseCount) {
      this.lastSeenResponseCount = actualResponseCount;

      let entry;
      while ((entry = receiveMessageOnPort(this.port)) !== undefined) {
        this._handleResponse(entry.message);
      }
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
      this._addNewWorker();
    }
  }

  _addNewWorker () : WorkerInfo {
    const pool = this;
    const worker = new Worker(resolve(__dirname, 'worker.js'));

    const { port1, port2 } = new MessageChannel();
    const workerInfo = new WorkerInfo(worker, port1, onMessage);

    const message : WarmupMessage = {
      fileName: this.options.fileName,
      port: port2,
      sharedBuffer: workerInfo.sharedBuffer,
      useAtomics: this.options.useAtomics
    };
    worker.postMessage(message, [port2]);

    function onMessage (message : ResponseMessage) {
      const { taskId, result } = message;
      // In case of success: Call the callback that was passed to `runTask`,
      // remove the `TaskInfo` associated with the Worker, which marks it as
      // free again.
      const taskInfo = workerInfo.taskInfos.get(taskId);
      workerInfo.taskInfos.delete(taskId);

      pool._onWorkerFree(workerInfo);

      /* istanbul ignore if */
      if (taskInfo === undefined) {
        const err = new Error(
          `Unexpected message from Worker: ${inspect(message)}`);
        pool.publicInterface.emit('error', err);
      } else {
        taskInfo.done(message.error, result);
      }

      if (pool.options.useAtomics) {
        for (const workerInfo of pool.workers) {
          workerInfo.processPendingMessages();
        }
      }
    }

    worker.on('message', (message) => {
      worker.emit('error', new Error(
          `Unexpected message on Worker: ${inspect(message)}`));
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

    workerInfo.unref();

    this.workers.push(workerInfo);
    return workerInfo;
  }

  _removeWorker (workerInfo : WorkerInfo) : void {
    workerInfo.destroy();

    this.workers.splice(this.workers.indexOf(workerInfo), 1);
  }

  _onWorkerFree (workerInfo : WorkerInfo) : void {
    if (this.taskQueue.length > 0) {
      workerInfo.postTask(this.taskQueue.shift() as TaskInfo);
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

  // Implement some kind of task cancellation mechanism?
  runTask (
    task : any,
    transferList : TransferList,
    fileName : string | null) : Promise<any> {
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
      task, transferList, fileName, (err : Error | null, result : any) => {
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
      workerInfo = this._addNewWorker();
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

    workerInfo.postTask(taskInfo);
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
    if (options.useAtomics !== undefined &&
        typeof options.useAtomics !== 'boolean') {
      throw new TypeError('options.useAtomics must be a boolean value');
    }

    this.#pool = new ThreadPool(this, options);
  }

  runTask (task : any, transferList? : TransferList | string, fileName? : string) {
    if (typeof transferList === 'string') {
      fileName = transferList;
      transferList = undefined;
    }
    return this.#pool.runTask(task, transferList, fileName || null);
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
