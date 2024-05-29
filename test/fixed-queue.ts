import { test } from 'tap';
import { kQueueOptions } from '../dist/symbols';
import { Piscina, FixedQueue, PiscinaTask as Task } from '..';
import { resolve } from 'node:path';

// @ts-expect-error - it misses several properties, but it's enough for the test
class QueueTask implements Task {
  get [kQueueOptions] () {
    return null;
  }
}

test('queue length', async ({ equal }) => {
  const queue = new FixedQueue();

  equal(queue.size, 0);

  queue.push(new QueueTask());

  equal(queue.size, 1);

  queue.shift();

  equal(queue.size, 0);
});

test('queue length should not become negative', async ({ equal }) => {
  const queue = new FixedQueue();

  equal(queue.size, 0);

  queue.shift();

  equal(queue.size, 0);
});

test('queue remove', async ({ equal }) => {
  const queue = new FixedQueue();

  const task = new QueueTask();

  equal(queue.size, 0, 'should be empty on start');

  queue.push(task);

  equal(queue.size, 1, 'should contain single task after push');

  queue.remove(task);

  equal(queue.size, 0, 'should be empty after task removal');
});

test('remove not queued task should not lead to errors', async ({ equal }) => {
  const queue = new FixedQueue();

  const task = new QueueTask();

  equal(queue.size, 0, 'should be empty on start');

  queue.remove(task);

  equal(queue.size, 0, 'should be empty after task removal');
});

test('removing elements from intermediate CircularBuffer should not lead to issues', async ({ equal, same }) => {
  /*
      The test intends to check following scenario:
      1) We fill the queue with 3 full circular buffers amount of items.
      2) Empty the middle circular buffer with remove().
      3) This should lead to the removal of the middle buffer from the queue:
         - Before emptying: tail buffer -> middle buffer -> head buffer.
         - After emptying: tail buffer -> head buffer.
   */

  const queue = new FixedQueue();

  // size of single circular buffer
  const batchSize = 2047;

  const firstBatch = Array.from({ length: batchSize }, () => new QueueTask());
  const secondBatch = Array.from({ length: batchSize }, () => new QueueTask());
  const thirdBatch = Array.from({ length: batchSize }, () => new QueueTask());

  const tasks = firstBatch.concat(secondBatch, thirdBatch);

  for (const task of tasks) {
    queue.push(task);
  }
  equal(queue.size, tasks.length, `should contain ${batchSize} * 3 items`);

  let size = queue.size;
  for (const task of secondBatch) {
    queue.remove(task);
    equal(queue.size, --size, `should contain ${size} items`);
  }

  const expected = firstBatch.concat(thirdBatch);
  const actual = [];
  while (!queue.isEmpty()) {
    const task = queue.shift();
    actual.push(task);
  }
  same(actual, expected);
});

test('removing elements from first CircularBuffer should not lead to issues', async ({ equal, same }) => {
  /*
      The test intends to check following scenario:
      1) We fill the queue with 3 full circular buffers amount of items.
      2) Empty the first circular buffer with remove().
      3) This should lead to the removal of the tail buffer from the queue:
         - Before emptying: tail buffer -> middle buffer -> head buffer.
         - After emptying: tail buffer (previously middle) -> head buffer.
   */
  const queue = new FixedQueue();

  // size of single circular buffer
  const batchSize = 2047;

  const firstBatch = Array.from({ length: batchSize }, () => new QueueTask());
  const secondBatch = Array.from({ length: batchSize }, () => new QueueTask());
  const thirdBatch = Array.from({ length: batchSize }, () => new QueueTask());

  const tasks = firstBatch.concat(secondBatch, thirdBatch);

  for (const task of tasks) {
    queue.push(task);
  }
  equal(queue.size, tasks.length, `should contain ${batchSize} * 3 items`);

  let size = queue.size;
  for (const task of firstBatch) {
    queue.remove(task);
    equal(queue.size, --size, `should contain ${size} items`);
  }

  const expected = secondBatch.concat(thirdBatch);
  const actual = [];
  while (!queue.isEmpty()) {
    const task = queue.shift();
    actual.push(task);
  }
  same(actual, expected);
});

test('removing elements from last CircularBuffer should not lead to issues', async ({ equal, same }) => {
  /*
      The test intends to check following scenario:
      1) We fill the queue with 3 full circular buffers amount of items.
      2) Empty the last circular buffer with remove().
      3) This should lead to the removal of the head buffer from the queue:
         - Before emptying: tail buffer -> middle buffer -> head buffer.
         - After emptying: tail buffer -> head buffer (previously middle).
   */
  const queue = new FixedQueue();

  // size of single circular buffer
  const batchSize = 2047;

  const firstBatch = Array.from({ length: batchSize }, () => new QueueTask());
  const secondBatch = Array.from({ length: batchSize }, () => new QueueTask());
  const thirdBatch = Array.from({ length: batchSize }, () => new QueueTask());

  const tasks = firstBatch.concat(secondBatch, thirdBatch);

  for (const task of tasks) {
    queue.push(task);
  }
  equal(queue.size, tasks.length, `should contain ${batchSize} * 3 items`);

  let size = queue.size;
  for (const task of thirdBatch) {
    queue.remove(task);
    equal(queue.size, --size, `should contain ${size} items`);
  }

  const expected = firstBatch.concat(secondBatch);
  const actual = [];
  while (!queue.isEmpty()) {
    const task = queue.shift();
    actual.push(task);
  }
  same(actual, expected);
});

test('simple integraion with Piscina', async ({ equal }) => {
  const queue = new FixedQueue();
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread-named-import.ts'),
    taskQueue: queue
  });

  const result = await pool.runTask(null);
  equal(result, 'done');
});

test('concurrent calls with Piscina', async ({ same }) => {
  const queue = new FixedQueue();
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval-async.js'),
    taskQueue: queue
  });

  const tasks = ['1+1', '2+2', '3+3'];
  const results = await Promise.all(tasks.map((task) => pool.runTask(task)));
  // eslint-disable-next-line
  const expected = tasks.map(eval);

  same(results, expected);
});
