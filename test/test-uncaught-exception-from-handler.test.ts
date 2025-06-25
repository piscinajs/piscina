import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { once } from 'node:events';
import Piscina from '..';

test('uncaught exception resets Worker', ()=> {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });
  assert.rejects(pool.run('throw new Error("not_caught")'), /not_caught/);
});

test('uncaught exception in immediate resets Worker', ()=> {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });
  assert.rejects(
    pool.run(`
      setImmediate(() => { throw new Error("not_caught") });
      new Promise(() => {}) /* act as if we were doing some work */
    `), /not_caught/);
});

test('uncaught exception in immediate after task yields error event', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1,
    atomics: 'disabled'
  });

  const errorEvent : Promise<Error[]> = once(pool, 'error');

  const taskResult = pool.run(`
    setTimeout(() => { throw new Error("not_caught") }, 5);
    42
  `);

  assert.strictEqual(await taskResult, 42);

  // Hack a bit to make sure we get the 'exit'/'error' events.
  assert.strictEqual(pool.threads.length, 1);
  pool.threads[0].ref();

  // This is the main assertion here.
  assert.strictEqual((await errorEvent)[0].message, 'not_caught');
});

test('exiting process resets worker', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 1
  });
  const originalThreadId = pool.threads[0].threadId;
  await assert.rejects(pool.run('process.exit(1);'), /worker exited with code: 1/);
  const newThreadId = pool.threads[0].threadId;
  assert.notStrictEqual(originalThreadId, newThreadId);
});

test('exiting process in immediate after task errors next task and resets worker', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval-async.js'),
    minThreads: 1
  });

  const originalThreadId = pool.threads[0].threadId;
  const taskResult = await pool.run(`
    setTimeout(() => { process.exit(1); }, 5);
    42
  `);
  assert.strictEqual(taskResult, 42);

  await assert.rejects(pool.run(`
  'use strict';

  const { promisify } = require('node:util');
  const sleep = promisify(setTimeout);
  async function _() {
    await sleep(5);
    return 42
  }
  _();
  `), /worker exited with code: 1/);
  const secondThreadId = pool.threads[0].threadId;

  assert.notStrictEqual(originalThreadId, secondThreadId);
});
