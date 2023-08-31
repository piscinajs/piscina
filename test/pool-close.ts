import { test } from 'tap';
import Piscina from '..';
import { resolve } from 'path';
import { once } from 'events';

test('close()', async (t) => {
  t.test('no pending tasks', async (t) => {
    const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js') });
    await pool.close();
    t.pass('pool closed successfully');
  });

  t.test('queued tasks waits for all tasks to complete', async (t) => {
    const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js'), maxThreads: 1 });

    const task1 = pool.run({ time: 100 });
    const task2 = pool.run({ time: 100 });

    setImmediate(() => t.resolves(pool.close(), 'close is resolved when all running tasks are completed'));

    await Promise.all([
      t.resolves(task1, 'complete running task'),
      t.resolves(task2, 'complete running task')
    ]);
  });

  t.test('abort any task enqueued during closing up', async (t) => {
    const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js'), maxThreads: 1 });

    setImmediate(() => {
      t.resolves(pool.close(), 'close is resolved when running tasks are completed');
      t.rejects(pool.run({ time: 1000 }), /The task has been aborted/, 'abort any task enqueued during close');
    });

    await t.resolves(pool.run({ time: 100 }), 'complete running task');
  });
});

test('close({force: true})', async (t) => {
  t.test('queued tasks waits for all tasks already running and aborts tasks that are not started yet', async (t) => {
    const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js'), maxThreads: 1 });

    const task1 = pool.run({ time: 100 });
    const task2 = pool.run({ time: 200 });

    setImmediate(() => t.resolves(pool.close({ force: true }), 'close is resolved when all running tasks are completed'));

    await Promise.all([
      t.resolves(task1, 'complete running task'),
      t.rejects(task2, /The task has been aborted/, 'abort task that are not started yet')
    ]);
  });

  t.test('queued tasks waits for all tasks already running and aborts tasks that are not started yet', async (t) => {
    const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js'), maxThreads: 1, concurrentTasksPerWorker: 2 });

    const task1 = pool.run({ time: 500 });
    const task2 = pool.run({ time: 100 });
    const task3 = pool.run({ time: 100 });
    const task4 = pool.run({ time: 100 });

    setImmediate(() => t.resolves(pool.close({ force: true }), 'close is resolved when all running tasks are completed'));

    await Promise.all([
      t.resolves(task1, 'complete running task'),
      t.resolves(task2, 'complete running task'),
      t.rejects(task3, /The task has been aborted/, 'abort task that are not started yet'),
      t.rejects(task4, /The task has been aborted/, 'abort task that are not started yet')
    ]);
  });
});

test('timed out close operation destroys the pool', async (t) => {
  const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js'), maxThreads: 1 });

  const task1 = pool.run({ time: 5000 });
  const task2 = pool.run({ time: 5000 });

  setImmediate(() => t.resolves(pool.close({ timeout: 500 }), 'close is resolved on timeout'));

  await Promise.all([
    t.resolves(once(pool, 'error'), 'error handler is called on timeout'),
    t.rejects(task1, /Terminating worker thread/, 'task is aborted due to timeout'),
    t.rejects(task2, /Terminating worker thread/, 'task is aborted due to timeout')
  ]);
});
