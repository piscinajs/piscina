import { test } from 'tap';
import { Task, kQueueOptions } from '../dist/src/common';
import { Piscina, FixedQueue } from '..';
import { resolve } from 'node:path';

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
  const queue = new FixedQueue();

  const batchSize = 2048;

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
  const queue = new FixedQueue();

  const batchSize = 2048;

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
  const queue = new FixedQueue();

  const batchSize = 2048;

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
