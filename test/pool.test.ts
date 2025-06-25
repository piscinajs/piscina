import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { once } from 'node:events';
import Piscina from '../dist';

const nodeVersion = Number(process.versions.node.split('.')[0])

test('workerCreate/workerDestroy should be emitted while managing worker lifecycle', async () => {
  let index = 0;
  // Its expected to have one task get balanced twice due to the load balancer distribution
  // first task enters, its distributed; second is enqueued, once first is done, second is distributed and normalizes
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

  for (let n = 0; n < 5; n++) {
    tasks.push(pool.run('new Promise(resolve => setTimeout(resolve, 5))'));
  }

  controller.abort();
  await Promise.allSettled(tasks);
  await pool.close();
  assert.strictEqual(destroyedWorkers, 4);
  assert.strictEqual(newWorkers, 4);
});

test('Explicit resource management (dispose)', { skip: nodeVersion !== 24 }, async () => {
  const piscina = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1,
    minThreads: 1,
    concurrentTasksPerWorker: 1,
  });

  {
    using pool = piscina;
    const tasks = [];
;
    pool.once('close', () => {
      assert.ok(true);
    });

    for (let n = 0; n < 10; n++) {
      tasks.push(pool.run('new Promise(resolve => setTimeout(resolve, 5))'));
    }
  }

  await once(piscina, 'close');
});

test('Explicit resource management (asyncDispose)', { skip: nodeVersion !== 24 }, async () => {
  const piscina = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1,
    minThreads: 1,
    concurrentTasksPerWorker: 1,
  });

  {
    await using pool = piscina;
    const tasks = [];

    pool.once('close', () => {
      assert.ok(true);
    });

    for (let n = 0; n < 10; n++) {
      tasks.push(pool.run('new Promise(resolve => setTimeout(resolve, 5))'));
    }
  }
})

test('#805 - Concurrent Aborts', async (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1,
    minThreads: 1,
    concurrentTasksPerWorker: 1,
  });

  t.after(() => pool.close());

  const tasks = [];
  const controller = new AbortController();
  const controller2 = new AbortController();
  const controller3 = new AbortController();

  tasks.push(assert.rejects(pool.run('new Promise(resolve => setTimeout(resolve, 5))', { signal: controller.signal })));
  tasks.push(assert.rejects(pool.run('new Promise(resolve => setTimeout(resolve, 5))', { signal: controller2.signal })));
  tasks.push(pool.run('new Promise(resolve => setTimeout(resolve, 5))', { signal: controller3.signal }));


  controller.abort();
  controller2.abort();

  await Promise.all(tasks);
});
