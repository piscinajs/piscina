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
  
  // Map from affinity key to preferred worker
  const affinityMap = new Map<number, PiscinaWorker>();

  return (task, workers) => {
    // Extract affinity key from task queue options
    const queueOptions = task[kQueueOptions] as { affinityKey?: unknown } | undefined;
    const affinityKey = queueOptions?.affinityKey;

    // If no affinity key or it's null/undefined, use LeastBusy behavior
    if (affinityKey == null) {
      return leastBusySelect(task, workers, maximumUsage);
    }

    // Validate affinity key is a finite integer
    if (
      typeof affinityKey !== 'number' ||
      !Number.isFinite(affinityKey) ||
      !Number.isInteger(affinityKey)
    ) {
      return leastBusySelect(task, workers, maximumUsage);
    }

    // Try to get the preferred worker for this affinity key
    let preferredWorker = affinityMap.get(affinityKey);

    // Check if preferred worker still exists and is available
    if (preferredWorker !== undefined) {
      if (workers.includes(preferredWorker) && preferredWorker.currentUsage < maximumUsage) {
        // Preferred worker is available, use it
        return preferredWorker;
      }
    }

    // Preferred worker is not available or saturated, find another worker using LeastBusy logic
    const candidate = leastBusySelect(task, workers, maximumUsage);
    
    // If we found a candidate, update the affinity mapping to the new worker
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