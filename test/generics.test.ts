import { resolve } from 'path';
import Piscina from '../dist';
import { test } from 'node:test';
import type { TestContext } from 'node:test';

test('Piscina<T , R> works', async (t: TestContext) => {
  const worker = new Piscina<string, number>({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  const result: number = await worker.run('Promise.resolve(42)');
  t.assert.strictEqual(result, 42);
});

test('Piscina with no generic works', async (t: TestContext) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  const result = await worker.run('Promise.resolve("Hello, world!")');
  t.assert.strictEqual(result, 'Hello, world!');
});

test('Piscina<T, R> typescript complains when invalid Task is supplied as wrong type', async (t: TestContext) => {
  const worker = new Piscina<string, number>({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  // @ts-expect-error complains due to invalid Task being number when expecting string
  const result = await worker.run(42);

  t.assert.strictEqual(result, 42);
});

test('Piscina<T, R> typescript complains when assigning Result to wrong type', async (t: TestContext) => {
  const worker = new Piscina<string, number>({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  // @ts-expect-error complains due to expecting a number but being assigned to a string
  const result: string = await worker.run('Promise.resolve(42)');
  t.assert.strictEqual(result, 42);
});
