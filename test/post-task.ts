import { MessageChannel } from 'worker_threads';
import Piscina from '..';
import { test } from 'tap';
import { resolve } from 'path';

test('postTask() can transfer ArrayBuffer instances', async ({ is }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread.ts')
  });

  const ab = new ArrayBuffer(40);
  await pool.runTask({ ab }, [ab]);
  is(pool.completed, 1);
  is(ab.byteLength, 0);
});

test('postTask() cannot clone build-in objects', async ({ rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread.ts')
  });

  const obj = new MessageChannel().port1;
  rejects(pool.runTask({ obj }));
});

test('postTask() resolves with a rejection when the handler rejects', async ({ rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  rejects(pool.runTask('Promise.reject(new Error("foo"))'), /foo/);
});

test('postTask() resolves with a rejection when the handler throws', async ({ rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  rejects(pool.runTask('throw new Error("foo")'), /foo/);
});

test('postTask() validates transferList', async ({ rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  rejects(pool.runTask('0', 42 as any),
    /transferList argument must be an Array/);
});

test('postTask() validates filename', async ({ rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  rejects(pool.runTask('0', [], 42 as any),
    /filename argument must be a string/);
});

test('postTask() validates abortSignal', async ({ rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  rejects(pool.runTask('0', [], undefined, 42 as any),
    /abortSignal argument must be an object/);
});

test('Piscina emits drain', async ({ is, ok }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1,
    maxQueue: 3,
    queueLoadThreshold: 0.50
  });

  const task = `
  const { promisify } = require('util');
  const sleep = promisify(setTimeout);
  (async () => { await sleep(100); })();
  `;

  is(pool.queueLoad, 0);

  let drained = false;
  pool.on('drain', () => {
    drained = true;
  });

  const tasks = [
    pool.runTask(task),
    pool.runTask(task),
    pool.runTask(task)
  ];

  is(pool.queueLoad, 2 / 3);

  await Promise.all(tasks);

  is(pool.queueLoad, 0);

  ok(drained);
});
