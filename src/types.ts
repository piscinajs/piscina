import type { MessagePort, Worker } from 'node:worker_threads';

import type { READY } from './common';
import type { kTransferable, kValue } from './symbols';

export interface StartupMessage {
  filename: string | null
  name: string
  port: MessagePort
  sharedBuffer: Int32Array
  useAtomics: boolean
  niceIncrement: number
}

export interface RequestMessage {
  taskId: number
  task: any
  filename: string
  name: string
}

export interface ReadyMessage {
  [READY]: true
}

export interface ResponseMessage {
  taskId: number
  result: any
  error: Error | null
}
export const commonState = {
  isWorkerThread: false,
  workerData: undefined
};

export interface Transferable {
  readonly [kTransferable]: object;
  readonly [kValue]: object;
}

/* eslint-disable camelcase */
export interface HistogramSummary {
  average: number;
  mean: number;
  stddev: number;
  min: number;
  max: number;
  p0_001: number;
  p0_01: number;
  p0_1: number;
  p1: number;
  p2_5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p97_5: number;
  p99: number;
  p99_9: number;
  p99_99: number;
  p99_999: number;
}
/* eslint-enable camelcase */

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
