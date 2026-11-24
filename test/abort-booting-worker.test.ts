import * as assert from 'node:assert/strict';
import { subscribe, unsubscribe } from 'node:diagnostics_channel';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { test } from 'node:test';
import Piscina, { channels } from '..';

test('workers that crash are still replaced after a task on a starting worker is aborted', { timeout: 10000 }, async (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/slow-boot.js'),
    minThreads: 1,
    maxThreads: 2,
    idleTimeout: 60000
  });
  pool.on('error', () => {});
  t.after(() => pool.destroy());

  const handedToStartingWorker: boolean[] = [];
  const onStart = (message: unknown) => {
    const { pool: source, workerReady } = message as { pool: Piscina, workerReady: boolean };
    if (source === pool) handedToStartingWorker.push(!workerReady);
  };
  subscribe(channels.taskStart, onStart);
  t.after(() => unsubscribe(channels.taskStart, onStart));

  await pool.run('0');

  // When the first worker frees up, a1 goes to it and a2 to the second
  // worker, which is still starting. Then a2 is aborted.
  const first = pool.run('new Promise(resolve => setTimeout(resolve, 50))');
  const ee1 = new AbortController();
  const ee2 = new AbortController();
  const a1 = pool.run('new Promise(resolve => setTimeout(resolve, 100))', { signal: ee1.signal });
  const a2 = assert.rejects(
    pool.run('new Promise(resolve => setTimeout(resolve, 100))', { signal: ee2.signal }),
    /The task has been aborted/);
  await first;
  await sleep(20);
  assert.strictEqual(handedToStartingWorker.at(-1), true, 'a2 went to a starting worker');
  ee2.abort();
  await a1;
  await a2;
  await sleep(500);

  // Both workers crash while a task is queued behind them.
  const crashes = [1, 2].map(() =>
    assert.rejects(pool.run('new Promise(() => setTimeout(() => process.exit(1), 600))')));
  await sleep(450);
  const queued = pool.run('42');
  await Promise.all(crashes);

  const result = await Promise.race([queued, sleep(3000).then(() => 'still queued after 3 s')]);
  assert.strictEqual(result, 42);
  assert.ok(pool.threads.length >= 1, 'the pool refilled to minThreads');
});
