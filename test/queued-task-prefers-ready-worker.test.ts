import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import Piscina from '..';

const READY_SIGNAL = 0;
const TASK_SIGNAL = 1;

test('a queued task prefers a ready worker over a still-pending one', async () => {
  const gates = new Int32Array(
    new SharedArrayBuffer(2 * Int32Array.BYTES_PER_ELEMENT)
  );

  Atomics.store(gates, READY_SIGNAL, 1);

  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/wait-until-released.js'),
    minThreads: 1,
    maxThreads: 2,
    concurrentTasksPerWorker: 1,
    workerData: gates.buffer
  });

  // One ready, idle worker.
  const warmThreadId = await pool.run({});

  // Keep the next worker from becoming ready.
  Atomics.store(gates, READY_SIGNAL, 0);

  // Occupy the ready worker, then queue a task behind it. A second worker
  // spawns but stays pending.
  const held = pool.run({ hold: true });
  const queued = pool.run({});

  // Free the ready worker while the second is still pending: the queued task
  // should land on the ready worker.
  Atomics.store(gates, TASK_SIGNAL, 1);
  Atomics.notify(gates, TASK_SIGNAL, Infinity);

  const heldThreadId = await held;

  // Let the second worker finish so the pool can shut down (and the queued task
  // resolves even if it was wrongly routed there).
  Atomics.store(gates, READY_SIGNAL, 1);
  Atomics.notify(gates, READY_SIGNAL, Infinity);

  const queuedThreadId = await queued;

  assert.strictEqual(heldThreadId, warmThreadId);
  assert.strictEqual(
    queuedThreadId,
    warmThreadId,
    'queued task should go to the ready worker, not the still-pending one'
  );

  await pool.destroy();
});
