import assert from 'node:assert';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { EventEmitter } from 'node:events';
import Piscina from '..';
import { version } from '../package.json';

test('Piscina is exposed on export', () => {
  assert.strictEqual(Piscina.version, version);
});

test('Piscina is exposed on itself', () => {
  assert.strictEqual(Piscina.Piscina, Piscina);
});

test('Piscina.isWorkerThread has the correct value', () => {
  assert.strictEqual(Piscina.isWorkerThread, false);
});

test('Piscina.isWorkerThread has the correct value (worker)', async () => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread.ts')
  });
  const result = await worker.run(null);
  assert.strictEqual(result, 'done');
});

test('Piscina.isWorkerThread has the correct value (worker) with named import', async () => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread-named-import.ts')
  });
  const result = await worker.run(null);
  assert.strictEqual(result, 'done');
});

test('Piscina.isWorkerThread has the correct value (worker) with named import', async () => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread-named-import.ts')
  });
  const result = await worker.run(null);
  assert.strictEqual(result, 'done');
});

test('Piscina instance is an EventEmitter', async () => {
  const piscina = new Piscina();
  assert.ok(piscina instanceof EventEmitter);
});

test('Piscina constructor options are correctly set', async () => {
  const piscina = new Piscina({
    minThreads: 10,
    maxThreads: 20,
    maxQueue: 30
  });

  assert.strictEqual(piscina.options.minThreads, 10);
  assert.strictEqual(piscina.options.maxThreads, 20);
  assert.strictEqual(piscina.options.maxQueue, 30);
});

test('trivial eval() handler works', async () => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });
  const result = await worker.run('42');
  assert.strictEqual(result, 42);
});

test('async eval() handler works', async () => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });
  const result = await worker.run('Promise.resolve(42)');
  assert.strictEqual(result, 42);
});

test('filename can be provided while posting', async () => {
  const worker = new Piscina();
  const result = await worker.run(
    'Promise.resolve(42)',
    { filename: resolve(__dirname, 'fixtures/eval.js') });
  assert.strictEqual(result, 42);
});

test('filename can be null when initially provided', async () => {
  const worker = new Piscina({ filename: null });
  const result = await worker.run(
    'Promise.resolve(42)',
    { filename: resolve(__dirname, 'fixtures/eval.js') });
  assert.strictEqual(result, 42);
});

test('filename must be provided while posting', () => {
  const worker = new Piscina();
  assert.rejects(worker.run('doesn’t matter'),
    /filename must be provided to run\(\) or in options object/);
});

test('passing env to workers works', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    env: { A: 'foo' }
  });

  const env = await pool.run('({...process.env})');
  assert.deepStrictEqual(env, { A: 'foo' });
});

test('passing argv to workers works', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    argv: ['a', 'b', 'c']
  });

  const env = await pool.run('process.argv.slice(2)');
  assert.deepStrictEqual(env, ['a', 'b', 'c']);
});

test('passing execArgv to workers works', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    execArgv: ['--no-warnings']
  });

  const env = await pool.run('process.execArgv');
  assert.deepStrictEqual(env, ['--no-warnings']);
});

test('passing valid workerData works', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-workerdata.ts'),
    workerData: 'ABC'
  });
  assert.strictEqual(Piscina.workerData, undefined);

  await pool.run(null);
});

test('passing valid workerData works with named import', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-workerdata-named-import.ts'),
    workerData: 'ABC'
  });
  assert.strictEqual(Piscina.workerData, undefined);

  await pool.run(null);
});

test('passing valid workerData works with named import', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-workerdata-named-import.ts'),
    workerData: 'ABC'
  });
  assert.strictEqual(Piscina.workerData, undefined);

  await pool.run(null);
});

test('passing invalid workerData does not work', () => {
  assert.throws(() => new Piscina(({
    filename: resolve(__dirname, 'fixtures/simple-workerdata.ts'),
    workerData: {
      hello () {}
    }
  })), /could not be cloned./);
});

test('filename can be a file:// URL', async () => {
  const worker = new Piscina({
    filename: pathToFileURL(resolve(__dirname, 'fixtures/eval.js')).href
  });
  const result = await worker.run('42');
  assert.strictEqual(result, 42);
});

test('filename can be a file:// URL to an ESM module', {}, async () => {
  const worker = new Piscina({
    filename: pathToFileURL(resolve(__dirname, 'fixtures/esm-export.mjs')).href
  });
  const result = await worker.run('42');
  assert.strictEqual(result, 42);
});

test('duration and utilization calculations work', async () => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  // Initial utilization is always 0
  assert.strictEqual(worker.utilization, 0);

  await Promise.all([
    worker.run('42'),
    worker.run('41'),
    worker.run('40')
  ]);

  // utilization is going to be some non-deterministic value
  // between 0 and 1. It should not be zero at this point
  // because tasks have run, but it should also never be 1
  assert.ok(worker.utilization > 0);
  assert.ok(worker.utilization < 1);

  // Duration must be non-zero.
  assert.ok(worker.duration > 0);
});

test('run works also', async () => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  await worker.run(42);
});

test('named tasks work', async () => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/multiple.js')
  });

  assert.strictEqual(await worker.run({}, { name: 'a' }), 'a');
  assert.strictEqual(await worker.run({}, { name: 'b' }), 'b');
  assert.strictEqual(await worker.run({}), 'a');
});

test('named tasks work', async () => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/multiple.js'),
    name: 'b'
  });

  assert.strictEqual(await worker.run({}, { name: 'a' }), 'a');
  assert.strictEqual(await worker.run({}, { name: 'b' }), 'b');
  assert.strictEqual(await worker.run({}), 'b');
});
