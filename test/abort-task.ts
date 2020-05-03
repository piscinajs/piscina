import { AbortController } from 'abort-controller';
import { EventEmitter } from 'events';
import Piscina from '..';
import { test } from 'tap';
import { resolve } from 'path';

test('tasks can be aborted through AbortController while running', async ({ is, rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/notify-then-sleep.ts')
  });

  const buf = new Int32Array(new SharedArrayBuffer(4));
  const abortController = new AbortController();
  rejects(pool.runTask(buf, abortController.signal),
    /The task has been aborted/);

  Atomics.wait(buf, 0, 0);
  is(Atomics.load(buf, 0), 1);

  abortController.abort();
});

test('tasks can be aborted through EventEmitter while running', async ({ is, rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/notify-then-sleep.ts')
  });

  const buf = new Int32Array(new SharedArrayBuffer(4));
  const ee = new EventEmitter();
  rejects(pool.runTask(buf, ee), /The task has been aborted/);

  Atomics.wait(buf, 0, 0);
  is(Atomics.load(buf, 0), 1);

  ee.emit('abort');
});

test('tasks can be aborted through EventEmitter before running', async ({ is, rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/wait-for-notify.ts'),
    maxThreads: 1
  });

  const bufs = [
    new Int32Array(new SharedArrayBuffer(4)),
    new Int32Array(new SharedArrayBuffer(4))
  ];
  const task1 = pool.runTask(bufs[0]);
  const ee = new EventEmitter();
  rejects(pool.runTask(bufs[1], ee), /The task has been aborted/);
  is(pool.queueSize, 1);

  ee.emit('abort');

  // Wake up the thread handling the first task.
  Atomics.store(bufs[0], 0, 1);
  Atomics.notify(bufs[0], 0, 1);
  await task1;
});

test('abortable tasks will not share workers (abortable posted second)', async ({ is, rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/wait-for-notify.ts'),
    maxThreads: 1,
    concurrentTasksPerWorker: 2
  });

  const bufs = [
    new Int32Array(new SharedArrayBuffer(4)),
    new Int32Array(new SharedArrayBuffer(4))
  ];
  const task1 = pool.runTask(bufs[0]);
  const ee = new EventEmitter();
  rejects(pool.runTask(bufs[1], ee), /The task has been aborted/);
  is(pool.queueSize, 1);

  ee.emit('abort');

  // Wake up the thread handling the first task.
  Atomics.store(bufs[0], 0, 1);
  Atomics.notify(bufs[0], 0, 1);
  await task1;
});

test('abortable tasks will not share workers (abortable posted first)', async ({ is, rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1,
    concurrentTasksPerWorker: 2
  });

  const ee = new EventEmitter();
  rejects(pool.runTask('while(true);', ee), /The task has been aborted/);
  const task2 = pool.runTask('42');
  is(pool.queueSize, 1);

  ee.emit('abort');

  // Wake up the thread handling the second task.
  is(await task2, 42);
});
