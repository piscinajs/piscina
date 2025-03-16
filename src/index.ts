import { Worker, MessageChannel, MessagePort } from 'node:worker_threads';
import { once, EventEmitterAsyncResource } from 'node:events';
import { resolve } from 'node:path';
import { inspect, types } from 'node:util';
import { RecordableHistogram, createHistogram, performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import assert from 'node:assert';

import { version } from '../package.json';
import type {
  ResponseMessage,
  StartupMessage,
  Transferable,
  ResourceLimits,
  EnvSpecifier
} from './types';
import {
  kQueueOptions,
  kTransferable,
  kValue
} from './symbols';
import {
  TaskQueue,
  isTaskQueue,
  ArrayTaskQueue,
  FixedQueue,
  TaskInfo,
  PiscinaTask,
  TransferList,
  TransferListItem
} from './task_queue';
import {
  WorkerInfo,
  AsynchronouslyCreatedResourcePool
} from './worker_pool';
import {
  AbortSignalAny,
  AbortSignalEventTarget,
  AbortError,
  onabort
} from './abort';
import { Errors } from './errors';
import {
  READY,
  commonState,
  isTransferable,
  markMovable,
  createHistogramSummary,
  toHistogramIntegerNano,
  getAvailableParallelism,
  maybeFileURLToPath
} from './common';
const cpuParallelism : number = getAvailableParallelism();

interface Options {
  filename? : string | null,
  name?: string,
  minThreads? : number,
  maxThreads? : number,
  idleTimeout? : number,
  maxQueue? : number | 'auto',
  concurrentTasksPerWorker? : number,
  useAtomics? : boolean,
  resourceLimits? : ResourceLimits,
  argv? : string[],
  execArgv? : string[],
  env? : EnvSpecifier,
  workerData? : any,
  taskQueue? : TaskQueue,
  niceIncrement? : number,
  trackUnmanagedFds? : boolean,
  closeTimeout?: number,
  recordTiming?: boolean
}

interface FilledOptions extends Options {
  filename : string | null,
  name: string,
  minThreads : number,
  maxThreads : number,
  idleTimeout : number,
  maxQueue : number,
  concurrentTasksPerWorker : number,
  useAtomics: boolean,
  taskQueue : TaskQueue,
  niceIncrement : number,
  closeTimeout : number,
  recordTiming : boolean
}

interface RunOptions {
  transferList? : TransferList,
  filename? : string | null,
  signal? : AbortSignalAny | null,
  name? : string | null
}

interface FilledRunOptions extends RunOptions {
  transferList : TransferList | never,
  filename : string | null,
  signal : AbortSignalAny | null,
  name : string | null
}

interface CloseOptions {
  force?: boolean,
}

const kDefaultOptions : FilledOptions = {
  filename: null,
  name: 'default',
  minThreads: Math.max(Math.floor(cpuParallelism / 2), 1),
  maxThreads: cpuParallelism * 1.5,
  idleTimeout: 0,
  maxQueue: Infinity,
  concurrentTasksPerWorker: 1,
  useAtomics: true,
  taskQueue: new ArrayTaskQueue(),
  niceIncrement: 0,
  trackUnmanagedFds: true,
  closeTimeout: 30000,
  recordTiming: true
};

const kDefaultRunOptions : FilledRunOptions = {
  transferList: undefined,
  filename: null,
  signal: null,
  name: null
};

const kDefaultCloseOptions : Required<CloseOptions> = {
  force: false
};

class DirectlyTransferable implements Transferable {
  #value : object;
  constructor (value : object) {
    this.#value = value;
  }

  get [kTransferable] () : object { return this.#value; }

  get [kValue] () : object { return this.#value; }
}

class ArrayBufferViewTransferable implements Transferable {
  #view : ArrayBufferView;
  constructor (view : ArrayBufferView) {
    this.#view = view;
  }

  get [kTransferable] () : object { return this.#view.buffer; }

  get [kValue] () : object { return this.#view; }
}

class ThreadPool {
  publicInterface : Piscina;
  workers : AsynchronouslyCreatedResourcePool<WorkerInfo>;
  options : FilledOptions;
  taskQueue : TaskQueue;
  skipQueue : TaskInfo[] = [];
  completed : number = 0;
  runTime? : RecordableHistogram;
  waitTime? : RecordableHistogram;
  needsDrain : boolean;
  start : number = performance.now();
  inProcessPendingMessages : boolean = false;
  startingUp : boolean = false;
  closingUp : boolean = false;
  workerFailsDuringBootstrap : boolean = false;
  destroying : boolean = false;

  constructor (publicInterface : Piscina, options : Options) {
    this.publicInterface = publicInterface;
    this.taskQueue = options.taskQueue || new ArrayTaskQueue();

    const filename =
      options.filename ? maybeFileURLToPath(options.filename) : null;
    this.options = { ...kDefaultOptions, ...options, filename, maxQueue: 0 };

    if (this.options.recordTiming) {
      this.runTime = createHistogram();
      this.waitTime = createHistogram();
    }

    // The >= and <= could be > and < but this way we get 100 % coverage 🙃
    if (options.maxThreads !== undefined &&
        this.options.minThreads >= options.maxThreads) {
      this.options.minThreads = options.maxThreads;
    }
    if (options.minThreads !== undefined &&
        this.options.maxThreads <= options.minThreads) {
      this.options.maxThreads = options.minThreads;
    }
    if (options.maxQueue === 'auto') {
      this.options.maxQueue = this.options.maxThreads ** 2;
    } else {
      this.options.maxQueue = options.maxQueue ?? kDefaultOptions.maxQueue;
    }

    this.workers = new AsynchronouslyCreatedResourcePool<WorkerInfo>(
      this.options.concurrentTasksPerWorker);
    this.workers.onAvailable((w : WorkerInfo) => this._onWorkerAvailable(w));

    this.startingUp = true;
    this._ensureMinimumWorkers();
    this.startingUp = false;
    this.needsDrain = false;
  }

  _ensureMinimumWorkers () : void {
    if (this.closingUp || this.destroying) {
      return;
    }
    while (this.workers.size < this.options.minThreads) {
      this._addNewWorker();
    }
  }

  _addNewWorker () : void {
    const pool = this;
    const worker = new Worker(resolve(__dirname, 'worker.js'), {
      env: this.options.env,
      argv: this.options.argv,
      execArgv: this.options.execArgv,
      resourceLimits: this.options.resourceLimits,
      workerData: this.options.workerData,
      trackUnmanagedFds: this.options.trackUnmanagedFds
    });

    const { port1, port2 } = new MessageChannel();
    const workerInfo = new WorkerInfo(worker, port1, onMessage);
    if (this.startingUp) {
      // There is no point in waiting for the initial set of Workers to indicate
      // that they are ready, we just mark them as such from the start.
      workerInfo.markAsReady();
    }

    const message : StartupMessage = {
      filename: this.options.filename,
      name: this.options.name,
      port: port2,
      sharedBuffer: workerInfo.sharedBuffer,
      useAtomics: this.options.useAtomics,
      niceIncrement: this.options.niceIncrement
    };
    worker.postMessage(message, [port2]);

    function onMessage (message : ResponseMessage) {
      const { taskId, result } = message;
      // In case of success: Call the callback that was passed to `runTask`,
      // remove the `TaskInfo` associated with the Worker, which marks it as
      // free again.
      const taskInfo = workerInfo.taskInfos.get(taskId);
      workerInfo.taskInfos.delete(taskId);

      pool.workers.maybeAvailable(workerInfo);

      /* istanbul ignore if */
      if (taskInfo === undefined) {
        const err = new Error(
          `Unexpected message from Worker: ${inspect(message)}`);
        pool.publicInterface.emit('error', err);
      } else {
        taskInfo.done(message.error, result);
      }

      pool._processPendingMessages();
    }

    function onReady () {
      if (workerInfo.currentUsage() === 0) {
        workerInfo.unref();
      }

      if (!workerInfo.isReady()) {
        workerInfo.markAsReady();
      }
    }

    function onEventMessage (message: any) {
      pool.publicInterface.emit('message', message);
    }

    worker.on('message', (message : any) => {
      message instanceof Object && READY in message ? onReady() : onEventMessage(message);
    });

    worker.on('error', (err : Error) => {
      this._onError(worker, workerInfo, err, false);
    });

    worker.on('exit', (exitCode : number) => {
      if (this.destroying) {
        return;
      }

      const err = new Error(`worker exited with code: ${exitCode}`);
      // Only error unfinished tasks on process exit, since there are legitimate
      // reasons to exit workers and we want to handle that gracefully when possible.
      this._onError(worker, workerInfo, err, true);
    });

    worker.unref();
    port1.on('close', () => {
      // The port is only closed if the Worker stops for some reason, but we
      // always .unref() the Worker itself. We want to receive e.g. 'error'
      // events on it, so we ref it once we know it's going to exit anyway.
      worker.ref();
    });

    this.workers.add(workerInfo);
  }

  _onError (worker: Worker, workerInfo: WorkerInfo, err: Error, onlyErrorUnfinishedTasks: boolean) {
    // Work around the bug in https://github.com/nodejs/node/pull/33394
    worker.ref = () => {};

    const taskInfos = [...workerInfo.taskInfos.values()];
    workerInfo.taskInfos.clear();

    // Remove the worker from the list and potentially start a new Worker to
    // replace the current one.
    this._removeWorker(workerInfo);

    if (workerInfo.isReady() && !this.workerFailsDuringBootstrap) {
      this._ensureMinimumWorkers();
    } else {
      // Do not start new workers over and over if they already fail during
      // bootstrap, there's no point.
      this.workerFailsDuringBootstrap = true;
    }

    if (taskInfos.length > 0) {
      // If there are remaining unfinished tasks, call the callback that was
      // passed to `postTask` with the error
      for (const taskInfo of taskInfos) {
        taskInfo.done(err, null);
      }
    } else if (!onlyErrorUnfinishedTasks) {
      // If there are no unfinished tasks, instead emit an 'error' event
      this.publicInterface.emit('error', err);
    }
  }

  _processPendingMessages () {
    if (this.inProcessPendingMessages || !this.options.useAtomics) {
      return;
    }

    this.inProcessPendingMessages = true;
    try {
      for (const workerInfo of this.workers) {
        workerInfo.processPendingMessages();
      }
    } finally {
      this.inProcessPendingMessages = false;
    }
  }

  _removeWorker (workerInfo : WorkerInfo) : void {
    workerInfo.destroy();

    this.workers.delete(workerInfo);
  }

  _onWorkerAvailable (workerInfo : WorkerInfo) : void {
    while ((this.taskQueue.size > 0 || this.skipQueue.length > 0) &&
      workerInfo.currentUsage() < this.options.concurrentTasksPerWorker) {
      // The skipQueue will have tasks that we previously shifted off
      // the task queue but had to skip over... we have to make sure
      // we drain that before we drain the taskQueue.
      const taskInfo = this.skipQueue.shift() ||
                       this.taskQueue.shift() as TaskInfo;
      // If the task has an abortSignal and the worker has any other
      // tasks, we cannot distribute the task to it. Skip for now.
      if (taskInfo.abortSignal && workerInfo.taskInfos.size > 0) {
        this.skipQueue.push(taskInfo);
        break;
      }
      const now = performance.now();
      this.waitTime?.record(toHistogramIntegerNano(now - taskInfo.created));
      taskInfo.started = now;
      workerInfo.postTask(taskInfo);
      this._maybeDrain();
      return;
    }

    // If Infinity was sent as a parameter, we skip setting the Timeout that clears the worker
    if (this.options.idleTimeout === Infinity) {
      return;
    }

    if (workerInfo.taskInfos.size === 0 &&
        this.workers.size > this.options.minThreads) {
      workerInfo.idleTimeout = setTimeout(() => {
        assert.strictEqual(workerInfo.taskInfos.size, 0);
        if (this.workers.size > this.options.minThreads) {
          this._removeWorker(workerInfo);
        }
      }, this.options.idleTimeout).unref();
    }
  }

  runTask (
    task : any,
    options : RunOptions) : Promise<any> {
    let {
      filename,
      name
    } = options;
    const {
      transferList = []
    } = options;
    if (filename == null) {
      filename = this.options.filename;
    }
    if (name == null) {
      name = this.options.name;
    }
    if (typeof filename !== 'string') {
      return Promise.reject(Errors.FilenameNotProvided());
    }
    filename = maybeFileURLToPath(filename);

    let signal: AbortSignalAny | null;
    if (this.closingUp) {
      const closingUpAbortController = new AbortController();
      closingUpAbortController.abort('queue is closing up');

      signal = closingUpAbortController.signal;
    } else {
      signal = options.signal ?? null;
    }

    let resolve : (result : any) => void;
    let reject : (err : Error) => void;
    // eslint-disable-next-line
    const ret = new Promise((res, rej) => { resolve = res; reject = rej; });
    const taskInfo = new TaskInfo(
      task,
      transferList,
      filename,
      name,
      (err : Error | null, result : any) => {
        this.completed++;
        if (taskInfo.started) {
          this.runTime?.record(toHistogramIntegerNano(performance.now() - taskInfo.started));
        }
        if (err !== null) {
          reject(err);
        } else {
          resolve(result);
        }

        this._maybeDrain();
      },
      signal,
      this.publicInterface.asyncResource.asyncId());

    if (signal !== null) {
      // If the AbortSignal has an aborted property and it's truthy,
      // reject immediately.
      if ((signal as AbortSignalEventTarget).aborted) {
        return Promise.reject(new AbortError((signal as AbortSignalEventTarget).reason));
      }
      taskInfo.abortListener = () => {
        // Call reject() first to make sure we always reject with the AbortError
        // if the task is aborted, not with an Error from the possible
        // thread termination below.
        reject(new AbortError((signal as AbortSignalEventTarget).reason));

        if (taskInfo.workerInfo !== null) {
          // Already running: We cancel the Worker this is running on.
          this._removeWorker(taskInfo.workerInfo);
          this._ensureMinimumWorkers();
        } else {
          // Not yet running: Remove it from the queue.
          this.taskQueue.remove(taskInfo);
        }
      };
      onabort(signal, taskInfo.abortListener);
    }

    // If there is a task queue, there's no point in looking for an available
    // Worker thread. Add this task to the queue, if possible.
    if (this.taskQueue.size > 0) {
      const totalCapacity = this.options.maxQueue + this.pendingCapacity();
      if (this.taskQueue.size >= totalCapacity) {
        if (this.options.maxQueue === 0) {
          return Promise.reject(Errors.NoTaskQueueAvailable());
        } else {
          return Promise.reject(Errors.TaskQueueAtLimit());
        }
      } else {
        if (this.workers.size < this.options.maxThreads) {
          this._addNewWorker();
        }
        this.taskQueue.push(taskInfo);
      }

      this._maybeDrain();
      return ret;
    }

    // Look for a Worker with a minimum number of tasks it is currently running.
    let workerInfo : WorkerInfo | null = this.workers.findAvailable();

    // If we want the ability to abort this task, use only workers that have
    // no running tasks.
    if (workerInfo !== null && workerInfo.currentUsage() > 0 && signal) {
      workerInfo = null;
    }

    // If no Worker was found, or that Worker was handling another task in some
    // way, and we still have the ability to spawn new threads, do so.
    let waitingForNewWorker = false;
    if ((workerInfo === null || workerInfo.currentUsage() > 0) &&
        this.workers.size < this.options.maxThreads) {
      this._addNewWorker();
      waitingForNewWorker = true;
    }

    // If no Worker is found, try to put the task into the queue.
    if (workerInfo === null) {
      if (this.options.maxQueue <= 0 && !waitingForNewWorker) {
        return Promise.reject(Errors.NoTaskQueueAvailable());
      } else {
        this.taskQueue.push(taskInfo);
      }

      this._maybeDrain();
      return ret;
    }

    // TODO(addaleax): Clean up the waitTime/runTime recording.
    const now = performance.now();
    this.waitTime?.record(toHistogramIntegerNano(now - taskInfo.created));
    taskInfo.started = now;
    workerInfo.postTask(taskInfo);
    this._maybeDrain();
    return ret;
  }

  pendingCapacity () : number {
    return this.workers.pendingItems.size *
      this.options.concurrentTasksPerWorker;
  }

  _maybeDrain () {
    const totalCapacity = this.options.maxQueue + this.pendingCapacity();
    const totalQueueSize = this.taskQueue.size + this.skipQueue.length;

    if (totalQueueSize === 0) {
      this.needsDrain = false;
      this.publicInterface.emit('drain');
    }

    if (totalQueueSize >= totalCapacity) {
      this.needsDrain = true;
      this.publicInterface.emit('needsDrain');
    }
  }

  async destroy () {
    this.destroying = true;
    while (this.skipQueue.length > 0) {
      const taskInfo : TaskInfo = this.skipQueue.shift() as TaskInfo;
      taskInfo.done(new Error('Terminating worker thread'));
    }
    while (this.taskQueue.size > 0) {
      const taskInfo : TaskInfo = this.taskQueue.shift() as TaskInfo;
      taskInfo.done(new Error('Terminating worker thread'));
    }

    const exitEvents : Promise<any[]>[] = [];
    while (this.workers.size > 0) {
      const [workerInfo] = this.workers;
      exitEvents.push(once(workerInfo.worker, 'exit'));
      this._removeWorker(workerInfo);
    }

    try {
      await Promise.all(exitEvents);
    } finally {
      this.destroying = false;
    }
  }

  async close (options : Required<CloseOptions>) {
    this.closingUp = true;

    if (options.force) {
      const skipQueueLength = this.skipQueue.length;
      for (let i = 0; i < skipQueueLength; i++) {
        const taskInfo : TaskInfo = this.skipQueue.shift() as TaskInfo;
        if (taskInfo.workerInfo === null) {
          taskInfo.done(new AbortError('pool is closed'));
        } else {
          this.skipQueue.push(taskInfo);
        }
      }

      const taskQueueLength = this.taskQueue.size;
      for (let i = 0; i < taskQueueLength; i++) {
        const taskInfo : TaskInfo = this.taskQueue.shift() as TaskInfo;
        if (taskInfo.workerInfo === null) {
          taskInfo.done(new AbortError('pool is closed'));
        } else {
          this.taskQueue.push(taskInfo);
        }
      }
    }

    const onPoolFlushed = () => new Promise<void>((resolve) => {
      const numberOfWorkers = this.workers.size;

      if (numberOfWorkers === 0) {
        resolve();
        return;
      }

      let numberOfWorkersDone = 0;

      const checkIfWorkerIsDone = (workerInfo: WorkerInfo) => {
        if (workerInfo.taskInfos.size === 0) {
          numberOfWorkersDone++;
        }

        if (numberOfWorkers === numberOfWorkersDone) {
          resolve();
        }
      };

      for (const workerInfo of this.workers) {
        checkIfWorkerIsDone(workerInfo);

        workerInfo.port.on('message', () => checkIfWorkerIsDone(workerInfo));
      }
    });

    const throwOnTimeOut = async (timeout: number) => {
      await sleep(timeout);
      throw Errors.CloseTimeout();
    };

    try {
      await Promise.race([
        onPoolFlushed(),
        throwOnTimeOut(this.options.closeTimeout)
      ]);
    } catch (error) {
      this.publicInterface.emit('error', error);
    } finally {
      await this.destroy();
      this.publicInterface.emit('close');
      this.closingUp = false;
    }
  }
}

export default class Piscina<T = any, R = any> extends EventEmitterAsyncResource {
  #pool : ThreadPool;

  constructor (options : Options = {}) {
    super({ ...options, name: 'Piscina' });

    if (typeof options.filename !== 'string' && options.filename != null) {
      throw new TypeError('options.filename must be a string or null');
    }
    if (typeof options.name !== 'string' && options.name != null) {
      throw new TypeError('options.name must be a string or null');
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
        options.maxQueue !== 'auto' &&
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
    if (options.taskQueue !== undefined && !isTaskQueue(options.taskQueue)) {
      throw new TypeError('options.taskQueue must be a TaskQueue object');
    }
    if (options.niceIncrement !== undefined &&
        (typeof options.niceIncrement !== 'number' || (options.niceIncrement < 0 && process.platform !== 'win32'))) {
      throw new TypeError('options.niceIncrement must be a non-negative integer on Unix systems');
    }
    if (options.trackUnmanagedFds !== undefined &&
        typeof options.trackUnmanagedFds !== 'boolean') {
      throw new TypeError('options.trackUnmanagedFds must be a boolean value');
    }
    if (options.closeTimeout !== undefined && (typeof options.closeTimeout !== 'number' || options.closeTimeout < 0)) {
      throw new TypeError('options.closeTimeout must be a non-negative integer');
    }

    this.#pool = new ThreadPool(this, options);
  }

  /** @deprecated Use run(task, options) instead **/
  runTask (task : T, transferList? : TransferList, filename? : string, abortSignal? : AbortSignalAny) : Promise<R>;

  /** @deprecated Use run(task, options) instead **/
  runTask (task : T, transferList? : TransferList, filename? : AbortSignalAny, abortSignal? : undefined) : Promise<R>;

  /** @deprecated Use run(task, options) instead **/
  runTask (task : T, transferList? : string, filename? : AbortSignalAny, abortSignal? : undefined) : Promise<R>;

  /** @deprecated Use run(task, options) instead **/
  runTask (task : T, transferList? : AbortSignalAny, filename? : undefined, abortSignal? : undefined) : Promise<R>;

  /** @deprecated Use run(task, options) instead **/
  runTask (task : T, transferList? : any, filename? : any, signal? : any): Promise<R> {
    // If transferList is a string or AbortSignal, shift it.
    if ((typeof transferList === 'object' && !Array.isArray(transferList)) ||
        typeof transferList === 'string') {
      signal = filename as (AbortSignalAny | undefined);
      filename = transferList;
      transferList = undefined;
    }
    // If filename is an AbortSignal, shift it.
    if (typeof filename === 'object' && !Array.isArray(filename)) {
      signal = filename;
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
    if (signal !== undefined && typeof signal !== 'object') {
      return Promise.reject(
        new TypeError('signal argument must be an object'));
    }
    return this.#pool.runTask(
      task, {
        transferList,
        filename: filename || null,
        name: 'default',
        signal: signal || null
      });
  }

  run (task : T, options : RunOptions = kDefaultRunOptions): Promise<R> {
    if (options === null || typeof options !== 'object') {
      return Promise.reject(
        new TypeError('options must be an object'));
    }
    const {
      transferList,
      filename,
      name,
      signal
    } = options;
    if (transferList !== undefined && !Array.isArray(transferList)) {
      return Promise.reject(
        new TypeError('transferList argument must be an Array'));
    }
    if (filename != null && typeof filename !== 'string') {
      return Promise.reject(
        new TypeError('filename argument must be a string'));
    }
    if (name != null && typeof name !== 'string') {
      return Promise.reject(new TypeError('name argument must be a string'));
    }
    if (signal != null && typeof signal !== 'object') {
      return Promise.reject(
        new TypeError('signal argument must be an object'));
    }
    return this.#pool.runTask(task, { transferList, filename, name, signal });
  }

  async close (options : CloseOptions = kDefaultCloseOptions) {
    if (options === null || typeof options !== 'object') {
      throw TypeError('options must be an object');
    }

    let { force } = options;

    if (force !== undefined && typeof force !== 'boolean') {
      return Promise.reject(
        new TypeError('force argument must be a boolean'));
    }
    force ??= kDefaultCloseOptions.force;

    return this.#pool.close({
      force
    });
  }

  destroy () {
    return this.#pool.destroy();
  }

  get maxThreads (): number {
    return this.#pool.options.maxThreads;
  }

  get minThreads (): number {
    return this.#pool.options.minThreads;
  }

  get options () : FilledOptions {
    return this.#pool.options;
  }

  get threads () : Worker[] {
    const ret : Worker[] = [];
    for (const workerInfo of this.#pool.workers) { ret.push(workerInfo.worker); }
    return ret;
  }

  get queueSize () : number {
    const pool = this.#pool;
    return Math.max(pool.taskQueue.size - pool.pendingCapacity(), 0);
  }

  get completed () : number {
    return this.#pool.completed;
  }

  get waitTime () : any {
    if (!this.#pool.waitTime) {
      return null;
    }

    return createHistogramSummary(this.#pool.waitTime);
  }

  get runTime () : any {
    if (!this.#pool.runTime) {
      return null;
    }

    return createHistogramSummary(this.#pool.runTime);
  }

  get utilization () : number {
    if (!this.#pool.runTime) {
      return 0;
    }

    // count is available as of Node.js v16.14.0 but not present in the types
    const count = (this.#pool.runTime as RecordableHistogram & { count: number}).count;
    if (count === 0) {
      return 0;
    }

    // The capacity is the max compute time capacity of the
    // pool to this point in time as determined by the length
    // of time the pool has been running multiplied by the
    // maximum number of threads.
    const capacity = this.duration * this.#pool.options.maxThreads;
    const totalMeanRuntime = (this.#pool.runTime.mean / 1000) * count;

    // We calculate the appoximate pool utilization by multiplying
    // the mean run time of all tasks by the number of runtime
    // samples taken and dividing that by the capacity. The
    // theory here is that capacity represents the absolute upper
    // limit of compute time this pool could ever attain (but
    // never will for a variety of reasons. Multiplying the
    // mean run time by the number of tasks sampled yields an
    // approximation of the realized compute time. The utilization
    // then becomes a point-in-time measure of how active the
    // pool is.
    return totalMeanRuntime / capacity;
  }

  get duration () : number {
    return performance.now() - this.#pool.start;
  }

  get needsDrain () : boolean {
    return this.#pool.needsDrain;
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

  static get FixedQueue () {
    return FixedQueue;
  }

  static get ArrayTaskQueue () {
    return ArrayTaskQueue;
  }

  static move (val : Transferable | TransferListItem | ArrayBufferView | ArrayBuffer | MessagePort) {
    if (val != null && typeof val === 'object' && typeof val !== 'function') {
      if (!isTransferable(val)) {
        if ((types as any).isArrayBufferView(val)) {
          val = new ArrayBufferViewTransferable(val as ArrayBufferView);
        } else {
          val = new DirectlyTransferable(val);
        }
      }
      markMovable(val);
    }
    return val;
  }

  static get transferableSymbol () { return kTransferable; }

  static get valueSymbol () { return kValue; }

  static get queueOptionsSymbol () { return kQueueOptions; }
}

export const move = Piscina.move;
export const isWorkerThread = Piscina.isWorkerThread;
export const workerData = Piscina.workerData;

export {
  Piscina,
  PiscinaTask,
  TaskQueue,
  kTransferable as transferableSymbol,
  kValue as valueSymbol,
  kQueueOptions as queueOptionsSymbol,
  version,
  FixedQueue
};
