import { PiscinaWorker, PiscinaTask } from './common';

export type PiscinaBalancerContext = {
  workers: PiscinaWorker[],
  minThreads: number;
  maxThreads: number;
  concurrentTasksPerWorker: number;
  maxQueue: number;
};

export type PiscinaBalancer = (
  task: PiscinaTask,
  context: PiscinaBalancerContext
) => PiscinaWorker | null;

// Idea for an alternative scheduler
/**
 * 0 =  enqueue
 * 1 =  spawn new worker
 * worker = the candidate worker
 */
// export type PiscinaSchedulerSignal = 0 | 1;

export function defaultBalancer (
  task: PiscinaTask,
  context: PiscinaBalancerContext
): PiscinaWorker | null {
  const { concurrentTasksPerWorker, workers } = context;

  let minUsage = concurrentTasksPerWorker;
  let candidate = null;
  for (const item of workers) {
    const usage = item.usage;
    if (usage === 0) return item;

    if (!task.isAbortable && usage < minUsage) {
      candidate = item;
      minUsage = usage;
    }
  }

  return candidate;
}
