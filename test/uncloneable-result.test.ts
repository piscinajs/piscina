import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import Piscina from '..';

test('a task whose result cannot be cloned rejects without taking down its worker', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 1,
    maxThreads: 1,
    concurrentTasksPerWorker: 2
  });
  let destroyedWorkers = 0;
  pool.on('workerDestroy', () => { destroyedWorkers++; });

  await pool.run('0');
  const { threadId } = pool.threads[0];

  const other = pool.run('new Promise((resolve) => setTimeout(() => resolve("other"), 100))');
  await assert.rejects(pool.run('({ f () {} })'), (err: any) => {
    assert.strictEqual(err.name, 'SerializationError');
    assert.strictEqual(err.code, 'PISCINA_ERR_SERIALIZATION');
    assert.strictEqual(err.cause.name, 'DataCloneError');
    return true;
  });

  assert.strictEqual(await other, 'other');
  assert.strictEqual(await pool.run('42'), 42);
  assert.strictEqual(pool.threads[0].threadId, threadId);
  assert.strictEqual(destroyedWorkers, 0);
  await pool.destroy();
});

test('a task whose error cannot be cloned rejects without taking down its worker', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 1,
    maxThreads: 1
  });
  let destroyedWorkers = 0;
  pool.on('workerDestroy', () => { destroyedWorkers++; });

  await pool.run('0');
  const { threadId } = pool.threads[0];

  await assert.rejects(pool.run('throw { f () {} }'), (err: any) => {
    assert.strictEqual(err.name, 'SerializationError');
    assert.strictEqual(err.code, 'PISCINA_ERR_SERIALIZATION');
    assert.strictEqual(err.cause.name, 'DataCloneError');
    return true;
  });

  assert.strictEqual(await pool.run('42'), 42);
  assert.strictEqual(pool.threads[0].threadId, threadId);
  assert.strictEqual(destroyedWorkers, 0);
  await pool.destroy();
});
