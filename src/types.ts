import type { MessagePort, Worker } from 'node:worker_threads';

import type { READY } from './common';
import type { kTransferable, kValue } from './symbols';

export interface StartupMessage {
  filename: string | null
  name: string
  port: MessagePort
  sharedBuffer: Int32Array
  atomics: 'async' | 'sync' | 'disabled'
  niceIncrement: number
}

export interface RequestMessage {
  taskId: number
  task: any
  filename: string
  name: string
  histogramEnabled: number
}

export interface ReadyMessage {
  [READY]: true
}

export interface ResponseMessage {
  taskId: number
  result: any
  error: Error | null
  time: number | null
}
export const commonState = {
  isWorkerThread: false,
  workerData: undefined
};

export interface Transferable {
  readonly [kTransferable]: object;
  readonly [kValue]: object;
}

export type ResourceLimits = Worker extends {
  resourceLimits?: infer T;
}
  ? T
  : {};
export type EnvSpecifier = typeof Worker extends {
  new (filename: never, options?: { env: infer T }): Worker;
}
  ? T
  : never;
