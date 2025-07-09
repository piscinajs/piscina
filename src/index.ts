import { Worker, MessageChannel, MessagePort } from 'node:worker_threads';
import { once, EventEmitterAsyncResource } from 'node:events';
import { resolve } from 'node:path';
import { inspect, types } from 'node:util';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';

import { version } from '../package.json';
import type {
  ResponseMessage,
  StartupMessage,
  Transferable,
  ResourceLimits,
  EnvSpecifier,
} from './types';
import {
  kQueueOptions,
  kTransferable,
  kValue,
  kWorkerData
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
  AsynchronouslyCreatedResourcePool,
  PiscinaLoadBalancer,
  PiscinaWorker,
  LeastBusyBalancer
} from './worker_pool';
import {
  AbortSignalAny,
  AbortSignalEventTarget,
  AbortError,
  onabort
} from './abort';
import {
  PiscinaHistogram,
  PiscinaHistogramHandler,
} from './histogram';
import { Errors } from './errors';
import {
  READY,
  commonState,
  isTransferable,
  markMovable,
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
  atomics? : 'sync' | 'async' | 'disabled',
  resourceLimits? : ResourceLimits,
  argv? : string[],
  execArgv? : string[],
  env? : EnvSpecifier,
  workerData? : any,
  taskQueue? : TaskQueue,
  niceIncrement? : number,
  trackUnmanagedFds? : boolean,
  closeTimeout?: number,
  recordTiming?: boolean,
  loadBalancer?: PiscinaLoadBalancer,
  workerHistogram?: boolean,
}

interface FilledOptions extends Options {
  filename : string | null,
  name: string,
  minThreads : number,
  maxThreads : number,
  idleTimeout : number,
  maxQueue : number,
  concurrentTasksPerWorker : number,
  atomics: Options['atomics'],
  taskQueue : TaskQueue,
  niceIncrement : number,
  closeTimeout : number,
  recordTiming : boolean,
  workerHistogram: boolean,
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
  atomics: 'sync',
  taskQueue: new ArrayTaskQueue(),
  niceIncrement: 0,
  trackUnmanagedFds: true,
  closeTimeout: 30000,
  recordTiming: true,
  workerHistogram: false
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
  histogram: PiscinaHistogramHandler | null = null;
  _needsDrain : boolean;
  start : number = performance.now();
  inProcessPendingMessages : boolean = false;
  startingUp : boolean = false;
  closingUp : boolean = false;
  workerFailsDuringBootstrap : boolean = false;
  destroying : boolean = false;
  maxCapacity: number;
  balancer: PiscinaLoadBalancer;

