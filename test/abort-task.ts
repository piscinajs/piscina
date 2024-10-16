import { EventEmitter } from 'events';
import Piscina from '..';
import { test } from 'tap';
import { resolve } from 'path';

test('tasks can be aborted through AbortController while running', async ({ equal, rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/notify-then-sleep.ts')
  });

  const buf = new Int32Array(new SharedArrayBuffer(4));
  const abortController = new AbortController();
  rejects(pool.run(buf, { signal: abortController.signal }),
    /The task has been aborted/);

  Atomics.wait(buf, 0, 0);
  equal(Atomics.load(buf, 0), 1);

  abortController.abort();
});

test('tasks can be aborted through EventEmitter while running', async ({ equal, rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/notify-then-sleep.ts')
  });

  const buf = new Int32Array(new SharedArrayBuffer(4));
  const ee = new EventEmitter();
  rejects(pool.run(buf, { signal: ee }), /The task has been aborted/);

  Atomics.wait(buf, 0, 0);
  equal(Atomics.load(buf, 0), 1);

  ee.emit('abort');
});

test('tasks can be aborted through EventEmitter before running', async ({ equal, rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/wait-for-notify.js'),
    maxThreads: 1
  });

  const bufs = [
    new Int32Array(new SharedArrayBuffer(4)),
    new Int32Array(new SharedArrayBuffer(4))
  ];
  const ee = new EventEmitter();
  const task1 = pool.run(bufs[0]);
  const abortable = pool.run(bufs[1], { signal: ee });
  equal(pool.queueSize, 0); // Means it's running
  rejects(abortable, /The task has been aborted/);

  ee.emit('abort');

  // Wake up the thread handling the first task.
  Atomics.store(bufs[0], 0, 1);
  Atomics.notify(bufs[0], 0, 1);
  await task1;
});

test('abortable tasks will not share workers (abortable posted second)', async ({ equal, rejects }) => {
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
  const ee = new EventEmitter();
  rejects(pool.run(bufs[1], { signal: ee }), /The task has been aborted/);
  equal(pool.queueSize, 0);

  ee.emit('abort');

  // Wake up the thread handling the first task.
  Atomics.store(bufs[0], 0, 1);
  Atomics.notify(bufs[0], 0, 1);
  await task1;
});

// TODO: move to testing balancer
test('abortable tasks will not share workers (abortable posted first)', async ({ equal, rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1,
    concurrentTasksPerWorker: 2
  });

  const ee = new EventEmitter();
  rejects(pool.run('while(true);', { signal: ee }), /The task has been aborted/);
  const task2 = pool.run('42');
  equal(pool.queueSize, 1);

  ee.emit('abort');

  // Wake up the thread handling the second task.
  equal(await task2, 42);
});

// TODO: move to testing balancer
test('abortable tasks will not share workers (on worker available)', async ({ equal }) => {
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
    pool.run({ time: 100, a: 3 }, { signal: new EventEmitter() })
  ]);

  equal(ret[0], 0);
  equal(ret[1], 1);
  equal(ret[2], 2);
});

test('abortable tasks will not share workers (destroy workers)', async ({ rejects }) => {
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

  pool.run({ time: 100, a: 1 }).then(() => {
    pool.destroy();
  });

  rejects(pool.run({ time: 300, a: 2 }), /Terminating worker thread/);
  rejects(pool.run({ time: 100, a: 3 }, { signal: new EventEmitter() }),
    /Terminating worker thread/);
});

test('aborted AbortSignal rejects task immediately', async ({ rejects, equal }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/move.ts')
  });

  const controller = new AbortController();
  // Abort the controller early
  controller.abort();
  equal(controller.signal.aborted, true);

  // The data won't be moved because the task will abort immediately.
  const data = new Uint8Array(new SharedArrayBuffer(4));
  rejects(pool.run(data, { signal: controller.signal, transferList: [data.buffer] }),
    /The task has been aborted/);

  equal(data.length, 4);
});

test('task with AbortSignal cleans up properly', async ({ equal }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  const ee = new EventEmitter();

  await pool.run('1+1', { signal: ee });

  const { getEventListeners } = EventEmitter as any;
  if (typeof getEventListeners === 'function') {
    equal(getEventListeners(ee, 'abort').length, 0);
  }

  const controller = new AbortController();

  await pool.run('1+1', { signal: controller.signal });
});

test('aborted AbortSignal rejects task immediately (with reason)', async ({ match, equal }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/move.ts')
  });
  const customReason = new Error('custom reason');

  const controller = new AbortController();
  controller.abort(customReason);
  equal(controller.signal.aborted, true);
  equal(controller.signal.reason, customReason);

  // The data won't be moved because the task will abort immediately.
  const data = new Uint8Array(new SharedArrayBuffer(4));

  try {
    await pool.run(data, { transferList: [data.buffer], signal: controller.signal });
  } catch (error) {
    equal(error.message, 'The task has been aborted');
    match(error.cause, customReason);
  }

  equal(data.length, 4);
});

test('tasks can be aborted through AbortController while running', async ({ equal, match }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/notify-then-sleep.ts')
  });
  const reason = new Error('custom reason');

  const buf = new Int32Array(new SharedArrayBuffer(4));
  const abortController = new AbortController();

  try {
    const promise = pool.run(buf, { signal: abortController.signal });

    Atomics.wait(buf, 0, 0);
    equal(Atomics.load(buf, 0), 1);

    abortController.abort(reason);

    await promise;
  } catch (error) {
    equal(error.message, 'The task has been aborted');
    match(error.cause, reason);
  }
});

test('aborted AbortSignal rejects task immediately (with reason)', async ({ match, equal }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/move.ts')
  });
  const customReason = new Error('custom reason');

  const controller = new AbortController();
  controller.abort(customReason);
  equal(controller.signal.aborted, true);
  equal(controller.signal.reason, customReason);

  // The data won't be moved because the task will abort immediately.
  const data = new Uint8Array(new SharedArrayBuffer(4));

  try {
    await pool.run(data, { transferList: [data.buffer], signal: controller.signal });
  } catch (error) {
    equal(error.message, 'The task has been aborted');
    match(error.cause, customReason);
  }

  equal(data.length, 4);
});

test('tasks can be aborted through AbortController while running', async ({ equal, match }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/notify-then-sleep.ts')
  });
  const reason = new Error('custom reason');

  const buf = new Int32Array(new SharedArrayBuffer(4));
  const abortController = new AbortController();

  try {
    const promise = pool.run(buf, { signal: abortController.signal });

    Atomics.wait(buf, 0, 0);
    equal(Atomics.load(buf, 0), 1);

    abortController.abort(reason);

    await promise;
  } catch (error) {
    equal(error.message, 'The task has been aborted');
    match(error.cause, reason);
  }
});
