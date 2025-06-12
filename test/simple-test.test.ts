import Piscina from '..';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { version } from '../package.json';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { EventEmitter } from 'events';

test('Piscina is exposed on export', async (t: TestContext) => {
  t.assert.strictEqual(Piscina.version, version);
});

test('Piscina is exposed on itself', async (t: TestContext) => {
  t.assert.strictEqual(Piscina.Piscina, Piscina);
});

test('Piscina.isWorkerThread has the correct value', async (t: TestContext) => {
  t.assert.strictEqual(Piscina.isWorkerThread, false);
});

test('Piscina.isWorkerThread has the correct value (worker)', async (t: TestContext) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread.ts')
  });
  const result = await worker.run(null);
  t.assert.strictEqual(result, 'done');
});

test('Piscina.isWorkerThread has the correct value (worker) with named import', async (t: TestContext) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread-named-import.ts')
  });
  const result = await worker.run(null);
  t.assert.strictEqual(result, 'done');
});

test('Piscina.isWorkerThread has the correct value (worker) with named import', async (t: TestContext) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread-named-import.ts')
  });
  const result = await worker.run(null);
  t.assert.strictEqual(result, 'done');
});

test('Piscina instance is an EventEmitter', async (t: TestContext) => {
  const piscina = new Piscina();
  t.assert.ok(piscina instanceof EventEmitter);
});

test('Piscina constructor options are correctly set', async (t: TestContext) => {
  const piscina = new Piscina({
    minThreads: 10,
    maxThreads: 20,
    maxQueue: 30
  });

  t.assert.strictEqual(piscina.options.minThreads, 10);
  t.assert.strictEqual(piscina.options.maxThreads, 20);
  t.assert.strictEqual(piscina.options.maxQueue, 30);
});

test('trivial eval() handler works', async (t: TestContext) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });
  const result = await worker.run('42');
  t.assert.strictEqual(result, 42);
});

test('async eval() handler works', async (t: TestContext) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });
  const result = await worker.run('Promise.resolve(42)');
  t.assert.strictEqual(result, 42);
});

test('filename can be provided while posting', async (t: TestContext) => {
  const worker = new Piscina();
  const result = await worker.run(
    'Promise.resolve(42)',
    { filename: resolve(__dirname, 'fixtures/eval.js') });
  t.assert.strictEqual(result, 42);
});

test('filename can be null when initially provided', async (t: TestContext) => {
  const worker = new Piscina({ filename: null });
  const result = await worker.run(
    'Promise.resolve(42)',
    { filename: resolve(__dirname, 'fixtures/eval.js') });
  t.assert.strictEqual(result, 42);
});

test('filename must be provided while posting', async (t: TestContext) => {
  const worker = new Piscina();
  t.assert.rejects(worker.run('doesn’t matter'),
    /filename must be provided to run\(\) or in options object/);
});

test('passing env to workers works', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    env: { A: 'foo' }
  });

  const env = await pool.run('({...process.env})');
  t.assert.deepStrictEqual(env, { A: 'foo' });
});

test('passing argv to workers works', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    argv: ['a', 'b', 'c']
  });

  const env = await pool.run('process.argv.slice(2)');
  t.assert.deepStrictEqual(env, ['a', 'b', 'c']);
});

test('passing execArgv to workers works', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    execArgv: ['--no-warnings']
  });

  const env = await pool.run('process.execArgv');
  t.assert.deepStrictEqual(env, ['--no-warnings']);
});

test('passing valid workerData works', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-workerdata.ts'),
    workerData: 'ABC'
  });
  t.assert.strictEqual(Piscina.workerData, undefined);

  await pool.run(null);
});

test('passing valid workerData works with named import', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-workerdata-named-import.ts'),
    workerData: 'ABC'
  });
  t.assert.strictEqual(Piscina.workerData, undefined);

  await pool.run(null);
});

test('passing valid workerData works with named import', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-workerdata-named-import.ts'),
    workerData: 'ABC'
  });
  t.assert.strictEqual(Piscina.workerData, undefined);

  await pool.run(null);
});

test('passing invalid workerData does not work', async (t: TestContext) => {
  t.assert.throws(() => new Piscina(({
    filename: resolve(__dirname, 'fixtures/simple-workerdata.ts'),
    workerData: {
      hello () {}
    }
  }) as any), /could not be cloned./);
});

test('filename can be a file:// URL', async (t: TestContext) => {
  const worker = new Piscina({
    filename: pathToFileURL(resolve(__dirname, 'fixtures/eval.js')).href
  });
  const result = await worker.run('42');
  t.assert.strictEqual(result, 42);
});

test('filename can be a file:// URL to an ESM module', {}, async (t: TestContext) => {
  const worker = new Piscina({
    filename: pathToFileURL(resolve(__dirname, 'fixtures/esm-export.mjs')).href
  });
  const result = await worker.run('42');
  t.assert.strictEqual(result, 42);
});

test('duration and utilization calculations work', async (t: TestContext) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  // Initial utilization is always 0
  t.assert.strictEqual(worker.utilization, 0);

  await Promise.all([
    worker.run('42'),
    worker.run('41'),
    worker.run('40')
  ]);

  // utilization is going to be some non-deterministic value
  // between 0 and 1. It should not be zero at this point
  // because tasks have run, but it should also never be 1
  t.assert.ok(worker.utilization > 0);
  t.assert.ok(worker.utilization < 1);

  // Duration must be non-zero.
  t.assert.ok(worker.duration > 0);
});

test('run works also', async () => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  await worker.run(42);
});

test('named tasks work', async (t: TestContext) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/multiple.js')
  });

  t.assert.strictEqual(await worker.run({}, { name: 'a' }), 'a');
  t.assert.strictEqual(await worker.run({}, { name: 'b' }), 'b');
  t.assert.strictEqual(await worker.run({}), 'a');
});

test('named tasks work', async (t: TestContext) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/multiple.js'),
    name: 'b'
  });

  t.assert.strictEqual(await worker.run({}, { name: 'a' }), 'a');
  t.assert.strictEqual(await worker.run({}, { name: 'b' }), 'b');
  t.assert.strictEqual(await worker.run({}), 'b');
});
