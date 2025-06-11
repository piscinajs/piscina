import { MessageChannel } from 'worker_threads';
import { getAvailableParallelism } from '../dist/common';
import Piscina from '..';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { resolve } from 'path';

test('postTask() can transfer ArrayBuffer instances', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread.ts')
  });

  const ab = new ArrayBuffer(40);
  await pool.run({ ab }, { transferList: [ab] });
  t.assert.strictEqual(pool.completed, 1);
  t.assert.strictEqual(ab.byteLength, 0);
});

test('postTask() cannot clone build-in objects', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread.ts')
  });

  const obj = new MessageChannel().port1;
  t.assert.rejects(pool.run({ obj }));
});

test('postTask() resolves with a rejection when the handler rejects', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  t.assert.rejects(pool.run('Promise.reject(new Error("foo"))'), /foo/);
});

test('postTask() resolves with a rejection when the handler throws', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  t.assert.rejects(pool.run('throw new Error("foo")'), /foo/);
});

test('postTask() validates transferList', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  t.assert.rejects(pool.run('0', { transferList: 42 as any }),
    /transferList argument must be an Array/);
});

test('postTask() validates filename', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  t.assert.rejects(pool.run('0', { filename: 42 as any }),
    /filename argument must be a string/);
});

test('postTask() validates name', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  t.assert.rejects(pool.run('0', { name: 42 as any }),
    /name argument must be a string/);
});

test('postTask() validates abortSignal', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  t.assert.rejects(pool.run('0', { signal: 42 as any }),
    /signal argument must be an object/);
});

test('Piscina emits drain', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1
  });

  let drained = false;
  let needsDrain = true;
  pool.on('drain', () => {
    drained = true;
    needsDrain = pool.needsDrain;
  });

  await Promise.all([pool.run('123'), pool.run('123'), pool.run('123')]);

  t.assert.ok(drained);
  t.assert.ok(!needsDrain);
});

test('Piscina exposes/emits needsDrain to true when capacity is exceeded', (t: TestContext, done) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxQueue: 3,
    maxThreads: 1
  });

  t.plan(3);

  pool.once('drain', () => {
    t.assert.ok(true);
    done();
  });
  pool.once('needsDrain', () => {
    t.assert.ok(true);
  });

  pool.run('123');
  pool.run('123');
  pool.run('123');
  pool.run('123');

  t.assert.ok(pool.needsDrain);
});

test('Piscina can use async loaded workers', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval-async.js')
  });
  t.assert.strictEqual(await pool.run('1'), 1);
});

test('Piscina can use async loaded esm workers', {}, async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/esm-async.mjs')
  });
  t.assert.strictEqual(await pool.run('1'), 1);
});

test('Piscina.run options is correct type', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  t.assert.rejects(pool.run(42, 1 as any), /options must be an object/);
});

test('Piscina.maxThreads should return the max number of threads to be used (default)', (t: TestContext) => {
  t.plan(1);
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  const maxThreads = getAvailableParallelism() * 1.5;

  t.assert.strictEqual(pool.maxThreads, maxThreads);
});

test('Piscina.minThreads should return the max number of threads to be used (custom)', (t: TestContext) => {
  const maxThreads = 3;
  const pool = new Piscina({
    maxThreads,
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  t.plan(1);

  t.assert.strictEqual(pool.maxThreads, maxThreads);
});

test('Piscina.minThreads should return the max number of threads to be used (default)', (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });
  const minThreads = Math.max(Math.floor(getAvailableParallelism() / 2), 1);

  t.plan(1);
  t.assert.strictEqual(pool.minThreads, minThreads);
});

test('Piscina.minThreads should return the max number of threads to be used (custom)', (t: TestContext) => {
  const minThreads = 2;
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads
  });
  t.plan(1);

  t.assert.strictEqual(pool.minThreads, minThreads);
});
