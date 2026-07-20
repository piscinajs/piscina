'use strict';

const spq = require('shuffled-priority-queue');
const Piscina = require('../..');
const { resolve } = require('path');

// By default, Piscina uses a simple Fifo array task queue.
// This example replaces the default task queue with a
// priority queue.

// When a task is submitted to the pool, if there are workers
// available it will be dispatched immediately, regardless of
// the priority. The task queue is only used if there are no
// free workers

const kItem = Symbol('item');

class PriorityTaskQueue {
  queue = spq();

  get size () { return this.queue.length; }

  push (value) {
    const queueOptions = value[Piscina.queueOptionsSymbol];
    const priority = queueOptions ? (queueOptions.priority || 0) : 0;
    value[kItem] = this.queue.add({ priority, value });
  }

  remove (value) {
    this.queue.remove(value[kItem]);
  }

  shift () {
    return this.queue.shift().value;
  }
}

const pool = new Piscina({
  filename: resolve(__dirname, 'worker.js'),
  taskQueue: new PriorityTaskQueue(),
  maxThreads: 4
});

function makeTask (task, priority) {
  return { ...task, [Piscina.queueOptionsSymbol]: { priority } };
}

(async () => {
  // Submit enough tasks to ensure that at least some are queued
  console.log(await Promise.all([
    pool.run(makeTask({ priority: 1 }, 1)),
    pool.run(makeTask({ priority: 2 }, 2)),
    pool.run(makeTask({ priority: 3 }, 3)),
    pool.run(makeTask({ priority: 4 }, 4)),
    pool.run(makeTask({ priority: 5 }, 5)),
    pool.run(makeTask({ priority: 6 }, 6)),
    pool.run(makeTask({ priority: 7 }, 7)),
    pool.run(makeTask({ priority: 8 }, 8))
  ]));
})();
