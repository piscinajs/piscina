import { Worker, MessageChannel, MessagePort, receiveMessageOnPort } from 'worker_threads';
import { once } from 'events';
import EventEmitterAsyncResource from 'eventemitter-asyncresource';
import { AsyncResource } from 'async_hooks';
import { cpus } from 'os';
import { fileURLToPath, URL } from 'url';
import { resolve } from 'path';
import { inspect, types } from 'util';
import assert from 'assert';
import { Histogram, build } from 'hdr-histogram-js';
import { performance } from 'perf_hooks';
import hdrobj from 'hdr-histogram-percentiles-obj';
import {
  READY,
  RequestMessage,
  ResponseMessage,
  StartupMessage,
  commonState,
  kResponseCountField,
  kRequestCountField,
  kFieldCount,
  Transferable,
  Task,
  TaskQueue,
  kQueueOptions,
  isTaskQueue,
  isTransferable,
  markMovable,
  isMovable,
  kTransferable,
  kValue
} from './common';
import { version } from '../package.json';

const cpuCount : number = (() => {
  try {
    return cpus().length;
  } catch {
    /* istanbul ignore next */
    return 1;
  }
})();

interface AbortSignalEventTargetAddOptions {
  once : boolean;
};

interface AbortSignalEventTarget {
  addEventListener : (
    name : 'abort',
    listener : () => void,
    options? : AbortSignalEventTargetAddOptions) => void;
  removeEventListener : (
    name : 'abort',
    listener : () => void) => void;
  aborted? : boolean;
}
interface AbortSignalEventEmitter {
  off : (name : 'abort', listener : () => void) => void;
  once : (name : 'abort', listener : () => void) => void;
}
type AbortSignalAny = AbortSignalEventTarget | AbortSignalEventEmitter;
function onabort (abortSignal : AbortSignalAny, listener : () => void) {
  if ('addEventListener' in abortSignal) {
    abortSignal.addEventListener('abort', listener, { once: true });
  } else {
    abortSignal.once('abort', listener);
  }
}
class AbortError extends Error {
  constructor () {
    super('The task has been aborted');
  }

  get name () { return 'AbortError'; }
}

type ResourceLimits = Worker extends {
  resourceLimits? : infer T;
} ? T : {};
type EnvSpecifier = typeof Worker extends {
  new (filename : never, options?: { env: infer T }) : Worker;
} ? T : never;

class ArrayTaskQueue implements TaskQueue {
  tasks : Task[] = [];

  get size () { return this.tasks.length; }

  shift () : Task | null {
    return this.tasks.shift() as Task;
  }

  push (task : Task) : void {
    this.tasks.push(task);
  }

  remove (task : Task) : void {
    const index = this.tasks.indexOf(task);
    assert.notStrictEqual(index, -1);
    this.tasks.splice(index, 1);
  }
}

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
  niceIncrement : number
}

const kDefaultOptions : FilledOptions = {
  filename: null,
  name: 'default',
  minThreads: Math.max(cpuCount / 2, 1),
  maxThreads: cpuCount * 1.5,
  idleTimeout: 0,
  maxQueue: Infinity,
  concurrentTasksPerWorker: 1,
  useAtomics: true,
  taskQueue: new ArrayTaskQueue(),
  niceIncrement: 0,
  trackUnmanagedFds: true
};

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

