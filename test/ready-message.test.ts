import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { once } from 'node:events';
import Piscina from '../dist';

test('worker ready message is detected when minThreads=0', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 0,
    maxThreads: 1
  });

  // Pool starts with no workers
  assert.strictEqual(pool.threads.length, 0);

  // Set up listener for workerCreate (fires when ready message is received)
  const workerCreatePromise = once(pool, 'workerCreate');

  // Run a task - this forces worker creation and ready message flow
  const result = await pool.run('42');

  // Verify the task completed
  assert.strictEqual(result, 42);

  // Verify workerCreate event fired (proves ready message was detected)
  await workerCreatePromise;
  assert.strictEqual(pool.threads.length, 1);

  await pool.close();
});
