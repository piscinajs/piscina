import Piscina from '..';
import { test } from 'tap';
import { version } from '../package.json';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { EventEmitter } from 'events';

test('Piscina is exposed on export', async ({ equal }) => {
  equal(Piscina.version, version);
});

test('Piscina is exposed on itself', async ({ equal }) => {
  equal(Piscina.Piscina, Piscina);
});

test('Piscina.isWorkerThread has the correct value', async ({ equal }) => {
  equal(Piscina.isWorkerThread, false);
});

test('Piscina.isWorkerThread has the correct value (worker)', async ({ equal }) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread.ts')
  });
  const result = await worker.run(null);
  equal(result, 'done');
});

test('Piscina.isWorkerThread has the correct value (worker) with named import', async ({ equal }) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread-named-import.ts')
  });
  const result = await worker.run(null);
  equal(result, 'done');
});

test('Piscina.isWorkerThread has the correct value (worker) with named import', async ({ equal }) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread-named-import.ts')
  });
  const result = await worker.run(null);
  equal(result, 'done');
});

test('Piscina instance is an EventEmitter', async ({ ok }) => {
  const piscina = new Piscina();
  ok(piscina instanceof EventEmitter);
});

test('Piscina constructor options are correctly set', async ({ equal }) => {
  const piscina = new Piscina({
    minThreads: 10,
    maxThreads: 20,
    maxQueue: 30
  });

  equal(piscina.options.minThreads, 10);
  equal(piscina.options.maxThreads, 20);
  equal(piscina.options.maxQueue, 30);
});

test('trivial eval() handler works', async ({ equal }) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });
  const result = await worker.run('42');
  equal(result, 42);
});

test('async eval() handler works', async ({ equal }) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });
  const result = await worker.run('Promise.resolve(42)');
  equal(result, 42);
});

test('filename can be provided while posting', async ({ equal }) => {
  const worker = new Piscina();
  const result = await worker.run(
    'Promise.resolve(42)',
    { filename: resolve(__dirname, 'fixtures/eval.js') });
  equal(result, 42);
});

test('filename can be null when initially provided', async ({ equal }) => {
  const worker = new Piscina({ filename: null });
  const result = await worker.run(
    'Promise.resolve(42)',
    { filename: resolve(__dirname, 'fixtures/eval.js') });
  equal(result, 42);
});

test('filename must be provided while posting', async ({ rejects }) => {
  const worker = new Piscina();
  rejects(worker.run('doesn’t matter'),
    /filename must be provided to run\(\) or in options object/);
});

test('passing env to workers works', async ({ same }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    env: { A: 'foo' }
  });

  const env = await pool.run('({...process.env})');
  same(env, { A: 'foo' });
});

test('passing argv to workers works', async ({ same }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    argv: ['a', 'b', 'c']
  });

  const env = await pool.run('process.argv.slice(2)');
  same(env, ['a', 'b', 'c']);
});

test('passing execArgv to workers works', async ({ same }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    execArgv: ['--no-warnings']
  });

  const env = await pool.run('process.execArgv');
  same(env, ['--no-warnings']);
});

test('passing valid workerData works', async ({ equal }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-workerdata.ts'),
    workerData: 'ABC'
  });
  equal(Piscina.workerData, undefined);

  await pool.run(null);
});

test('passing valid workerData works with named import', async ({ equal }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-workerdata-named-import.ts'),
    workerData: 'ABC'
  });
  equal(Piscina.workerData, undefined);

  await pool.run(null);
});

test('passing valid workerData works with named import', async ({ equal }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-workerdata-named-import.ts'),
    workerData: 'ABC'
  });
  equal(Piscina.workerData, undefined);

  await pool.run(null);
});

test('passing invalid workerData does not work', async ({ throws }) => {
  throws(() => new Piscina(({
    filename: resolve(__dirname, 'fixtures/simple-workerdata.ts'),
    workerData: {
      hello () {}
    }
  }) as any), /could not be cloned./);
});

test('filename can be a file:// URL', async ({ equal }) => {
  const worker = new Piscina({
    filename: pathToFileURL(resolve(__dirname, 'fixtures/eval.js')).href
  });
  const result = await worker.run('42');
  equal(result, 42);
});

test('filename can be a file:// URL to an ESM module', {}, async ({ equal }) => {
  const worker = new Piscina({
    filename: pathToFileURL(resolve(__dirname, 'fixtures/esm-export.mjs')).href
  });
  const result = await worker.run('42');
  equal(result, 42);
});

test('duration and utilization calculations work', async ({ equal, ok }) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  // Initial utilization is always 0
  equal(worker.utilization, 0);

  await Promise.all([
    worker.run('42'),
    worker.run('41'),
    worker.run('40')
  ]);

  // utilization is going to be some non-deterministic value
  // between 0 and 1. It should not be zero at this point
  // because tasks have run, but it should also never be 1
  ok(worker.utilization > 0);
  ok(worker.utilization < 1);

  // Duration must be non-zero.
  ok(worker.duration > 0);
});

test('run works also', async () => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  await worker.run(42);
});

test('named tasks work', async ({ equal }) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/multiple.js')
  });

  equal(await worker.run({}, { name: 'a' }), 'a');
  equal(await worker.run({}, { name: 'b' }), 'b');
  equal(await worker.run({}), 'a');
});

test('named tasks work', async ({ equal }) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/multiple.js'),
    name: 'b'
  });

  equal(await worker.run({}, { name: 'a' }), 'a');
  equal(await worker.run({}, { name: 'b' }), 'b');
  equal(await worker.run({}), 'b');
});