const kDefaultRunOptions : FilledRunOptions = {
  transferList: undefined,
  filename: null,
  signal: null,
  name: null
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

let taskIdCounter = 0;

type TaskCallback = (err : Error, result: any) => void;
// Grab the type of `transferList` off `MessagePort`. At the time of writing,
// only ArrayBuffer and MessagePort are valid, but let's avoid having to update
// our types here every time Node.js adds support for more objects.
type TransferList = MessagePort extends { postMessage(value : any, transferList : infer T) : any; } ? T : never;
type TransferListItem = TransferList extends (infer T)[] ? T : never;

function maybeFileURLToPath (filename : string) : string {
  return filename.startsWith('file:')
    ? fileURLToPath(new URL(filename))
    : filename;
}

// Extend AsyncResource so that async relations between posting a task and
// receiving its result are visible to diagnostic tools.
class TaskInfo extends AsyncResource implements Task {
  callback : TaskCallback;
  task : any;
  transferList : TransferList;
  filename : string;
  name : string;
  taskId : number;
  abortSignal : AbortSignalAny | null;
  abortListener : (() => void) | null = null;
  workerInfo : WorkerInfo | null = null;
  created : number;
  started : number;

  constructor (
    task : any,
    transferList : TransferList,
    filename : string,
    name : string,
    callback : TaskCallback,
    abortSignal : AbortSignalAny | null,
    triggerAsyncId : number) {
    super('Piscina.Task', { requireManualDestroy: true, triggerAsyncId });
    this.callback = callback;
    this.task = task;
    this.transferList = transferList;

    // If the task is a Transferable returned by
    // Piscina.move(), then add it to the transferList
    // automatically
    if (isMovable(task)) {
      // This condition should never be hit but typescript
      // complains if we dont do the check.
      /* istanbul ignore if */
      if (this.transferList == null) {
        this.transferList = [];
      }
      this.transferList =
        this.transferList.concat(task[kTransferable]);
      this.task = task[kValue];
    }

    this.filename = filename;
    this.name = name;
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
    // If an abort signal was used, remove the listener from it when
    // done to make sure we do not accidentally leak.
    if (this.abortSignal && this.abortListener) {
      if ('removeEventListener' in this.abortSignal && this.abortListener) {
        this.abortSignal.removeEventListener('abort', this.abortListener);
      } else {
        (this.abortSignal as AbortSignalEventEmitter).off(
          'abort', this.abortListener);
      }
    }
  }

  get [kQueueOptions] () : object | null {
    return kQueueOptions in this.task ? this.task[kQueueOptions] : null;
  }
}

abstract class AsynchronouslyCreatedResource {
  onreadyListeners : (() => void)[] | null = [];

  markAsReady () : void {
    const listeners = this.onreadyListeners;
    assert(listeners !== null);
    this.onreadyListeners = null;
    for (const listener of listeners) {
      listener();
    }
  }

  isReady () : boolean {
    return this.onreadyListeners === null;
  }

  onReady (fn : () => void) {
    if (this.onreadyListeners === null) {
      fn(); // Zalgo is okay here.
      return;
    }
    this.onreadyListeners.push(fn);
  }

  abstract currentUsage() : number;
}

class AsynchronouslyCreatedResourcePool<
  T extends AsynchronouslyCreatedResource> {
  pendingItems = new Set<T>();
  readyItems = new Set<T>();
  maximumUsage : number;
  onAvailableListeners : ((item : T) => void)[];

  constructor (maximumUsage : number) {
    this.maximumUsage = maximumUsage;
    this.onAvailableListeners = [];
  }

  add (item : T) {
    this.pendingItems.add(item);
    item.onReady(() => {
      /* istanbul ignore else */
      if (this.pendingItems.has(item)) {
        this.pendingItems.delete(item);
        this.readyItems.add(item);
        this.maybeAvailable(item);
      }
    });
  }

  delete (item : T) {
    this.pendingItems.delete(item);
    this.readyItems.delete(item);
  }

  findAvailable () : T | null {
    let minUsage = this.maximumUsage;
    let candidate = null;
    for (const item of this.readyItems) {
      const usage = item.currentUsage();
      if (usage === 0) return item;
      if (usage < minUsage) {
        candidate = item;
        minUsage = usage;
      }
    }
    return candidate;
  }

  * [Symbol.iterator] () {
    yield * this.pendingItems;
    yield * this.readyItems;
  }

  get size () {
    return this.pendingItems.size + this.readyItems.size;
  }

  maybeAvailable (item : T) {
    /* istanbul ignore else */
    if (item.currentUsage() < this.maximumUsage) {
      for (const listener of this.onAvailableListeners) {
        listener(item);
      }
    }
  }

  onAvailable (fn : (item : T) => void) {
    this.onAvailableListeners.push(fn);
  }
}

type ResponseCallback = (response : ResponseMessage) => void;

const Errors = {
  ThreadTermination:
    () => new Error('Terminating worker thread'),
  FilenameNotProvided:
    () => new Error('filename must be provided to run() or in options object'),
  TaskQueueAtLimit:
    () => new Error('Task queue is at limit'),
  NoTaskQueueAvailable:
    () => new Error('No task queue available and all Workers are busy')
};

class WorkerInfo extends AsynchronouslyCreatedResource {
  worker : Worker;
  taskInfos : Map<number, TaskInfo>;
  idleTimeout : NodeJS.Timeout | null = null; // eslint-disable-line no-undef
  port : MessagePort;
  sharedBuffer : Int32Array;
  lastSeenResponseCount : number = 0;
  onMessage : ResponseCallback;

  constructor (
    worker : Worker,
    port : MessagePort,
    onMessage : ResponseCallback) {
    super();
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
    this.port.close();
    this.clearIdleTimeout();
    for (const taskInfo of this.taskInfos.values()) {
      taskInfo.done(Errors.ThreadTermination());
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
    this.port.ref();
    return this;
  }

  unref () : WorkerInfo {
    // Note: Do not call ref()/unref() on the Worker itself since that may cause
    // a hard crash, see https://github.com/nodejs/node/pull/33394.
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
      filename: taskInfo.filename,
      name: taskInfo.name
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

  currentUsage () : number {
    if (this.isRunningAbortableTask()) return Infinity;
    return this.taskInfos.size;
  }
}

class ThreadPool {
  publicInterface : Piscina;
  workers : AsynchronouslyCreatedResourcePool<WorkerInfo>;
  options : FilledOptions;
  taskQueue : TaskQueue;
  skipQueue : TaskInfo[] = [];
  completed : number = 0;
  runTime : Histogram;
  waitTime : Histogram;
  start : number = performance.now();
  inProcessPendingMessages : boolean = false;
  startingUp : boolean = false;
  workerFailsDuringBootstrap : boolean = false;

  constructor (publicInterface : Piscina, options : Options) {
    this.publicInterface = publicInterface;
    this.taskQueue = options.taskQueue || new ArrayTaskQueue();
    this.runTime = build({ lowestDiscernibleValue: 1 });
    this.waitTime = build({ lowestDiscernibleValue: 1 });

    const filename =
      options.filename ? maybeFileURLToPath(options.filename) : null;
    this.options = { ...kDefaultOptions, ...options, filename, maxQueue: 0 };
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
  }

  _ensureMinimumWorkers () : void {
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
      // Work around the bug in https://github.com/nodejs/node/pull/33394
      worker.ref = () => {};

      // In case of an uncaught exception: Call the callback that was passed to
      // `postTask` with the error, or emit an 'error' event if there is none.
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
        for (const taskInfo of taskInfos) {
          taskInfo.done(err, null);
        }
      } else {
        this.publicInterface.emit('error', err);
      }
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
      this.waitTime.recordValue(now - taskInfo.created);
      taskInfo.started = now;
      workerInfo.postTask(taskInfo);
      this._maybeDrain();
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
      transferList = [],
      signal = null
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
          this.runTime.recordValue(performance.now() - taskInfo.started);
        }
        if (err !== null) {
          reject(err);
        } else {
          resolve(result);
        }
      },
      signal,
      this.publicInterface.asyncResource.asyncId());

    if (signal !== null) {
      // If the AbortSignal has an aborted property and it's truthy,
      // reject immediately.
      if ((signal as AbortSignalEventTarget).aborted) {
        return Promise.reject(new AbortError());
      }
      taskInfo.abortListener = () => {
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

      return ret;
    }

    // TODO(addaleax): Clean up the waitTime/runTime recording.
    const now = performance.now();
    this.waitTime.recordValue(now - taskInfo.created);
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
    if (this.taskQueue.size === 0 && this.skipQueue.length === 0) {
      this.publicInterface.emit('drain');
    }
  }

  async destroy () {
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

    await Promise.all(exitEvents);
  }
}

