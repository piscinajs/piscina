import assert from 'node:assert/strict';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { describe, it, test } from 'node:test';
import Piscina from '..';

describe('close()', () => {
  it('no pending tasks', async () => {
    const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js') });
    await pool.close();
    assert.ok('pool closed successfully');
  });

  it('no pending tasks (with minThreads=0)', async () => {
    const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js'), minThreads: 0 });
    await pool.close();
    assert.ok('pool closed successfully');
  });
});

test('queued tasks waits for all tasks to complete', async () => {
  const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js'), maxThreads: 1 });

  const task1 = pool.run({ time: 100 });
  const task2 = pool.run({ time: 100 });
  setImmediate(() => assert.doesNotReject(pool.close(), 'close is resolved when all running tasks are completed'));
  await Promise.all([
    assert.doesNotReject(once(pool, 'close'), 'handler is called when pool is closed'),
    assert.doesNotReject(task1, 'complete running task'),
    assert.doesNotReject(task2, 'complete running task')
  ]);
});

test('abort any task enqueued during closing up', async () => {
  const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js'), maxThreads: 1 });

  setImmediate(() => {
    assert.doesNotReject(pool.close(), 'close is resolved when running tasks are completed');
    assert.doesNotReject(pool.run({ time: 1000 }).then(null, err => {
      assert.strictEqual(err.message, 'The task has been aborted');
      assert.strictEqual(err.cause, 'queue is being terminated');
    }));
  });

  await assert.doesNotReject(pool.run({ time: 100 }), 'complete running task');
});

test('force: queued tasks waits for all tasks already running and aborts tasks that are not started yet', async () => {
  const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js'), maxThreads: 1, concurrentTasksPerWorker: 2 });

  const task1 = pool.run({ time: 5 });
  const task2 = pool.run({ time: 5 });
  // const task3 = pool.run({ time: 100 });
  // const task4 = pool.run({ time: 100 });

  assert.doesNotReject(pool.close({ force: true }));
  assert.doesNotReject(once(pool, 'close'), 'handler is called when pool is closed');
  assert.doesNotReject(task1, 'complete running task');
  assert.doesNotReject(task2, 'complete running task');
  assert.rejects(pool.run({ time: 100 }), /The task has been aborted/, 'abort task that are not started yet');
  assert.rejects(pool.run({ time: 100 }), /The task has been aborted/, 'abort task that are not started yet');

  await task1;
  await task2;
});

test('timed out close operation destroys the pool', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/sleep.js'),
    maxThreads: 1,
    closeTimeout: 5 // 5ms
  });

  const task1 = pool.run({ time: 50 });
  const task2 = pool.run({ time: 50 });

  setImmediate(() => assert.doesNotReject(pool.close(), 'close is resolved on timeout'));

  await Promise.all([
    assert.doesNotReject(once(pool, 'error'), 'error handler is called on timeout'),
    assert.rejects(task1, /Terminating worker thread/, 'task is aborted due to timeout'),
    assert.rejects(task2, /Terminating worker thread/, 'task is aborted due to timeout')
  ]);
});
