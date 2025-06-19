import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import Piscina from '..';

const delay = promisify(setTimeout);

test('idle timeout will let go of threads early',  async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/wait-for-others.ts'),
    idleTimeout: 50, // 50ms
    minThreads: 1,
    maxThreads: 2
  });

  assert.strictEqual(pool.threads.length, 1);
  const buffer = new Int32Array(new SharedArrayBuffer(4));

  const firstTasks = [
    pool.run([buffer, 2]),
    pool.run([buffer, 2])
  ];
  assert.strictEqual(pool.threads.length, 2);

  const earlyThreadIds = await Promise.all(firstTasks);
  assert.strictEqual(pool.threads.length, 2);

  await delay(100);
  assert.strictEqual(pool.threads.length, 1);

  const secondTasks = [
    pool.run([buffer, 4]),
    pool.run([buffer, 4])
  ];
  assert.strictEqual(pool.threads.length, 2);

  const lateThreadIds = await Promise.all(secondTasks);

  // One thread should have been idle in between and exited, one should have
  // been reused.
  assert.strictEqual(earlyThreadIds.length, 2);
  assert.strictEqual(lateThreadIds.length, 2);
  assert.strictEqual(new Set([...earlyThreadIds, ...lateThreadIds]).size, 3);
});

test('idle timeout will not let go of threads if Infinity is used as the value',  async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/wait-for-others.ts'),
    idleTimeout: Infinity,
    minThreads: 1,
    maxThreads: 2
  });
  assert.strictEqual(pool.threads.length, 1);
  const buffer = new Int32Array(new SharedArrayBuffer(4));

  const firstTasks = [
    pool.run([buffer, 2]),
    pool.run([buffer, 2])
  ];
  assert.strictEqual(pool.threads.length, 2);

  const earlyThreadIds = await Promise.all(firstTasks);
  assert.strictEqual(pool.threads.length, 2);

  await delay(1000);
  assert.strictEqual(pool.threads.length, 2);

  const secondTasks = [
    pool.run([buffer, 4]),
    pool.run([buffer, 4]),
  ];
  assert.strictEqual(pool.threads.length, 2);



  const lateThreadIds = await Promise.all(secondTasks);
  assert.deepStrictEqual(earlyThreadIds, lateThreadIds);

  await Promise.all([pool.run([buffer, 6]), pool.run([buffer, 6]), pool.run([buffer, 6])]);
  assert.strictEqual(pool.threads.length, 2);
});
