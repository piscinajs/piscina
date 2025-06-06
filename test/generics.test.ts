import { resolve } from 'path';
import Piscina from '..';
import { test } from 'tap';

test('Piscina<T , R> works', async ({ equal }) => {
  const worker = new Piscina<string, number>({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  const result: number = await worker.run('Promise.resolve(42)');
  equal(result, 42);
});

test('Piscina with no generic works', async ({ equal }) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  const result = await worker.run('Promise.resolve("Hello, world!")');
  equal(result, 'Hello, world!');
});

test('Piscina<T, R> typescript complains when invalid Task is supplied as wrong type', async ({ equal }) => {
  const worker = new Piscina<string, number>({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  // @ts-expect-error complains due to invalid Task being number when expecting string
  const result = await worker.run(42);

  equal(result, 42);
});

test('Piscina<T, R> typescript complains when assigning Result to wrong type', async ({ equal }) => {
  const worker = new Piscina<string, number>({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  // @ts-expect-error complains due to expecting a number but being assigned to a string
  const result: string = await worker.run('Promise.resolve(42)');
  equal(result, 42);
});
