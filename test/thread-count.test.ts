import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { cpus } from 'node:os';
import Piscina from '..';

test('will start with minThreads and max out at maxThreads', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 2,
    maxThreads: 4,
    concurrentTasksPerWorker: 1
  });
  let counter = 0;
  const created = new Promise<void>(resolve => {
    pool.on('workerCreate', () => {
      counter++;
      if (counter === 4) resolve();
    });
  });

  assert.strictEqual(pool.threads.length, 2);
  assert.rejects(pool.run('while(true) {}'));
  assert.strictEqual(pool.threads.length, 2);
  assert.rejects(pool.run('while(true) {}'));
  assert.strictEqual(pool.threads.length, 2);
  assert.rejects(pool.run('while(true) {}'));
  assert.strictEqual(pool.threads.length, 3);
  assert.rejects(pool.run('while(true) {}'));
  assert.strictEqual(pool.threads.length, 4);
  assert.rejects(pool.run('while(true) {}'));
  assert.strictEqual(pool.threads.length, 4);

  await created;
  assert.strictEqual(counter, 4);

  await pool.destroy();
  assert.strictEqual(pool.threads.length, 0);
});

test('cold pool spawns workers eagerly up to maxThreads on initial burst', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/sleep.js'),
    minThreads: 0,
    maxThreads: 4,
    concurrentTasksPerWorker: 1
  });

  assert.strictEqual(pool.threads.length, 0);

  // Submit 4 tasks synchronously; all 4 workers should be spawning before
  // any of them finishes initializing.
  const tasks = [
    pool.run({ time: 50 }),
    pool.run({ time: 50 }),
    pool.run({ time: 50 }),
    pool.run({ time: 50 })
  ];
  assert.strictEqual(pool.threads.length, 4);

  // A 5th task must not spawn another worker since we're at maxThreads.
  const overflow = pool.run({ time: 50 });
  assert.strictEqual(pool.threads.length, 4);

  await Promise.all([...tasks, overflow]);
  await pool.destroy();
});

test('low maxThreads sets minThreads', () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1
  });

  assert.strictEqual(pool.threads.length, 1);
  assert.strictEqual(pool.options.minThreads, 1);
  assert.strictEqual(pool.options.maxThreads, 1);
});

test('high minThreads sets maxThreads', {
  skip: cpus().length > 8
}, () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 16
  });

  assert.strictEqual(pool.threads.length, 16);
  assert.strictEqual(pool.options.minThreads, 16);
  assert.strictEqual(pool.options.maxThreads, 16);
});

test('conflicting min/max threads is error', () => {
  assert.throws(() => new Piscina({
    minThreads: 16,
    maxThreads: 8
  }), /options.minThreads and options.maxThreads must not conflict/);
});

test('idleThreads reflects ready, unoccupied workers', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/sleep.js'),
    minThreads: 2,
    maxThreads: 2,
    concurrentTasksPerWorker: 1
  });

  // All minThreads workers are warmed and idle from the start.
  assert.strictEqual(pool.idleThreads, 2);

  const first = pool.run({ time: 100 });
  // One worker is now busy.
  assert.strictEqual(pool.idleThreads, 1);

  const second = pool.run({ time: 100 });
  // Both workers are busy.
  assert.strictEqual(pool.idleThreads, 0);

  await Promise.all([first, second]);
  // Workers return to idle once tasks complete.
  assert.strictEqual(pool.idleThreads, 2);

  await pool.destroy();
  assert.strictEqual(pool.idleThreads, 0);
});

test('thread count should be 0 upon destruction', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 2,
    maxThreads: 4
  });
  assert.strictEqual(pool.threads.length, 2);
  await pool.destroy();
  assert.strictEqual(pool.threads.length, 0);
});
