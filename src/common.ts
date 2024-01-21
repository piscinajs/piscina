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
  [READY]: true
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

export interface ThreadWorker extends AsynchronouslyCreatedResource {
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
