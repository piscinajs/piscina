import { fileURLToPath, URL } from 'node:url';
import { availableParallelism } from 'node:os';

import { kMovable, kTransferable, kValue } from './symbols';

// States wether the worker is ready to receive tasks
export const READY = '_WORKER_READY';

/**
 * True if the object implements the Transferable interface
 *
 * @export
 * @param {unknown} value
 * @return {*}  {boolean}
 */
export function isTransferable (value: unknown): boolean {
  return (
    value != null &&
    typeof value === 'object' &&
    kTransferable in value &&
    kValue in value
  );
}

/**
 * True if object implements Transferable and has been returned
 * by the Piscina.move() function
 *
 * TODO: narrow down the type of value
 * @export
 * @param {(unknown & PiscinaMovable)} value
 * @return {*}  {boolean}
 */
export function isMovable (value: any): boolean {
  return isTransferable(value) && value[kMovable] === true;
}

export function markMovable (value: {}): void {
  Object.defineProperty(value, kMovable, {
    enumerable: false,
    configurable: true,
    writable: true,
    value: true
  });
}

// State of Piscina pool
export const commonState = {
  isWorkerThread: false,
  workerData: undefined
};

export function maybeFileURLToPath (filename : string) : string {
  return filename.startsWith('file:')
    ? fileURLToPath(new URL(filename))
    : filename;
}

export function getAvailableParallelism () : number {
  return availableParallelism();
}
