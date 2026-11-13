import * as assert from 'node:assert/strict';
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
      assert.strictEqual(err.cause, 'pool is closing');
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
    assert.doesNotReject(task1.catch(err => {
      assert.strictEqual(err.code, 'PISCINA_ERR_THREAD_TERMINATION');
    })),
    assert.doesNotReject(task2.catch(err => {
      assert.strictEqual(err.code, 'PISCINA_ERR_ABORT');
      assert.strictEqual(err.cause, 'pool is being destroyed');
    })),
  ]);
});

test('waits for every running task, not only the first one to finish', async () => {
  const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js'), minThreads: 3, maxThreads: 3 });

  const short = pool.run({ time: 50 });
  const long = pool.run({ time: 300 });

  await pool.close();

  await assert.doesNotReject(short, 'complete running task');
  await assert.doesNotReject(long, 'complete running task');
});

test('does not wait for the close timeout when the last running task\'s worker goes away', async () => {
  const pool = new Piscina({ filename: resolve(__dirname, 'fixtures/sleep.js'), minThreads: 2, maxThreads: 2, closeTimeout: 2000 });
  const errors: Error[] = [];
  pool.on('error', (err) => errors.push(err));

  const controller = new AbortController();
  const task = pool.run({ time: 1000 }, { signal: controller.signal }).then(() => null, (err) => err);
  setTimeout(() => controller.abort(), 50);

  const start = performance.now();
  await pool.close();

  assert.match((await task)?.message, /The task has been aborted/);
  assert.deepEqual(errors, []);
  assert.ok(performance.now() - start < 1000, 'close resolved once the aborted task was gone');
});
