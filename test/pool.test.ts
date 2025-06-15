import { resolve } from 'node:path';
import { test } from 'node:test';
import { once } from 'node:events';

import type { TestContext } from 'node:test';

import Piscina from '../dist';

const nodeVersion = Number(process.versions.node.split('.')[0])

test('workerCreate/workerDestroy should be emitted while managing worker lifecycle', async (t: TestContext) => {
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
  t.assert.strictEqual(destroyedWorkers, 4);
  t.assert.strictEqual(newWorkers, 4);
});

test('Explicit resource management (dispose)', { skip: nodeVersion !== 24 }, async (t: TestContext) => {
  const piscina = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1,
    minThreads: 1,
    concurrentTasksPerWorker: 1,
  });
  
  {
    using pool = piscina;
    const tasks = [];

    t.plan(1);
    pool.once('close', () => {
      t.assert.ok(true)
    });

    for (let n = 0; n < 10; n++) {
      tasks.push(pool.run('new Promise(resolve => setTimeout(resolve, 500))'));
    }
  }

  await once(piscina, 'close');
})

test('Explicit resource management (asyncDispose)', { skip: nodeVersion !== 24 }, async (t: TestContext) => {
  const piscina = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1,
    minThreads: 1,
    concurrentTasksPerWorker: 1,
  });

  {
    await using pool = piscina;
    const tasks = [];

    t.plan(1);
    pool.once('close', () => {
      t.assert.ok(true)
    });

    for (let n = 0; n < 10; n++) {
      tasks.push(pool.run('new Promise(resolve => setTimeout(resolve, 500))'));
    }
  }
})

test('#805 - Concurrent Aborts', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1,
    minThreads: 1,
    concurrentTasksPerWorker: 1,
  });

  t.after(() => pool.close());

  t.plan(2);
  const tasks = [];
  const controller = new AbortController();
  const controller2 = new AbortController();
  const controller3 = new AbortController();

  tasks.push(t.assert.rejects(pool.run('new Promise(resolve => setTimeout(resolve, 1500))', { signal: controller.signal })));
  tasks.push(t.assert.rejects(pool.run('new Promise(resolve => setTimeout(resolve, 1500))', { signal: controller2.signal })));
  tasks.push(pool.run('new Promise(resolve => setTimeout(resolve, 1000))', { signal: controller3.signal }));


  controller.abort();
  controller2.abort();

  await Promise.all(tasks);
});
