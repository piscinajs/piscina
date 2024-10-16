import { resolve } from 'node:path';

import { test } from 'tap';

import Piscina from '../dist';

test('workerCreate/workerDestroy should be emitted while managing worker lifecycle', async t => {
  let index = 0;
  // Its expected to have one task get balanced twice due to the load balancer distribution
  // first task enters, its distributed; second is enqueued, once first is done, second is distributed and normalizes
  t.plan(2);
  let newWorkers = 0;
  let destroyedWorkers = 0;
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 3,
    minThreads: 3,
    concurrentTasksPerWorker: 1,
    loadBalancer (_task, workers) {
      // Verify distribution to properly test this feature
      const candidate = workers[index++ % workers.length];
      if (candidate != null && candidate.currentUsage >= 1) {
        return null;
      }

      return candidate;
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
  t.equal(destroyedWorkers, 4);
  t.equal(newWorkers, 4);
});