  constructor (publicInterface : Piscina, options : Options) {
    this.publicInterface = publicInterface;
    this.taskQueue = options.taskQueue ?? new FixedQueue();

    const filename =
      options.filename ? maybeFileURLToPath(options.filename) : null;
    this.options = { ...kDefaultOptions, ...options, filename, maxQueue: 0 };

    if (this.options.recordTiming) {
      this.histogram = new PiscinaHistogramHandler();
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

    this.balancer = this.options.loadBalancer ?? LeastBusyBalancer({ maximumUsage: this.options.concurrentTasksPerWorker });
    this.workers = new AsynchronouslyCreatedResourcePool<WorkerInfo>(
      this.options.concurrentTasksPerWorker);
    this.workers.onTaskDone((w : WorkerInfo) => this._onWorkerTaskDone(w));
    this.maxCapacity = this.options.maxThreads * this.options.concurrentTasksPerWorker;

    this.startingUp = true;
    this._ensureMinimumWorkers();
    this.startingUp = false;
    this._needsDrain = false;
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
    if (this.closingUp) return;

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
    const workerInfo = new WorkerInfo(worker, port1, onMessage, this.options.workerHistogram);

    workerInfo.onDestroy(() => {
      this.publicInterface.emit('workerDestroy', workerInfo.interface);
    });

    if (this.startingUp) {
      // There is no point in waiting for the initial set of Workers to indicate
      // that they are ready, we just mark them as such from the start.
      workerInfo.markAsReady();
      // We need to emit the event in the next microtask, so that the user can
      // attach event listeners before the event is emitted.
      queueMicrotask(() => {
        this.publicInterface.emit('workerCreate', workerInfo.interface);
        this._onWorkerReady(workerInfo);
      });
    } else {
      workerInfo.onReady(() => {
        this.publicInterface.emit('workerCreate', workerInfo.interface);
        this._onWorkerReady(workerInfo);
      });
    }

    const message : StartupMessage = {
      filename: this.options.filename,
      name: this.options.name,
      port: port2,
      sharedBuffer: workerInfo.sharedBuffer,
      atomics: this.options.atomics!,
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

      // TODO: we can abstract the task info handling
      // right into the pool.workers.taskDone method
      pool.workers.taskDone(workerInfo);

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
    if (this.inProcessPendingMessages || this.options.atomics === 'disabled') {
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

  _onWorkerReady (workerInfo : WorkerInfo) : void {
    this._onWorkerAvailable(workerInfo);
  }

  _onWorkerTaskDone (workerInfo: WorkerInfo) : void {
    this._onWorkerAvailable(workerInfo);
  }

  _onWorkerAvailable (workerInfo : WorkerInfo) : void {
    let workers: PiscinaWorker[] | null = null;
    while ((this.taskQueue.size > 0 || this.skipQueue.length > 0)) {
      // The skipQueue will have tasks that we previously shifted off
      // the task queue but had to skip over... we have to make sure
      // we drain that before we drain the taskQueue.
      const taskInfo = this.skipQueue.shift() ||
                       this.taskQueue.shift() as TaskInfo;

      if (workers == null) {
        workers = [...this.workers].map(workerInfo => workerInfo.interface);
      }

      const distributed = this._distributeTask(taskInfo, workers);

      if (distributed) {
        // If task was distributed, we should continue to distribute more tasks
        continue;
      } else if (this.workers.size < this.options.maxThreads) {
        // We spawn if possible
        // TODO: scheduler will intercept this.
        this._addNewWorker();
        continue;
      } else {
        // If balancer states that pool is busy, we should stop trying to distribute tasks
        break;
      }
    }

    //If Infinity was sent as a parameter, we skip setting the Timeout that clears the worker
    if (this.options.idleTimeout === Infinity) {
      return;
    }

    // If more workers than minThreads, we can remove idle workers
    if (workerInfo.currentUsage() === 0 &&
        this.workers.size > this.options.minThreads) {
      workerInfo.idleTimeout = setTimeout(() => {
        if (workerInfo.currentUsage() !== 0) {
          // Exit early - we can't safely remove the worker.
          return;
        }
        if (this.workers.size > this.options.minThreads) {
          this._removeWorker(workerInfo);
        }
      }, this.options.idleTimeout).unref();
    }
  }

  _distributeTask (task: TaskInfo, workers: PiscinaWorker[]): boolean {
    // We need to verify if the task is aborted already or not
    // otherwise we might be distributing aborted tasks to workers
    if (task.aborted) return true;

    const candidate = this.balancer(task.interface, workers);

    // Seeking for a real worker instead of customized one
    if (candidate != null && candidate[kWorkerData] != null) {
      const now = performance.now();
      this.histogram?.recordWaitTime(now - task.created)
      task.started = now;
      candidate[kWorkerData].postTask(task);
      queueMicrotask(() => this._maybeDrain());
      // If candidate, let's try to distribute more tasks
      return true;
    }

    if (task.abortSignal) {
      this.skipQueue.push(task);
    } else {
      this.taskQueue.push(task);
    }

    return false;
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
    if (this.closingUp || this.destroying) {
      const closingUpAbortController = new AbortController();
      closingUpAbortController.abort('queue is being terminated');

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
          this.histogram?.recordRunTime(performance.now() - taskInfo.started);
        }
        if (err !== null) {
          reject(err);
        } else {
          resolve(result);
        }

        queueMicrotask(() => this._maybeDrain());
      },
      signal,
      this.publicInterface.asyncResource.asyncId());

    if (signal !== null) {
      // If the AbortSignal has an aborted property and it's truthy,
      // reject immediately.
      if ((signal as AbortSignalEventTarget).aborted) {
        reject!(new AbortError((signal as AbortSignalEventTarget).reason));
        return ret;
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
          // Call should be idempotent
          this.taskQueue.remove(taskInfo);
        }
      };

      onabort(signal, taskInfo.abortListener);
    }

    if (this.taskQueue.size > 0) {
      const totalCapacity = this.options.maxQueue + this.pendingCapacity();
      if (this.taskQueue.size >= totalCapacity) {
        if (this.options.maxQueue === 0) {
          reject!(Errors.NoTaskQueueAvailable());
        } else {
          reject!(Errors.TaskQueueAtLimit());
        }
      } else {
        this.taskQueue.push(taskInfo);
      }

      queueMicrotask(() => this._maybeDrain());
      return ret;
    }

    const workers = [...this.workers.readyItems].map(workerInfo => workerInfo.interface);
    const distributed = this._distributeTask(taskInfo, workers);

    if (!distributed) {
      // We spawn if possible
      // TODO: scheduler will intercept this.
      if (this.workers.size < this.options.maxThreads) {
        this._addNewWorker();
      }

      // We reject if no task queue set and no more pending capacity.
      if (this.options.maxQueue <= 0 && this.pendingCapacity() === 0) {
        reject!(Errors.NoTaskQueueAvailable());
      }
    };

    queueMicrotask(() => this._maybeDrain());
    return ret;
  }

  pendingCapacity () : number {
    return this.workers.pendingItems.size *
      this.options.concurrentTasksPerWorker;
  }

  _maybeDrain () {
    /**
     * Our goal is to make it possible for user space to use the pool
     * in a way where always waiting === 0,
     * since we want to avoid creating tasks that can't execute
     * immediately in order to provide back pressure to the task source.
     */
    const { maxCapacity } = this;
    const currentUsage = this.workers.getCurrentUsage();

    if (maxCapacity === currentUsage) {
      this._needsDrain = true;
      queueMicrotask(() => this.publicInterface.emit('needsDrain'));
    } else if (maxCapacity > currentUsage && this._needsDrain) {
      this._needsDrain = false;
      queueMicrotask(() => this.publicInterface.emit('drain'));
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

        this.workers.onTaskDone(checkIfWorkerIsDone);
      }
    });