class Piscina extends EventEmitterAsyncResource {
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
        (typeof options.niceIncrement !== 'number' || options.niceIncrement < 0)) {
      throw new TypeError('options.niceIncrement must be a non-negative integer');
    }
    if (options.trackUnmanagedFds !== undefined &&
        typeof options.trackUnmanagedFds !== 'boolean') {
      throw new TypeError('options.trackUnmanagedFds must be a boolean value');
    }

    this.#pool = new ThreadPool(this, options);
  }

  /** @deprecated Use run(task, options) instead **/
  runTask (task : any, transferList? : TransferList, filename? : string, abortSignal? : AbortSignalAny) : Promise<any>;

  /** @deprecated Use run(task, options) instead **/
  runTask (task : any, transferList? : TransferList, filename? : AbortSignalAny, abortSignal? : undefined) : Promise<any>;

  /** @deprecated Use run(task, options) instead **/
  runTask (task : any, transferList? : string, filename? : AbortSignalAny, abortSignal? : undefined) : Promise<any>;

  /** @deprecated Use run(task, options) instead **/
  runTask (task : any, transferList? : AbortSignalAny, filename? : undefined, abortSignal? : undefined) : Promise<any>;

  /** @deprecated Use run(task, options) instead **/
  runTask (task : any, transferList? : any, filename? : any, signal? : any) {
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

  run (task : any, options : RunOptions = kDefaultRunOptions) {
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
    const result = hdrobj.histAsObj(this.#pool.waitTime);
    return hdrobj.addPercentiles(this.#pool.waitTime, result);
  }

  get runTime () : any {
    const result = hdrobj.histAsObj(this.#pool.runTime);
    return hdrobj.addPercentiles(this.#pool.runTime, result);
  }

  get utilization () : number {
    // The capacity is the max compute time capacity of the
    // pool to this point in time as determined by the length
    // of time the pool has been running multiplied by the
    // maximum number of threads.
    const capacity = this.duration * this.#pool.options.maxThreads;
    const totalMeanRuntime = this.#pool.runTime.mean *
      this.#pool.runTime.totalCount;

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

export = Piscina;
