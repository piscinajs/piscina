import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { createHook } from 'node:async_hooks';
import { getEventListeners } from 'node:events';
import { resolve } from 'node:path';
import Piscina from '..';

// Tracks Piscina.Task async resources that were created but never destroyed.
function trackLiveTasks () {
  const live = new Set<number>();
  const hook = createHook({
    init (id, type) { if (type === 'Piscina.Task') live.add(id); },
    destroy (id) { live.delete(id); }
  }).enable();
  return { live, stop: () => hook.disable() };
}

test('tasks refused by the queue limit release their abort listener and async resource', async () => {
  const tasks = trackLiveTasks();
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1,
    maxQueue: 1
  });

  try {
    await pool.run('0');
    const running = pool.run('new Promise(resolve => setTimeout(resolve, 100))');
    const queued = pool.run('0');
    const ee = new AbortController();
    const refused = await Promise.allSettled(
      Array.from({ length: 10 }, () => pool.run('0', { signal: ee.signal })));
    await Promise.all([running, queued]);
    // destroy hooks run asynchronously.
    await new Promise(resolve => setImmediate(resolve));

    assert.deepStrictEqual(refused.map(r => r.status), Array(10).fill('rejected'));
    assert.strictEqual(getEventListeners(ee.signal, 'abort').length, 0);
    assert.strictEqual(tasks.live.size, 0);
  } finally {
    tasks.stop();
    await pool.destroy();
  }
});

test('tasks refused with maxQueue 0 release their abort listener and async resource', async () => {
  const tasks = trackLiveTasks();
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 1,
    maxThreads: 1,
    maxQueue: 0
  });

  try {
    await pool.run('0');
    const running = pool.run('new Promise(resolve => setTimeout(resolve, 100))');
    const ee = new AbortController();
    await assert.rejects(pool.run('0', { signal: ee.signal }), /No task queue available/);
    await running;
    await new Promise(resolve => setImmediate(resolve));

    assert.strictEqual(getEventListeners(ee.signal, 'abort').length, 0);
    assert.strictEqual(tasks.live.size, 0);
  } finally {
    tasks.stop();
    await pool.destroy();
  }
});

test('a task aborted while queued releases its async resource', async () => {
  const tasks = trackLiveTasks();
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1
  });

  try {
    await pool.run('0');
    const running = pool.run('new Promise(resolve => setTimeout(resolve, 100))');
    const ee = new AbortController();
    const queued = pool.run('0', { signal: ee.signal });
    ee.abort();
    await assert.rejects(queued, /The task has been aborted/);
    await running;
    await new Promise(resolve => setImmediate(resolve));

    assert.strictEqual(tasks.live.size, 0);
  } finally {
    tasks.stop();
    await pool.destroy();
  }
});
