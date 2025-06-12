import { resolve } from 'node:path';
import { cpus } from 'node:os';
import { once } from 'node:events';
import Piscina from '..';
import { test } from 'node:test';
import type { TestContext } from 'node:test';

test('will start with minThreads and max out at maxThreads', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 2,
    maxThreads: 4,
    concurrentTasksPerWorker: 1
  });
  let counter = 0;

  pool.on('workerCreate', () => {
    counter++;
  });

  t.assert.strictEqual(pool.threads.length, 2);

  t.assert.rejects(pool.run('while(true) {}'));
  t.assert.rejects(pool.run('while(true) {}'));

  // #3
  t.assert.rejects(pool.run('while(true) {}'));
  await once(pool, 'workerCreate');

  // #4
  t.assert.rejects(pool.run('while(true) {}'));
  await once(pool, 'workerCreate');

  // #4 - as spawn does not happen synchronously anymore, we wait for the signal once more
  t.assert.rejects(pool.run('while(true) {}'));
  await once(pool, 'workerCreate');

  t.assert.strictEqual(pool.threads.length, 4);
  await pool.destroy();
  t.assert.strictEqual(pool.threads.length, 0);
  t.assert.strictEqual(counter, 4);
});

test('low maxThreads sets minThreads', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1
  });
  t.assert.strictEqual(pool.threads.length, 1);
  t.assert.strictEqual(pool.options.minThreads, 1);
  t.assert.strictEqual(pool.options.maxThreads, 1);
});

test('high minThreads sets maxThreads', {
  skip: cpus().length > 8
}, async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 16
  });
  t.assert.strictEqual(pool.threads.length, 16);
  t.assert.strictEqual(pool.options.minThreads, 16);
  t.assert.strictEqual(pool.options.maxThreads, 16);
});

test('conflicting min/max threads is error', async (t: TestContext) => {
  t.assert.throws(() => new Piscina({
    minThreads: 16,
    maxThreads: 8
  }), /options.minThreads and options.maxThreads must not conflict/);
});

test('thread count should be 0 upon destruction', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 2,
    maxThreads: 4
  });
  t.assert.strictEqual(pool.threads.length, 2);
  await pool.destroy();
  t.assert.strictEqual(pool.threads.length, 0);
});