    const throwOnTimeOut = async (timeout: number) => {
      await sleep(timeout, null, { ref: false });
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
  #histogram: PiscinaHistogram | null = null;

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
    if (options.atomics != null && (typeof options.atomics !== 'string' ||
        !['sync', 'async', 'disabled'].includes(options.atomics))) {
      throw new TypeError('options.atomics should be a value of sync, sync or disabled.');
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
    if (options.loadBalancer !== undefined && (typeof options.loadBalancer !== 'function' || options.loadBalancer.length < 1)) {
      throw new TypeError('options.loadBalancer must be a function with at least two args');
    }
    if (options.workerHistogram !== undefined && (typeof options.workerHistogram !== 'boolean')) {
      throw new TypeError('options.workerHistogram must be a boolean');
    }

    this.#pool = new ThreadPool(this, options);
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

  [Symbol.dispose]() {
    this.close();
  }

  [Symbol.asyncDispose]() {
    return this.close();
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

  get histogram () : PiscinaHistogram {
    if (this.#histogram == null) {
      const piscinahistogram = {
        // @ts-expect-error
        get runTime() { return this.histogram?.runTimeSummary! },
        // @ts-expect-error
        get waitTime() { return this.histogram?.waitTimeSummary! },
        resetRunTime() {
          // @ts-expect-error
          this.histogram?.resetRunTime()
        },
        resetWaitTime() {
          // @ts-expect-error
          this.histogram?.resetWaitTime()
        },
      }
  
      Object.defineProperty(piscinahistogram, 'histogram', {
        value: this.#pool.histogram,
        writable: false,
        enumerable: false,
        configurable: false,
      })
  
      this.#histogram = piscinahistogram;
    };

    return this.#histogram;
  }

  get utilization () : number {
    if (this.#pool.histogram == null) {
      return 0;
    }

    // count is available as of Node.js v16.14.0 but not present in the types
    const count = this.#pool.histogram.runTimeCount;

    if (count === 0) {
      return 0;
    }

    // The capacity is the max compute time capacity of the
    // pool to this point in time as determined by the length
    // of time the pool has been running multiplied by the
    // maximum number of threads.
    const capacity = this.duration * this.#pool.options.maxThreads;
    const totalMeanRuntime = (this.#pool.histogram.runTimeSummary.mean / 1000) * count;

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
    return this.#pool._needsDrain;
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
