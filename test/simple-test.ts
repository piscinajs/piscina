import Piscina from '..';
import { test } from 'tap';
import { version } from '../package.json';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { EventEmitter } from 'events';

test('Piscina is exposed on export', async ({ is }) => {
  is(Piscina.version, version);
});

test('Piscina is exposed on itself', async ({ is }) => {
  is(Piscina.Piscina, Piscina);
});

test('Piscina.isWorkerThread has the correct value', async ({ is }) => {
  is(Piscina.isWorkerThread, false);
});

test('Piscina.isWorkerThread has the correct value (worker)', async ({ is }) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread.ts')
  });
  const result = await worker.runTask(null);
  is(result, 'done');
});

test('Piscina instance is an EventEmitter', async ({ ok }) => {
  const piscina = new Piscina();
  ok(piscina instanceof EventEmitter);
});

test('Piscina constructor options are correctly set', async ({ is }) => {
  const piscina = new Piscina({
    minThreads: 10,
    maxThreads: 20,
    maxQueue: 30
  });

  is(piscina.options.minThreads, 10);
  is(piscina.options.maxThreads, 20);
  is(piscina.options.maxQueue, 30);
});

test('trivial eval() handler works', async ({ is }) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });
  const result = await worker.runTask('42');
  is(result, 42);
});

test('async eval() handler works', async ({ is }) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });
  const result = await worker.runTask('Promise.resolve(42)');
  is(result, 42);
});

test('filename can be provided while posting', async ({ is }) => {
  const worker = new Piscina();
  const result = await worker.runTask(
    'Promise.resolve(42)',
    resolve(__dirname, 'fixtures/eval.js'));
  is(result, 42);
});

test('filename can be null when initially provided', async ({ is }) => {
  const worker = new Piscina({ filename: null });
  const result = await worker.runTask(
    'Promise.resolve(42)',
    resolve(__dirname, 'fixtures/eval.js'));
  is(result, 42);
});

test('filename must be provided while posting', async ({ rejects }) => {
  const worker = new Piscina();
  rejects(worker.runTask('doesn’t matter'),
    /filename must be provided to runTask\(\) or in options object/);
});

test('passing env to workers works', async ({ same }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    env: { A: 'foo' }
  });

  const env = await pool.runTask('({...process.env})');
  same(env, { A: 'foo' });
});

test('passing argv to workers works', async ({ same }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    argv: ['a', 'b', 'c']
  });

  const env = await pool.runTask('process.argv.slice(2)');
  same(env, ['a', 'b', 'c']);
});

test('passing execArgv to workers works', async ({ same }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    execArgv: ['--no-warnings']
  });

  const env = await pool.runTask('process.execArgv');
  same(env, ['--no-warnings']);
});

test('passing valid workerData works', async ({ is }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-workerdata.ts'),
    workerData: 'ABC'
  });
  is(Piscina.workerData, undefined);

  await pool.runTask(null);
});

test('passing invalid workerData does not work', async ({ throws }) => {
  throws(() => new Piscina(({
    filename: resolve(__dirname, 'fixtures/simple-workerdata.ts'),
    workerData: process.env
  }) as any), /Cannot transfer object of unsupported type./);
});

test('filename can be a file:// URL', async ({ is }) => {
  const worker = new Piscina({
    filename: pathToFileURL(resolve(__dirname, 'fixtures/eval.js')).href
  });
  const result = await worker.runTask('42');
  is(result, 42);
});

test('filename can be a file:// URL to an ESM module', {
  skip: process.version.startsWith('v12.') // ESM support is flagged on v12.x
}, async ({ is }) => {
  const worker = new Piscina({
    filename: pathToFileURL(resolve(__dirname, 'fixtures/esm-export.mjs')).href
  });
  const result = await worker.runTask('42');
  is(result, 42);
});

test('duration and utilization calculations work', async ({ is, ok }) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  // Initial utilization is always 0
  is(worker.utilization, 0);

  await Promise.all([
    worker.runTask('42'),
    worker.runTask('41'),
    worker.runTask('40')
  ]);

  // utilization is going to be some non-deterministic value
  // between 0 and 1. It should not be zero at this point
  // because tasks have run, but it should also never be 1
  ok(worker.utilization > 0);
  ok(worker.utilization < 1);

  // Duration must be non-zero.
  ok(worker.duration > 0);
});
