import { channel } from 'node:diagnostics_channel';

import type Piscina from './index';
import type { PiscinaTask } from './task_queue';
import type { PiscinaWorker } from './worker_pool';

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
  readonly reason: Error;
}

export interface PiscinaDrainMessage {
  readonly pool: Piscina;
}

/** Names of the `node:diagnostics_channel` channels that Piscina publishes on. */
export const channels = {
  taskSubmit: 'piscina:task:submit',
  taskStart: 'piscina:task:start',
  taskDone: 'piscina:task:done',
  newWorker: 'piscina:pool:new_worker',
  evictWorker: 'piscina:pool:evict_worker',
  drain: 'piscina:pool:drain'
} as const;

export const taskSubmitChannel = channel(channels.taskSubmit);
export const taskStartChannel = channel(channels.taskStart);
export const taskDoneChannel = channel(channels.taskDone);
export const newWorkerChannel = channel(channels.newWorker);
export const evictWorkerChannel = channel(channels.evictWorker);
export const drainChannel = channel(channels.drain);
