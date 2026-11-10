import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import Piscina from '..';
import { resolve } from 'path';

const TIMEOUT_MAX = 2 ** 31 - 1;

test('abortable tasks will not share workers (abortable posted second)', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/wait-for-notify.ts'),
    maxThreads: 1,
    concurrentTasksPerWorker: 2
  });

  const bufs = [
    new Int32Array(new SharedArrayBuffer(4)),
    new Int32Array(new SharedArrayBuffer(4))
  ];
  const task1 = pool.run(bufs[0]);
  const ee = new AbortController();
  assert.rejects(pool.run(bufs[1], { signal: ee.signal }), /The task has been aborted/);
  assert.strictEqual(pool.queueSize, 1);

  ee.abort();

  // Wake up the thread handling the first task.
  Atomics.store(bufs[0], 0, 1);
  Atomics.notify(bufs[0], 0, 1);
  await task1;
});

// TODO: move to testing balancer
test('abortable tasks will not share workers (abortable posted first)', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1,
    concurrentTasksPerWorker: 2
  });

  const ee = new AbortController();
  assert.rejects(pool.run('while(true);', { signal: ee.signal }), /The task has been aborted/);
  const task2 = pool.run('42');
  assert.strictEqual(pool.queueSize, 1);

  ee.abort();

  // Wake up the thread handling the second task.
  assert.strictEqual(await task2, 42);
});

// TODO: move to testing balancer
test('abortable tasks will not share workers (on worker available)', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/sleep.js'),
    maxThreads: 1,
    concurrentTasksPerWorker: 2
  });

  // Task 1 will sleep 100 ms then complete,
  // Task 2 will sleep 300 ms then complete.
  // Abortable task 3 should still be in the queue
  // when Task 1 completes, but should not be selected
  // until after Task 2 completes because it is abortable.
  const ret = await Promise.all([
    pool.run({ time: 100, a: 1 }),
    pool.run({ time: 300, a: 2 }),
    pool.run({ time: 100, a: 3 }, { signal: new AbortController().signal })
  ]);

  assert.strictEqual(ret[0], 0);
  assert.strictEqual(ret[1], 1);
  assert.strictEqual(ret[2], 2);
});

test('abortable tasks will not share workers (destroy workers)', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/sleep.js'),
    maxThreads: 1,
    concurrentTasksPerWorker: 2
  });

  // Task 1 will sleep 0 ms then complete,
  // Task 2 will sleep indefinitely (TIMEOUT_MAX) then complete.
  // Abortable task 3 should still be in the queue
  // when Task 1 completes, but should not be selected
  // until after Task 2 completes because it is abortable.

  pool.run({ time: 0, a: 1 }).then(() => {
    pool.destroy();
  });

  await assert.rejects(pool.run({ time: TIMEOUT_MAX, a: 2 }), /Terminating worker thread/);
  await pool.run({ time: TIMEOUT_MAX, a: 3 }, { signal: new AbortController().signal }).catch(err => {
    assert.strictEqual(err.message, 'The task has been aborted');
    assert.strictEqual(err.code, 'PISCINA_ERR_ABORT');
    assert.strictEqual(err.cause, 'pool is closing');
  })
});

test('aborted AbortSignal rejects task immediately', () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/move.ts')
  });

  const controller = new AbortController();
  // Abort the controller early
  controller.abort();
  assert.strictEqual(controller.signal.aborted, true);

  // The data won't be moved because the task will abort immediately.
  const data = new Uint8Array(new SharedArrayBuffer(4));
  assert.rejects(pool.run(data, { signal: controller.signal, transferList: [data.buffer] }),
    /The task has been aborted/);

  assert.strictEqual(data.length, 4);
});

test('task with AbortSignal cleans up properly', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  const ee = new AbortController();

  await pool.run('1+1', { signal: ee.signal });

  const { getEventListeners } = EventEmitter as any;
  if (typeof getEventListeners === 'function') {
    assert.strictEqual(getEventListeners(ee.signal, 'abort').length, 0);
  }

  const controller = new AbortController();

  await pool.run('1+1', { signal: controller.signal });
});

