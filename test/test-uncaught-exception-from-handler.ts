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

  // This is the main assertion here.
  equal((await errorEvent)[0].message, 'not_caught');
});

test('exiting process resets worker', async ({ not, rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 1
  });
  const originalThreadId = pool.threads[0].threadId;
  await rejects(pool.runTask('process.exit(1);'), /worker exited with code: 1/);
  const newThreadId = pool.threads[0].threadId;
  not(originalThreadId, newThreadId);
});

test('exiting process in immediate after task errors next task and resets worker', async ({ equal, not, rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval-async.js'),
    minThreads: 1
  });

  const originalThreadId = pool.threads[0].threadId;
  const taskResult = await pool.runTask(`
    setTimeout(() => { process.exit(1); }, 50);
    42
  `);
  equal(taskResult, 42);

  await rejects(pool.runTask(`
  'use strict';

  const { promisify } = require('util');
  const sleep = promisify(setTimeout);
  async function _() {
    await sleep(1000);
    return 42
  }
  _();
  `), /worker exited with code: 1/);
  const secondThreadId = pool.threads[0].threadId;

  not(originalThreadId, secondThreadId);
});
