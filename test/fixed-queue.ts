import { test } from 'tap';
import { Task, kQueueOptions } from '../dist/src/common';
import { FixedQueue } from '..';

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

test('queue remove', async ({ equal }) => {
  const queue = new FixedQueue();

  const task = new QueueTask();

  equal(queue.size, 0, 'should be empty on start');

  queue.push(task);

  equal(queue.size, 1, 'should contain single task after push');

  queue.remove(task);

  equal(queue.size, 0, 'should be empty after task removal');
});

test('removing elements from intermediate CircularBuffer should not lead to issues', async ({ equal, same }) => {
  const queue = new FixedQueue();

  const firstBatch = Array.from({ length: 2048 }, () => new QueueTask());
  const secondBatch = Array.from({ length: 2048 }, () => new QueueTask());
  const thirdBatch = Array.from({ length: 2048 }, () => new QueueTask());

  const tasks = firstBatch.concat(secondBatch, thirdBatch);

  for (const task of tasks) {
    queue.push(task);
  }
  equal(queue.size, tasks.length, 'should contain 2048 * 3 items');

  for (const task of secondBatch) {
    queue.remove(task);
  }

  const expected = firstBatch.concat(thirdBatch);
  const actual = [];
  while (!queue.isEmpty()) {
    actual.push(queue.shift());
  }
  same(actual, expected);
});
