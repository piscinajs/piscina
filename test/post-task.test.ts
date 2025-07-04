import assert from 'node:assert';
import { test, TestContext } from 'node:test';
import { MessageChannel } from 'node:worker_threads';
import { resolve } from 'node:path';
import Piscina from '..';
import { getAvailableParallelism } from '../dist/common';

test('postTask() can transfer ArrayBuffer instances', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread.ts')
  });

  const ab = new ArrayBuffer(40);
  await pool.run({ ab }, { transferList: [ab] });
  assert.strictEqual(pool.completed, 1);
  assert.strictEqual(ab.byteLength, 0);
});

test('postTask() cannot clone build-in objects', () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread.ts')
  });

  const obj = new MessageChannel().port1;
  assert.rejects(pool.run({ obj }));
});

test('postTask() resolves with a rejection when the handler rejects', () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  assert.rejects(pool.run('Promise.reject(new Error("foo"))'), /foo/);
});

test('postTask() resolves with a rejection when the handler throws', () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  assert.rejects(pool.run('throw new Error("foo")'), /foo/);
});

test('postTask() validates transferList', () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  assert.rejects(pool.run('0', { transferList: 42 as any }),
    /transferList argument must be an Array/);
});

test('postTask() validates filename', () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  assert.rejects(pool.run('0', { filename: 42 as any }),
    /filename argument must be a string/);
});

test('postTask() validates name', () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  assert.rejects(pool.run('0', { name: 42 as any }),
    /name argument must be a string/);
});

test('postTask() validates abortSignal', () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  assert.rejects(pool.run('0', { signal: 42 as any }),
    /signal argument must be an object/);
});

test('Piscina emits drain', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1
  });

  t.plan(2);

  pool.on('drain', () => {
    t.assert.ok(true);
    t.assert.ok(!pool.needsDrain);
  });

  await Promise.all([pool.run('123'), pool.run('123'), pool.run('123')]);
});

test('Piscina exposes/emits needsDrain to true when capacity is exceeded', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxQueue: 3,
    maxThreads: 1
  });

  t.plan(2);

  pool.once('drain', () => {
    t.assert.ok(true);
  });
  pool.once('needsDrain', () => {
    t.assert.ok(pool.needsDrain);
  });

  await Promise.all([
    pool.run('123'),
    pool.run('123'),
    pool.run('123'),
    pool.run('123')
  ]);
});

test('Piscina can use async loaded workers', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval-async.js')
  });

  assert.strictEqual(await pool.run('1'), 1);
});

test('Piscina can use async loaded esm workers', {}, async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/esm-async.mjs')
  });

  assert.strictEqual(await pool.run('1'), 1);
});

test('Piscina.run options is correct type', () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  assert.rejects(pool.run(42, 1 as any), /options must be an object/);
});

test('Piscina.maxThreads should return the max number of threads to be used (default)', () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  const maxThreads = getAvailableParallelism() * 1.5;

  assert.strictEqual(pool.maxThreads, maxThreads);
});

test('Piscina.minThreads should return the max number of threads to be used (custom)', () => {
  const maxThreads = 3;
  const pool = new Piscina({
    maxThreads,
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  assert.strictEqual(pool.maxThreads, maxThreads);
});

test('Piscina.minThreads should return the max number of threads to be used (default)', () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });
  const minThreads = Math.max(Math.floor(getAvailableParallelism() / 2), 1);

  assert.strictEqual(pool.minThreads, minThreads);
});

test('Piscina.minThreads should return the max number of threads to be used (custom)', () => {
  const minThreads = 2;
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads
  });

  assert.strictEqual(pool.minThreads, minThreads);
});
