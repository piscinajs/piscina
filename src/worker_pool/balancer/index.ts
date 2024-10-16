import type { PiscinaTask } from '../../task_queue';
import type { PiscinaWorker } from '..';

export type PiscinaTaskBalancer = (
  task: PiscinaTask,
  workers: PiscinaWorker[]
) => PiscinaWorker | null; // If candidate is passed, it will be used as the result of the load balancer and ingore the command;

export type ResourceBasedBalancerOptions = {
  maximumUsage: number;
};
export function ResourceBasedBalancer (
  opts: ResourceBasedBalancerOptions
): PiscinaTaskBalancer {
  const { maximumUsage } = opts;

  return (task, workers) => {
    let candidate: PiscinaWorker | null = null;
    let checkpoint = maximumUsage;
    for (const worker of workers) {
      if (worker.currentUsage === 0) {
        candidate = worker;
        break;
      }

      if (worker.isRunningAbortableTask) continue;

      if (
        !task.isAbortable &&
        (worker.currentUsage < checkpoint)
      ) {
        candidate = worker;
        checkpoint = worker.currentUsage;
      }
    }

    return candidate;
  };
}
