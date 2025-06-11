import { once } from 'node:events';
import { resolve } from 'node:path';

import { test } from 'tap';

import Piscina from '..';

test('close()', async (t) => {
  t.test('no pending tasks', async (t) => {
    const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js') });
    await pool.close();
    t.pass('pool closed successfully');
  });

  t.test('no pending tasks (with minThreads=0)', async (t) => {
    const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js'), minThreads: 0 });
    await pool.close();
    t.pass('pool closed successfully');
  });
});

test('queued tasks waits for all tasks to complete', async (t) => {
  const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js'), maxThreads: 1 });

  const task1 = pool.run({ time: 100 });
  const task2 = pool.run({ time: 100 });

  setImmediate(() => t.resolves(pool.close(), 'close is resolved when all running tasks are completed'));

  await Promise.all([
    t.resolves(once(pool, 'close'), 'handler is called when pool is closed'),
    t.resolves(task1, 'complete running task'),
    t.resolves(task2, 'complete running task')
  ]);
});

test('abort any task enqueued during closing up', async (t) => {
  const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js'), maxThreads: 1 });

  setImmediate(() => {
    t.resolves(pool.close(), 'close is resolved when running tasks are completed');
    t.resolves(pool.run({ time: 1000 }).then(null, err => {
      t.equal(err.message, 'The task has been aborted');
      t.equal(err.cause, 'queue is being terminated');
    }));
  });

  await t.resolves(pool.run({ time: 100 }), 'complete running task');
});

test('force: queued tasks waits for all tasks already running and aborts tasks that are not started yet', async (t) => {
  const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js'), maxThreads: 1, concurrentTasksPerWorker: 2 });

  const task1 = pool.run({ time: 1000 });
  const task2 = pool.run({ time: 1000 });
  // const task3 = pool.run({ time: 100 });
  // const task4 = pool.run({ time: 100 });

  t.plan(6);

  t.resolves(pool.close({ force: true }));
  t.resolves(once(pool, 'close'), 'handler is called when pool is closed');
  t.resolves(task1, 'complete running task');
  t.resolves(task2, 'complete running task');
  t.rejects(pool.run({ time: 100 }), /The task has been aborted/, 'abort task that are not started yet');
  t.rejects(pool.run({ time: 100 }), /The task has been aborted/, 'abort task that are not started yet');

  await task1;
  await task2;
});

test('timed out close operation destroys the pool', async (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/sleep.js'),
    maxThreads: 1,
    closeTimeout: 500
  });

  const task1 = pool.run({ time: 5000 });
  const task2 = pool.run({ time: 5000 });

  setImmediate(() => t.resolves(pool.close(), 'close is resolved on timeout'));

  await Promise.all([
    t.resolves(once(pool, 'error'), 'error handler is called on timeout'),
    t.rejects(task1, /Terminating worker thread/, 'task is aborted due to timeout'),
    t.rejects(task2, /Terminating worker thread/, 'task is aborted due to timeout')
  ]);
});
