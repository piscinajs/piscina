import Piscina from '..';
import { test } from 'tap';
import { resolve } from 'path';
import { once } from 'events';

test('uncaught exception resets Worker', async ({ rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });
  await rejects(pool.runTask('throw new Error("not_caught")'), /not_caught/);
});

test('uncaught exception in immediate resets Worker', async ({ rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });
  await rejects(
    pool.runTask(`
      setImmediate(() => { throw new Error("not_caught") });
      new Promise(() => {}) /* act as if we were doing some work */
    `), /not_caught/);
});

test('uncaught exception in immediate after task yields error event', async ({ equal }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1,
    useAtomics: false
  });

  const errorEvent : Promise<Error[]> = once(pool, 'error');

  const taskResult = pool.runTask(`
    setTimeout(() => { throw new Error("not_caught") }, 500);
    42
  `);

  equal(await taskResult, 42);

  // Hack a bit to make sure we get the 'exit'/'error' events.
  equal(pool.threads.length, 1);
  pool.threads[0].ref();

  // This is the main aassertion here.
  equal((await errorEvent)[0].message, 'not_caught');
});

test('using parentPort is treated as an error', async ({ rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });
  await rejects(
    pool.runTask(`
      require('worker_threads').parentPort.postMessage("some message");
      new Promise(() => {}) /* act as if we were doing some work */
    `), /Unexpected message on Worker: 'some message'/);
});
