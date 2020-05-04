import { Worker, MessageChannel, MessagePort } from 'worker_threads'; // eslint-disable-line
import { EventEmitter, once } from 'events';
import { AsyncResource } from 'async_hooks';
import { cpus } from 'os';
import { fileURLToPath, URL } from 'url';
import { resolve } from 'path';
import { inspect } from 'util';
import assert from 'assert';
import { Histogram, build } from 'hdr-histogram-js';
import { performance } from 'perf_hooks';
import hdrobj from 'hdr-histogram-percentiles-obj';
import { RequestMessage, ResponseMessage, StartupMessage, commonState, kResponseCountField, kRequestCountField, kFieldCount } from './common';
import { version } from '../package.json';
// TODO(addaleax): Undo when https://github.com/DefinitelyTyped/DefinitelyTyped/pull/44034 is released.
import wt from 'worker_threads'; // eslint-disable-line
const { receiveMessageOnPort } = wt as any;

const cpuCount : number = (() => {
  try {
    return cpus().length;
  } catch {
    /* istanbul ignore next */
    return 1;
  }
})();

interface AbortSignalEventTarget {
  addEventListener : (name : 'abort', listener : () => void) => void;
}
interface AbortSignalEventEmitter {
  on : (name : 'abort', listener : () => void) => void;
}
type AbortSignalAny = AbortSignalEventTarget | AbortSignalEventEmitter;
function onabort (abortSignal : AbortSignalAny, listener : () => void) {
  if ('addEventListener' in abortSignal) {
    abortSignal.addEventListener('abort', listener);
  } else {
    abortSignal.on('abort', listener);
  }
}
class AbortError extends Error {
  constructor () {
    super('The task has been aborted');
  }
}

type ResourceLimits = Worker extends {
  resourceLimits? : infer T;
} ? T : {};
type EnvSpecifier = typeof Worker extends {
  new (filename : never, options?: { env: infer T }) : Worker;
} ? T : never;

interface Options {
  filename? : string | null,
  minThreads? : number,
  maxThreads? : number,
  idleTimeout? : number,
  maxQueue? : number,
  concurrentTasksPerWorker? : number,
  useAtomics? : boolean,
  resourceLimits? : ResourceLimits,
  argv? : string[],
  execArgv? : string[],
  env? : EnvSpecifier,
  workerData? : any,
}

interface FilledOptions extends Options {
  filename : string | null,
  minThreads : number,
  maxThreads : number,
  idleTimeout : number,
  maxQueue : number,
  concurrentTasksPerWorker : number,
  useAtomics: boolean
}

