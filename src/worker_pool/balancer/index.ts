import type { PiscinaTask } from '../../task_queue';
import type { PiscinaWorker } from '..';

export type PiscinaLoadBalancerCommand = {
  candidate?: PiscinaWorker | null; // If candidate is passed, it will be used as the result of the load balancer and ingore the command
  command?: 0 | 1; // 1 = add, 0 = busy
};
export type PisicnaLoadBalancer = (
  task: PiscinaTask,
  workers: PiscinaWorker[]
) => PiscinaLoadBalancerCommand;

export type ResourceBasedBalancerOptions = {
  maximumUsage: number;
};
export function ResourceBasedBalancer (
  opts: ResourceBasedBalancerOptions
): PisicnaLoadBalancer {
  const { maximumUsage } = opts;

  return (task, workers) => {
    const command: PiscinaLoadBalancerCommand = { candidate: null, command: 1 };
    let minUsage = maximumUsage;
    for (const worker of workers) {
      if (worker.currentUsage === 0) {
        command.candidate = worker;
        break;
      }

      if (worker.isRunningAbortableTask) continue;

      if (
        !task.isAbortable &&
        (!command.candidate || worker.currentUsage < minUsage)
      ) {
        command.candidate = worker;
        minUsage = worker.currentUsage;
      }
    }

    return command;
  };
}