test('aborted AbortSignal rejects task immediately (with reason)', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/move.ts')
  });
  const customReason = new Error('custom reason');

  const controller = new AbortController();
  controller.abort(customReason);
  assert.strictEqual(controller.signal.aborted, true);
  assert.strictEqual(controller.signal.reason, customReason);

  // The data won't be moved because the task will abort immediately.
  const data = new Uint8Array(new SharedArrayBuffer(4));

  try {
    await pool.run(data, { transferList: [data.buffer], signal: controller.signal });
  } catch (error) {
    assert.strictEqual(error.message, 'The task has been aborted');
    assert.strictEqual(error.cause, customReason);
  }

  assert.strictEqual(data.length, 4);
});

test('tasks can be aborted through AbortController while running', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/notify-then-sleep.ts')
  });
  const reason = new Error('custom reason');

  const buf = new Int32Array(new SharedArrayBuffer(4));
  const abortController = new AbortController();

  try {
    const promise = pool.run(buf, { signal: abortController.signal });

    Atomics.wait(buf, 0, 0);
    assert.strictEqual(Atomics.load(buf, 0), 1);

    abortController.abort(reason);

    await promise;
  } catch (error) {
    assert.strictEqual(error.message, 'The task has been aborted');
    assert.strictEqual(error.cause, reason);
  }
});

test('aborted AbortSignal rejects task immediately (with reason)', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/move.ts')
  });
  const customReason = new Error('custom reason');

  const controller = new AbortController();
  controller.abort(customReason);
  assert.strictEqual(controller.signal.aborted, true);
  assert.strictEqual(controller.signal.reason, customReason);

  // The data won't be moved because the task will abort immediately.
  const data = new Uint8Array(new SharedArrayBuffer(4));

  try {
    await pool.run(data, { transferList: [data.buffer], signal: controller.signal });
  } catch (error) {
    assert.strictEqual(error.message, 'The task has been aborted');
    assert.strictEqual(error.cause, customReason);
  }

  assert.strictEqual(data.length, 4);
});

test('tasks can be aborted through AbortController while running', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/notify-then-sleep.ts')
  });
  const reason = new Error('custom reason');

  const buf = new Int32Array(new SharedArrayBuffer(4));
  const abortController = new AbortController();

  try {
    const promise = pool.run(buf, { signal: abortController.signal });

    Atomics.wait(buf, 0, 0);
    assert.strictEqual(Atomics.load(buf, 0), 1);

    abortController.abort(reason);

    await promise;
  } catch (error) {
    assert.strictEqual(error.message, 'The task has been aborted');
    assert.strictEqual(error.cause, reason);
  }
});

test('queue-limit rejections detach their abort listener and destroy the task', async () => {
  const { getEventListeners } = await import('node:events');
  const { createHook } = await import('node:async_hooks');

  // Every TaskInfo is an async resource. One that never gets done() stays alive
  // and keeps its payload reachable, which is what a shared signal exposes.
  const live = new Set<number>();
  const hook = createHook({
    init (id, type) { if (type === 'Piscina.Task') live.add(id); },
    destroy (id) { live.delete(id); }
  }).enable();

  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/sleep.js'),
    maxThreads: 1,
    maxQueue: 1
  });

  try {
    await pool.run(0);
    const ctl = new AbortController();
    const running = pool.run(100);
    const queued = pool.run(0);
    const rejected = await Promise.allSettled(
      Array.from({ length: 10 }, () => pool.run(0, { signal: ctl.signal }))
    );
    await Promise.all([running, queued]);
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.strictEqual(rejected.filter((r) => r.status === 'rejected').length, 10);
    assert.strictEqual(getEventListeners(ctl.signal, 'abort').length, 0);
    assert.strictEqual(live.size, 0);
  } finally {
    hook.disable();
    await pool.destroy();
  }
});

test('a task aborted while queued detaches its listener and destroys the task', async () => {
  const { getEventListeners } = await import('node:events');
  const { createHook } = await import('node:async_hooks');

  const live = new Set<number>();
  const hook = createHook({
    init (id, type) { if (type === 'Piscina.Task') live.add(id); },
    destroy (id) { live.delete(id); }
  }).enable();

  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/sleep.js'),
    maxThreads: 1,
    maxQueue: 2
  });

  try {
    const ctl = new AbortController();
    const running = pool.run(100);
    const queued = pool.run(100, { signal: ctl.signal });
    ctl.abort();
    await assert.rejects(queued, /The task has been aborted/);
    await running;
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.strictEqual(getEventListeners(ctl.signal, 'abort').length, 0);
    assert.strictEqual(live.size, 0);
  } finally {
    hook.disable();
    await pool.destroy();
  }
});
