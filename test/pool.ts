import { resolve } from 'node:path';

import { test } from 'tap';

import Piscina from '../dist';

test('workerCreate/workerDestroy should be emitted while managing worker lifecycle', async t => {
  let index = 0;
  t.plan(2);
  let newWorkers = 0;
  let destroyedWorkers = 0;
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 2,
    minThreads: 2,
    concurrentTasksPerWorker: 1,
    loadBalancer (_task, workers) {
      // Verify distribution to properly test this feature
      const candidate = workers[index++ % workers.length];
      if (candidate != null && candidate.currentUsage >= 1) {
        return {
          candidate: null,
          command: 1
        };
      }

      return {
        candidate,
        command: 1
      };
    }
  });

  pool.on('workerCreate', () => {
    newWorkers++;
  });

  pool.on('workerDestroy', () => {
    destroyedWorkers++;
  });

  const tasks = [];
  const controller = new AbortController();
  const signal = controller.signal;
  tasks.push(pool.run('while (true) {}', {
    signal
  }));

  for (let n = 0; n < 10; n++) {
    tasks.push(pool.run('new Promise(resolve => setTimeout(resolve, 500))'));
  }

  controller.abort();
  await Promise.allSettled(tasks);
  await pool.close();
  // 1 worker is created for the initial task
  // 2 workers are created for the 2 concurrent tasks
  // 3 worker is destroyed due to an abortable task, and a new one is made
  t.equal(destroyedWorkers, 3);
  t.equal(newWorkers, 3);
});
