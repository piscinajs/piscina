import type { PiscinaTask } from '../../task_queue';
import type { PiscinaWorker } from '..';
import { kQueueOptions } from '../../symbols';

export type PiscinaLoadBalancer = (
  task: PiscinaTask,
  workers: PiscinaWorker[]
) => PiscinaWorker | null; // If candidate is passed, it will be used as the result of the load balancer and ingore the command;

export type LeastBusyBalancerOptions = {
  maximumUsage: number;
};
export function LeastBusyBalancer (
  opts: LeastBusyBalancerOptions
): PiscinaLoadBalancer {
  const { maximumUsage } = opts;

  return (task, workers) => {
    return leastBusySelect(task, workers, maximumUsage);
  };
}

export type AffinityBalancerOptions = {
  maximumUsage: number;
};

export function AffinityBalancer (
  opts: AffinityBalancerOptions
): PiscinaLoadBalancer {
  const { maximumUsage } = opts;
  
  // Map from affinity key to preferred worker.
  // We validate that the worker is still available before using it.
  const affinityMap = new Map<number, PiscinaWorker>();

  return (task, workers) => {
    // Extract affinity key from task queue options.
    const queueOptions = task[kQueueOptions] as { affinityKey?: unknown } | undefined;
    const affinityKey = queueOptions?.affinityKey;

    // If no affinity key (null, undefined, etc), use LeastBusy behavior.
    if (affinityKey == null) {
      return leastBusySelect(task, workers, maximumUsage);
    }

    // Validate affinity key is a finite integer. Any other type falls back to LeastBusy.
    // This includes: strings (empty or non-empty), floats, NaN, Infinity, objects, etc.
    if (
      typeof affinityKey !== 'number' ||
      !Number.isFinite(affinityKey) ||
      !Number.isInteger(affinityKey)
    ) {
      return leastBusySelect(task, workers, maximumUsage);
    }

    // Try to use the preferred worker for this affinity key.
    let preferredWorker = affinityMap.get(affinityKey);

    // Validate the preferred worker is still valid and available.
    // A worker becomes invalid if it's been destroyed, terminated, or removed from the pool.
    if (preferredWorker !== undefined) {
      if (!preferredWorker.destroyed && !preferredWorker.terminating && workers.includes(preferredWorker) && preferredWorker.currentUsage < maximumUsage) {
        // Preferred worker is valid and available, use it.
        return preferredWorker;
      } else {
        // Worker is no longer valid, clean up the stale entry.
        affinityMap.delete(affinityKey);
      }
    }

    // Either no preferred worker exists or it became unavailable.
    // Use LeastBusy logic to find a candidate worker.
    const candidate = leastBusySelect(task, workers, maximumUsage);
    
    // If we found a candidate, remember it as the preferred worker for this key.
    if (candidate !== null) {
      affinityMap.set(affinityKey, candidate);
    }

    return candidate;
  };
}

// Helper function that implements LeastBusy selection logic
function leastBusySelect(
  task: PiscinaTask,
  workers: PiscinaWorker[],
  maximumUsage: number
): PiscinaWorker | null {
  let candidate: PiscinaWorker | null = null;
  let checkpoint = maximumUsage;
  
  for (const worker of workers) {
    if (worker.currentUsage === 0) {
      candidate = worker;
      break;
    }

    if (worker.isRunningAbortableTask) continue;

    if (
      task.isAbortable === false &&
      (worker.currentUsage < checkpoint)
    ) {
      candidate = worker;
      checkpoint = worker.currentUsage;
    }
  }

  return candidate;
}