import { resolve } from 'node:path';

import { test } from 'node:test';
import type { TestContext } from 'node:test';

import Piscina from '../dist';

test('workers are marked as destroyed if destroyed', async (t: TestContext) => {
  let index = 0;
  // Its expected to have one task get balanced twice due to the load balancer distribution
  // first task enters, its distributed; second is enqueued, once first is done, second is distributed and normalizes
  t.plan(4);
  let workersFirstRound = [];
  let workersSecondRound = [];
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 2,
    maxThreads: 2,
    concurrentTasksPerWorker: 1,
    loadBalancer (_task, workers) {
      if (workersFirstRound.length === 0) {
        workersFirstRound = workers;
        workersSecondRound = workers;
      } else if (
        workersFirstRound[0].id !== workers[0].id
      ) {
        workersSecondRound = workers;
      }
      // Verify distribution to properly test this feature
      const candidate = workers[index++ % workers.length];

      if (candidate.currentUsage !== 0 && !candidate.isRunningAbortableTask) {
        return null;
      }

      return candidate;
    }
  });

  const tasks = [];
  const controller = new AbortController();
  const signal = controller.signal;
  tasks.push(pool.run('while (true) {}', {
    signal
  }));

  for (let n = 0; n < 5; n++) {
    tasks.push(pool.run('new Promise(resolve => setTimeout(resolve, 500))'));
  }

  controller.abort();
  await Promise.allSettled(tasks);
  t.assert.notStrictEqual(workersFirstRound, workersSecondRound);
  t.assert.strictEqual(workersFirstRound.length, 2);
  t.assert.ok(workersFirstRound[0].destroyed);
  t.assert.ok(!workersFirstRound[0].terminating);
});
