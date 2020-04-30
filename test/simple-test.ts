import Piscina from '..';
import { test } from 'tap';
import { version } from '../package.json';
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