const kDefaultOptions : FilledOptions = {
  filename: null,
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

function maybeFileURLToPath (filename : string) : string {
  return filename.startsWith('file:')
    ? fileURLToPath(new URL(filename)) : filename;
}

// Extend AsyncResource so that async relations between posting a task and
// receiving its result are visible to diagnostic tools.
class TaskInfo extends AsyncResource {
  callback : TaskCallback;
  task : any;
  transferList : TransferList;
  filename : string;
  taskId : number;
  abortSignal : AbortSignalAny | null;
  workerInfo : WorkerInfo | null = null;
  created : number;
  started : number;

  constructor (
    task : any,
    transferList : TransferList,
    filename : string,
    callback : TaskCallback,
    abortSignal : AbortSignalAny | null) {
    super('Piscina.Task', { requireManualDestroy: false });
    this.callback = callback;
    this.task = task;
    this.transferList = transferList;
    this.filename = filename;
    this.taskId = taskIdCounter++;
    this.abortSignal = abortSignal;
    this.created = performance.now();
    this.started = 0;
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
    this.sharedBuffer = new Int32Array(
      new SharedArrayBuffer(kFieldCount * Int32Array.BYTES_PER_ELEMENT));
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

  ref () : WorkerInfo {
    this.worker.ref();
    this.port.ref();
    return this;
  }

  unref () : WorkerInfo {
    this.worker.unref();
    this.port.unref();
    return this;
  }

  _handleResponse (message : ResponseMessage) : void {
    this.onMessage(message);

    if (this.taskInfos.size === 0) {
      // No more tasks running on this Worker means it should not keep the
      // process running.
      this.unref();
    }
  }

  postTask (taskInfo : TaskInfo) {
    assert(!this.taskInfos.has(taskInfo.taskId));
    const message : RequestMessage = {
      task: taskInfo.releaseTask(),
      taskId: taskInfo.taskId,
      filename: taskInfo.filename
    };

    try {
      this.port.postMessage(message, taskInfo.transferList);
    } catch (err) {
      // This would mostly happen if e.g. message contains unserializable data
      // or transferList is invalid.
      taskInfo.done(err);
      return;
    }

    taskInfo.workerInfo = this;
    this.taskInfos.set(taskInfo.taskId, taskInfo);
    this.ref();
    this.clearIdleTimeout();

    // Inform the worker that there are new messages posted, and wake it up
    // if it is waiting for one.
    Atomics.add(this.sharedBuffer, kRequestCountField, 1);
    Atomics.notify(this.sharedBuffer, kRequestCountField, 1);
  }

  processPendingMessages () {
    // If we *know* that there are more messages than we have received using
    // 'message' events yet, then try to load and handle them synchronously,
    // without the need to wait for more expensive events on the event loop.
    // This would usually break async tracking, but in our case, we already have
    // the extra TaskInfo/AsyncResource layer that rectifies that situation.
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

  isRunningAbortableTask () : boolean {
    // If there are abortable tasks, we are running one at most per Worker.
    if (this.taskInfos.size !== 1) return false;
    const [[, task]] = this.taskInfos;
    return task.abortSignal !== null;
  }
}

class ThreadPool {
  publicInterface : Piscina;
  workers : WorkerInfo[];
  options : FilledOptions;
  taskQueue : TaskInfo[]; // Maybe turn this into a priority queue?
  completed : number = 0;
  runTime : Histogram;
  waitTime : Histogram;

  constructor (publicInterface : Piscina, options : Options) {
    this.publicInterface = publicInterface;
    this.workers = [];
    this.taskQueue = [];
    this.runTime = build({ lowestDiscernibleValue: 1 });
    this.waitTime = build({ lowestDiscernibleValue: 1 });

    const filename =
      options.filename ? maybeFileURLToPath(options.filename) : null;
    this.options = { ...kDefaultOptions, ...options, filename };
    // The >= and <= could be > and < but this way we get 100 % coverage 🙃
    if (options.maxThreads !== undefined &&
        this.options.minThreads >= options.maxThreads) {
      this.options.minThreads = options.maxThreads;
    }
    if (options.minThreads !== undefined &&
        this.options.maxThreads <= options.minThreads) {
      this.options.maxThreads = options.minThreads;
    }

    this._ensureMinimumWorkers();
  }

  _ensureMinimumWorkers () : void {
    while (this.workers.length < this.options.minThreads) {
      this._onWorkerFree(this._addNewWorker());
    }
  }

  _addNewWorker () : WorkerInfo {
    const pool = this;
    const worker = new Worker(resolve(__dirname, 'worker.js'), {
      env: this.options.env,
      argv: this.options.argv,
      execArgv: this.options.execArgv,
      resourceLimits: this.options.resourceLimits,
      workerData: this.options.workerData
    });

    const { port1, port2 } = new MessageChannel();
    const workerInfo = new WorkerInfo(worker, port1, onMessage);

    const message : StartupMessage = {
      filename: this.options.filename,
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
      const taskInfo = this.taskQueue.shift() as TaskInfo;
      const now = performance.now();
      this.waitTime.recordValue(now - taskInfo.created);
      taskInfo.started = now;
      workerInfo.postTask(taskInfo);
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

  runTask (
    task : any,
    transferList : TransferList,
    filename : string | null,
    abortSignal : AbortSignalAny | null) : Promise<any> {
    if (filename === null) {
      filename = this.options.filename;
    }
    if (typeof filename !== 'string') {
      return Promise.reject(new Error(
        'filename must be provided to runTask() or in options object'));
    }
    filename = maybeFileURLToPath(filename);

    let resolve : (result : any) => void;
    let reject : (err : Error) => void;
    // eslint-disable-next-line
    const ret = new Promise((res, rej) => { resolve = res; reject = rej; });
    const taskInfo = new TaskInfo(
      task, transferList, filename, (err : Error | null, result : any) => {
        this.completed++;
        if (taskInfo.started) {
          this.runTime.recordValue(performance.now() - taskInfo.started);
        }
        if (err !== null) {
          reject(err);
        } else {
          resolve(result);
        }
      },
      abortSignal);

    if (abortSignal !== null) {
      onabort(abortSignal, () => {
        // Call reject() first to make sure we always reject with the AbortError
        // if the task is aborted, not with an Error from the possible
        // thread termination below.
        reject(new AbortError());

        if (taskInfo.workerInfo !== null) {
          // Already running: We cancel the Worker this is running on.
          this._removeWorker(taskInfo.workerInfo);
          this._ensureMinimumWorkers();
        } else {
          // Not yet running: Remove it from the queue.
          const index = this.taskQueue.indexOf(taskInfo);
          assert.notStrictEqual(index, -1);
          this.taskQueue.splice(index, 1);
        }
      });
    }

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
      if (candidate.taskInfos.size < minimumCurrentTasks &&
          !candidate.isRunningAbortableTask()) {
        workerInfo = candidate;
        minimumCurrentTasks = candidate.taskInfos.size;
        if (minimumCurrentTasks === 0) break;
      }
    }

    // If all Workers are at maximum usage, do not use any of them.
    // If we want the ability to abort this task, use only workers that have
    // no running tasks.
    if (minimumCurrentTasks >= this.options.concurrentTasksPerWorker ||
        (minimumCurrentTasks > 0 && abortSignal)) {
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

    const now = performance.now();
    this.waitTime.recordValue(now - taskInfo.created);
    taskInfo.started = now;
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

    if (typeof options.filename !== 'string' && options.filename != null) {
      throw new TypeError('options.filename must be a string or null');
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
    if (options.resourceLimits !== undefined &&
        (typeof options.resourceLimits !== 'object' ||
         options.resourceLimits === null)) {
      throw new TypeError('options.resourceLimits must be an object');
    }

    this.#pool = new ThreadPool(this, options);
  }

  runTask (task : any, transferList? : TransferList | string | AbortSignalAny, filename? : string | AbortSignalAny, abortSignal? : AbortSignalAny) {
    // If transferList is a string or AbortSignal, shift it.
    if ((typeof transferList === 'object' && !Array.isArray(transferList)) ||
        typeof transferList === 'string') {
      abortSignal = filename as (AbortSignalAny | undefined);
      filename = transferList;
      transferList = undefined;
    }
    // If filename is an AbortSignal, shift it.
    if (typeof filename === 'object' && !Array.isArray(filename)) {
      abortSignal = filename;
      filename = undefined;
    }

    if (transferList !== undefined && !Array.isArray(transferList)) {
      return Promise.reject(
        new TypeError('transferList argument must be an Array'));
    }
    if (filename !== undefined && typeof filename !== 'string') {
      return Promise.reject(
        new TypeError('filename argument must be a string'));
    }
    if (abortSignal !== undefined && typeof abortSignal !== 'object') {
      return Promise.reject(
        new TypeError('abortSignal argument must be an object'));
    }
    return this.#pool.runTask(
      task, transferList, filename || null, abortSignal || null);
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

  get completed () : number {
    return this.#pool.completed;
  }

  get waitTime () : any {
    const result = hdrobj.histAsObj(this.#pool.waitTime);
    return hdrobj.addPercentiles(this.#pool.waitTime, result);
  }

  get runTime () : any {
    const result = hdrobj.histAsObj(this.#pool.runTime);
    return hdrobj.addPercentiles(this.#pool.runTime, result);
  }

  static get isWorkerThread () : boolean {
    return commonState.isWorkerThread;
  }

  static get workerData () : any {
    return commonState.workerData;
  }

  static get version () : string {
    return version;
  }

  static get Piscina () {
    return Piscina;
  }
}

export = Piscina;
