import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { cpus } from 'node:os';
import { once } from 'node:events';
import Piscina from '..';

test('will start with minThreads and max out at maxThreads', async () => {
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

  assert.strictEqual(pool.threads.length, 2);

  assert.rejects(pool.run('while(true) {}'));
  assert.rejects(pool.run('while(true) {}'));

  // #3
  assert.rejects(pool.run('while(true) {}'));
  await once(pool, 'workerCreate');

  // #4
  assert.rejects(pool.run('while(true) {}'));
  await once(pool, 'workerCreate');

  // #4 - as spawn does not happen synchronously anymore, we wait for the signal once more
  assert.rejects(pool.run('while(true) {}'));
  await once(pool, 'workerCreate');

  assert.strictEqual(pool.threads.length, 4);
  await pool.destroy();
  assert.strictEqual(pool.threads.length, 0);
  assert.strictEqual(counter, 4);
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
