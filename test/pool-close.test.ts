import { once } from 'node:events';
import { resolve } from 'node:path';

import { describe, it, test } from 'node:test';
import type { TestContext } from 'node:test';

import Piscina from '..';

describe('close()', async (t: TestContext) => {
  it('no pending tasks', async (t: TestContext) => {
    const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js') });
    await pool.close();
    t.assert.ok('pool closed successfully');
  });

  it('no pending tasks (with minThreads=0)', async (t: TestContext) => {
    const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js'), minThreads: 0 });
    await pool.close();
    t.assert.ok('pool closed successfully');
  });
});

test('queued tasks waits for all tasks to complete', async (t: TestContext) => {
  const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js'), maxThreads: 1 });

  const task1 = pool.run({ time: 100 });
  const task2 = pool.run({ time: 100 });
  setImmediate(() => t.assert.doesNotReject(pool.close(), 'close is resolved when all running tasks are completed'));
  await Promise.all([
    t.assert.doesNotReject(once(pool, 'close'), 'handler is called when pool is closed'),
    t.assert.doesNotReject(task1, 'complete running task'),
    t.assert.doesNotReject(task2, 'complete running task')
  ]);
});

test('abort any task enqueued during closing up', async (t: TestContext) => {
  const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js'), maxThreads: 1 });

  setImmediate(() => {
    t.assert.doesNotReject(pool.close(), 'close is resolved when running tasks are completed');
    t.assert.doesNotReject(pool.run({ time: 1000 }).then(null, err => {
      t.assert.strictEqual(err.message, 'The task has been aborted');
      t.assert.strictEqual(err.cause, 'queue is being terminated');
    }));
  });

  await t.assert.doesNotReject(pool.run({ time: 100 }), 'complete running task');
});

test('force: queued tasks waits for all tasks already running and aborts tasks that are not started yet', async (t: TestContext) => {
  const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js'), maxThreads: 1, concurrentTasksPerWorker: 2 });

  const task1 = pool.run({ time: 1000 });
  const task2 = pool.run({ time: 1000 });
  // const task3 = pool.run({ time: 100 });
  // const task4 = pool.run({ time: 100 });

  t.plan(6);

  t.assert.doesNotReject(pool.close({ force: true }));
  t.assert.doesNotReject(once(pool, 'close'), 'handler is called when pool is closed');
  t.assert.doesNotReject(task1, 'complete running task');
  t.assert.doesNotReject(task2, 'complete running task');
  t.assert.rejects(pool.run({ time: 100 }), /The task has been aborted/, 'abort task that are not started yet');
  t.assert.rejects(pool.run({ time: 100 }), /The task has been aborted/, 'abort task that are not started yet');

  await task1;
  await task2;
});

test('timed out close operation destroys the pool', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/sleep.js'),
    maxThreads: 1,
    closeTimeout: 500
  });

  const task1 = pool.run({ time: 5000 });
  const task2 = pool.run({ time: 5000 });

  setImmediate(() => t.assert.doesNotReject(pool.close(), 'close is resolved on timeout'));

  await Promise.all([
    t.assert.doesNotReject(once(pool, 'error'), 'error handler is called on timeout'),
    t.assert.rejects(task1, /Terminating worker thread/, 'task is aborted due to timeout'),
    t.assert.rejects(task2, /Terminating worker thread/, 'task is aborted due to timeout')
  ]);
});
