import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { kQueueOptions } from '../dist/symbols';
import { FixedQueue, ArrayTaskQueue, PiscinaTask as Task } from '..';

// @ts-expect-error - it misses several properties, but it's enough for the test
class NumberedTask implements Task {
  constructor(readonly index: number) {}
  get [kQueueOptions] () {
    return null;
  }
}

for (const QueueClass of [FixedQueue, ArrayTaskQueue]) {
  test(`${QueueClass.name} - unshift`, () => {
    const bufferSize = 2048;
    let queue = new QueueClass();

    queue.unshift(new NumberedTask(1));
    assert.equal(queue.size, 1);

    for (let i = 2; i <= bufferSize + 10; ++i) {
      queue.unshift(new NumberedTask(i));
    }
    assert.equal(queue.size, bufferSize + 10);

    for (let i = 0; i < 5; ++i) {
      assert.equal((queue.shift() as NumberedTask).index, bufferSize + 10 - i);
    }
    assert.equal(queue.size, bufferSize + 5);

    for (let i = 0; i < bufferSize + 5; ++i) {
      assert.equal((queue.shift() as NumberedTask).index, bufferSize + 5 - i);
    }
    assert.equal(queue.size, 0);

    queue = new QueueClass();
    queue.push(new NumberedTask(1));
    queue.push(new NumberedTask(2));
    queue.push(new NumberedTask(3));
    queue.push(new NumberedTask(4));
    queue.push(new NumberedTask(5));
    assert.equal((queue.shift() as NumberedTask).index, 1);
    assert.equal((queue.shift() as NumberedTask).index, 2);
    assert.equal((queue.shift() as NumberedTask).index, 3);
    assert.equal(queue.size, 2);
    queue.unshift(new NumberedTask(6));
    queue.unshift(new NumberedTask(7));
    queue.unshift(new NumberedTask(8));
    queue.unshift(new NumberedTask(9));
    assert.equal((queue.shift() as NumberedTask).index, 9);
    assert.equal((queue.shift() as NumberedTask).index, 8);
    assert.equal((queue.shift() as NumberedTask).index, 7);
    assert.equal((queue.shift() as NumberedTask).index, 6);
    assert.equal((queue.shift() as NumberedTask).index, 4);
    assert.equal((queue.shift() as NumberedTask).index, 5);
  });
}
