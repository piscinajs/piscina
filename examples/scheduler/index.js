'use strict';
const { resolve } = require('node:path');
const { Piscina, PiscinaBaseTaskScheduler } = require('../..');

class CustomTaskScheduler extends PiscinaBaseTaskScheduler {
  #maxConcurrent = 0;
  #readyWorkers = new Set();
  #pendingWorkers = new Set();
  // TODO: create its own type?
  #onAvailableListeners = [];
  #offset = 0;

  constructor (maxConcurrent) {
    super(maxConcurrent);
    this.#maxConcurrent = maxConcurrent;
  }

  add (item) {
    this.#pendingWorkers.add(item);
    item.onReady(() => {
      /* istanbul ignore else */
      if (this.#pendingWorkers.has(item)) {
        this.#pendingWorkers.delete(item);
        this.#readyWorkers.add(item);
        this.onWorkerAvailable(item);
      }
    });
  }

  delete (item) {
    this.#pendingWorkers.delete(item);
    this.#readyWorkers.delete(item);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  pick (_task) {
    const workers = [...this.#readyWorkers];
    let candidate = null;

    if (this.#offset < workers.length) {
      candidate = workers[this.#offset];
      this.#offset++;
    } else {
      this.#offset = 0;
      candidate = workers[this.#offset];
      this.#offset++;
    }

    return candidate ?? null;
  }

  * [Symbol.iterator] () {
    yield * this.#pendingWorkers;
    yield * this.#readyWorkers;
  }

  get size () {
    return this.#pendingWorkers.size + this.#readyWorkers.size;
  }

  set size (_value) {}

  onWorkerAvailable (item) {
    if (item.currentUsage() < this.#maxConcurrent) {
      for (const listener of this.#onAvailableListeners) {
        listener(item);
      }
    }
  }

  onAvailable (fn) {
    this.#onAvailableListeners.push(fn);
  }

  getAvailableCapacity () {
    return this.#pendingWorkers.size * this.#maxConcurrent;
  }
}

const maxConcurrent = 3;
const piscina = new Piscina({
  filename: resolve(__dirname, 'worker.js'),
  scheduler: new CustomTaskScheduler(3),
  maxThreads: 3,
  minThreads: 3,
  concurrentTasksPerWorker: maxConcurrent
});

(async () => {
  const results = await Promise.all([
    piscina.run(0),
    piscina.run(1),
    piscina.run(2),
    piscina.run(3),
    piscina.run(4),
    piscina.run(5)
  ]);

  console.log(results);
})();
