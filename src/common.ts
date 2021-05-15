import type { MessagePort } from 'worker_threads';

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
  ready: true
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
  readonly [kQueueOptions] : object | null;
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
