import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import Piscina from '../dist';

test('Piscina<T , R> works', async () => {
  const worker = new Piscina<string, number>({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  const result: number = await worker.run('Promise.resolve(42)');

  assert.strictEqual(result, 42);
});

test('Piscina with no generic works', async () => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  const result = await worker.run('Promise.resolve("Hello, world!")');

  assert.strictEqual(result, 'Hello, world!');
});

test('Piscina<T, R> typescript complains when invalid Task is supplied as wrong type', async () => {
  const worker = new Piscina<string, number>({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  // @ts-expect-error complains due to invalid Task being number when expecting string
  const result = await worker.run(42);

  assert.strictEqual(result, 42);
});

test('Piscina<T, R> typescript complains when assigning Result to wrong type', async () => {
  const worker = new Piscina<string, number>({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  // @ts-expect-error complains due to expecting a number but being assigned to a string
  const result: string = await worker.run('Promise.resolve(42)');

  assert.strictEqual(result, 42);
});
