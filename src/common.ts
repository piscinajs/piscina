import assert from 'assert';
import type { MessagePort } from 'worker_threads';

export const READY = '_WORKER_READY';

export interface StartupMessage {
  filename : string | null;
  name : string;
  port : MessagePort;
  sharedBuffer : Int32Array;
  useAtomics : boolean;
  niceIncrement : number;
}

export interface RequestMessage {
  taskId : number;
  task : any;
  filename: string;
  name : string;
}

export interface ReadyMessage {
  [READY]: boolean;
  error: Error | null;
};

export interface ResponseMessage {
  taskId : number;
  result : any;
  error: Error | null;
}
export const commonState = {
  isWorkerThread: false,
  workerData: undefined
};

export interface AbortSignalEventTargetAddOptions {
  once : boolean;
};

export interface AbortSignalEventTarget {
  addEventListener : (
    name : 'abort',
    listener : () => void,
    options? : AbortSignalEventTargetAddOptions) => void;
  removeEventListener : (
    name : 'abort',
    listener : () => void) => void;
  aborted? : boolean;
  reason?: unknown;
}
export interface AbortSignalEventEmitter {
  off : (name : 'abort', listener : () => void) => void;
  once : (name : 'abort', listener : () => void) => void;
}

export type AbortSignalAny = AbortSignalEventTarget | AbortSignalEventEmitter;

export type TaskCallback = (err : Error, result: any) => void;
// Grab the type of `transferList` off `MessagePort`. At the time of writing,
// only ArrayBuffer and MessagePort are valid, but let's avoid having to update
// our types here every time Node.js adds support for more objects.
export type TransferList = MessagePort extends { postMessage(value : any, transferList : infer T) : any; } ? T : never;
export type TransferListItem = TransferList extends (infer T)[] ? T : never;

export interface RunOptions {
  transferList? : TransferList,
  filename? : string | null,
  signal? : AbortSignalAny | null,
  name? : string | null
}

// Internal symbol used to mark Transferable objects returned
// by the Piscina.move() function
const kMovable = Symbol('Piscina.kMovable');
export const kTransferable = Symbol.for('Piscina.transferable');
export const kValue = Symbol.for('Piscina.valueOf');
export const kQueueOptions = Symbol.for('Piscina.queueOptions');

// True if the object implements the Transferable interface
export function isTransferable (value : any) : boolean {
  return value != null &&
         typeof value === 'object' &&
         kTransferable in value &&
         kValue in value;
}

// True if object implements Transferable and has been returned
// by the Piscina.move() function
export function isMovable (value : any) : boolean {
  return isTransferable(value) && value[kMovable] === true;
}

export function markMovable (value : object) : void {
  Object.defineProperty(value, kMovable, {
    enumerable: false,
    configurable: true,
    writable: true,
    value: true
  });
}

export interface Transferable {
  readonly [kTransferable] : object;
  readonly [kValue] : object;
}

export interface Task {
  readonly [kQueueOptions] : {} | null;
  filename: string;
  name: string;
  taskId: number;
}

export abstract class AsynchronouslyCreatedResource {
  onreadyListeners : ((err?: Error | null) => void)[] | null = [];
  #ready: boolean = false;

  markAsReady (err: Error | null) : void {
    if (this.#ready || this.onreadyListeners == null) {
      return;
    }

    const listeners = this.onreadyListeners;
    // assert(listeners !== null);
    this.onreadyListeners = null;
    this.#ready = err == null;
    if (listeners !== null) {
      for (const listener of listeners) {
        listener(err);
      }
    }
  }

  isReady () : boolean {
    return this.#ready;
  }

  // TODO: add tests for this
  onReady (fn : (err?: Error | null) => void) {
    if (this.isReady()) {
      fn();
      return;
    }
    this.onreadyListeners?.push(fn);
  }

  abstract currentUsage() : number;
}

export interface ThreadWorker extends AsynchronouslyCreatedResource {
  id: number;
  destroyed: boolean;
  taskInfos: Map<number, Task>;
  port: MessagePort;
  idleTimeout: NodeJS.Timeout | null; // eslint-disable-line no-undef
  processPendingMessages(): void;
  destroy(): void;
  ref(): ThreadWorker;
  unref(): ThreadWorker;
  isRunningAbortableTask(): boolean;
  currentUsage(): number;
}

export interface TaskQueue {
  readonly size : number;
  shift () : Task | null;
  remove (task : Task) : void;
  push (task : Task) : void;
}

export function isTaskQueue (value : any) : boolean {
  return typeof value === 'object' &&
         value !== null &&
         'size' in value &&
         typeof value.shift === 'function' &&
         typeof value.remove === 'function' &&
         typeof value.push === 'function';
}

export const kRequestCountField = 0;
export const kResponseCountField = 1;
export const kFieldCount = 2;
