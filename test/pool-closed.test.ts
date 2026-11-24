import * as assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import Piscina from '..';

function isPoolDestroyedError (err: unknown): boolean {
  assert.ok(err instanceof Error);
  assert.strictEqual(err.name, 'PoolDestroyedError');
  assert.strictEqual((err as Error & { code?: string }).code, 'PISCINA_ERR_POOL_DESTROYED');
  return true;
}

test('run() rejects after close() has completed', async () => {
  const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js'), maxThreads: 1 });

  await pool.run({ time: 1 });
  await pool.close();

  await assert.rejects(pool.run({ time: 1 }), isPoolDestroyedError);
  assert.strictEqual(pool.threads.length, 0, 'no worker is respawned after close()');
});

test('run() rejects after destroy() has completed', async () => {
  const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js'), maxThreads: 1 });

  await pool.run({ time: 1 });
  await pool.destroy();

  await assert.rejects(pool.run({ time: 1 }), isPoolDestroyedError);
  assert.strictEqual(pool.threads.length, 0, 'no worker is respawned after destroy()');
});

test('run() rejects after a close() that timed out', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/sleep.js'),
    maxThreads: 1,
    closeTimeout: 10
  });
  pool.on('error', () => {});

  const running = pool.run({ time: 1000 });
  const rejection = assert.rejects(running);
  await pool.close();
  await rejection;

  await assert.rejects(pool.run({ time: 1 }), isPoolDestroyedError);
  assert.strictEqual(pool.threads.length, 0, 'no worker is respawned after a timed-out close()');
});

test('close() and destroy() stay callable after the pool is closed', async () => {
  const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js'), maxThreads: 1 });

  await pool.close();
  await assert.doesNotReject(pool.close());
  await assert.doesNotReject(pool.destroy());
  await assert.rejects(pool.run({ time: 1 }), isPoolDestroyedError);
});
