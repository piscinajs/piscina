import { channel } from 'node:diagnostics_channel';

import type Piscina from './index';
import type { PiscinaTask } from './task_queue';
import type { PiscinaWorker } from './worker_pool';

export type PiscinaWorkerEvictReason = 'idle' | 'abort' | 'error' | 'destroy';

export interface PiscinaTaskSubmitMessage {
  readonly pool: Piscina;
  readonly task: PiscinaTask;
  readonly queueSize: number;
}

export interface PiscinaTaskStartMessage {
  readonly pool: Piscina;
  readonly task: PiscinaTask;
  readonly worker: PiscinaWorker;
  readonly workerReady: boolean;
}

export interface PiscinaTaskDoneMessage {
  readonly pool: Piscina;
  readonly task: PiscinaTask;
  readonly queued: boolean;
  readonly started: boolean;
  readonly waitTime: number | null;
  readonly runTime: number | null;
  readonly error: unknown;
  readonly aborted: boolean;
  readonly queueSize: number;
  readonly idleThreads: number;
}

export interface PiscinaNewWorkerMessage {
  readonly pool: Piscina;
  readonly worker: PiscinaWorker;
}

export interface PiscinaEvictWorkerMessage {
  readonly pool: Piscina;
  readonly worker: PiscinaWorker;
  readonly reason: PiscinaWorkerEvictReason;
}

export interface PiscinaDrainMessage {
  readonly pool: Piscina;
}

export const taskSubmitChannel = channel('piscina:task:submit');
export const taskStartChannel = channel('piscina:task:start');
export const taskDoneChannel = channel('piscina:task:done');
export const newWorkerChannel = channel('piscina:pool:new_worker');
export const evictWorkerChannel = channel('piscina:pool:evict_worker');
export const drainChannel = channel('piscina:pool:drain');
