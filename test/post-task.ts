import { MessageChannel } from 'worker_threads';
import { getAvailableParallelism } from '../dist/common';
import Piscina from '..';
import { test } from 'tap';
import { resolve } from 'path';

test('postTask() can transfer ArrayBuffer instances', async ({ equal }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread.ts')
  });

  const ab = new ArrayBuffer(40);
  await pool.runTask({ ab }, [ab]);
  equal(pool.completed, 1);
  equal(ab.byteLength, 0);
});

test('postTask() can transfer ArrayBuffer instances', async ({ equal }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread.ts')
  });

  const ab = new ArrayBuffer(40);
  await pool.run({ ab }, { transferList: [ab] });
  equal(pool.completed, 1);
  equal(ab.byteLength, 0);
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

  rejects(pool.run('0', { transferList: 42 as any }),
    /transferList argument must be an Array/);
});

test('postTask() validates filename', async ({ rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  rejects(pool.runTask('0', [], 42 as any),
    /filename argument must be a string/);

  rejects(pool.run('0', { filename: 42 as any }),
    /filename argument must be a string/);
});

test('postTask() validates name', async ({ rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  rejects(pool.run('0', { name: 42 as any }),
    /name argument must be a string/);
});

test('postTask() validates abortSignal', async ({ rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  rejects(pool.runTask('0', [], undefined, 42 as any),
    /signal argument must be an object/);

  rejects(pool.run('0', { signal: 42 as any }),
    /signal argument must be an object/);
});

test('Piscina emits drain', async ({ ok, notOk }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  let drained = false;
  let needsDrain = true;
  pool.on('drain', () => {
    drained = true;
    needsDrain = pool.needsDrain;
  });

  await Promise.all([pool.run('123'), pool.run('123')]);

  ok(drained);
  notOk(needsDrain);
});

test('Piscina exposes/emits needsDrain to true when capacity is exceeded', async ({ ok }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxQueue: 3,
    maxThreads: 1
  });

  let triggered = false;
  let drained = false;
  pool.once('drain', () => {
    drained = true;
  });
  pool.once('needsDrain', () => {
    triggered = true;
  });

  pool.run('123');
  pool.run('123');
  pool.run('123');
  pool.run('123');

  ok(pool.needsDrain);
  ok(triggered);
  ok(drained);
});

test('Piscina can use async loaded workers', async ({ equal }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval-async.js')
  });
  equal(await pool.runTask('1'), 1);
});

test('Piscina can use async loaded esm workers', {}, async ({ equal }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/esm-async.mjs')
  });
  equal(await pool.runTask('1'), 1);
});

test('Piscina.run options is correct type', async ({ rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  rejects(pool.run(42, 1 as any), /options must be an object/);
});

test('Piscina.maxThreads should return the max number of threads to be used (default)', ({ equal, plan }) => {
  plan(1);
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  const maxThreads = getAvailableParallelism() * 1.5;

  equal(pool.maxThreads, maxThreads);
});

test('Piscina.minThreads should return the max number of threads to be used (custom)', ({ equal, plan }) => {
  const maxThreads = 3;
  const pool = new Piscina({
    maxThreads,
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  plan(1);

  equal(pool.maxThreads, maxThreads);
});

test('Piscina.minThreads should return the max number of threads to be used (default)', ({ equal, plan }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });
  const minThreads = Math.max(Math.floor(getAvailableParallelism() / 2), 1);

  plan(1);
  equal(pool.minThreads, minThreads);
});

test('Piscina.minThreads should return the max number of threads to be used (custom)', ({ equal, plan }) => {
  const minThreads = 2;
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads
  });
  plan(1);

  equal(pool.minThreads, minThreads);
});
