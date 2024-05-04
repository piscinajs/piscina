import { test } from 'tap';
import { Task, kQueueOptions } from '../dist/src/common';
import FixedQueue from '../dist/src/fixed-queue';

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
