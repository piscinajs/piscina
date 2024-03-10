import { resolve } from 'path';

import { test } from 'tap';

import { Piscina, PiscinaBaseTaskScheduler, PiscinaWorker } from '../..';

test('It allows usage of custom scheduler', async ({ plan, strictSame }) => {
  plan(1);
  // Simplistic RoundRobin example
  class CustomTaskScheduler extends PiscinaBaseTaskScheduler {
    #maxConcurrent: number;
    #maxThreads: number;
    #readyWorkers: Set<PiscinaWorker>;
    #pendingWorkers: Set<PiscinaWorker>;
    // TODO: create its own type?
    #onAvailableListeners: ((item: PiscinaWorker) => void)[];
    #offset: number;

    constructor (maxThreads: number, maxConcurrent: number) {
      super(maxConcurrent);
      this.#maxConcurrent = maxConcurrent;
      this.#readyWorkers = new Set();
      this.#pendingWorkers = new Set();
      this.#onAvailableListeners = [];
      this.#offset = 0;
      this.#maxThreads = maxThreads;
    }

    add (item) {
      this.#pendingWorkers.add(item);
      item.onReady(() => {
        if (this.#pendingWorkers.delete(item)) {
          this.#readyWorkers.add(item);
        }

        if (this.#readyWorkers.size === this.#maxThreads) {
          this.onWorkerAvailable(item);
        }
      });
    }

    delete (item) {
      this.#pendingWorkers.delete(item);
      this.#readyWorkers.delete(item);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    pick (_task): PiscinaWorker | null {
      let candidate = null;
      const workers = [...this.#readyWorkers];

      if (workers.length === 0) return candidate;

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

    getWorkers (): PiscinaWorker[] {
      return [...this.#pendingWorkers, ...this.#readyWorkers];
    }

    // @ts-expect-error
    get size () {
      return this.#pendingWorkers.size + this.#readyWorkers.size;
    }

    set size (_value) {
      // no-op
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onWorkerAvailable (_item: PiscinaWorker) {
      const worker = this.pick({});
      for (const listener of this.#onAvailableListeners) {
        listener(worker);
      }
    }

    onAvailable (fn: (item: PiscinaWorker) => void) {
      this.#onAvailableListeners.push(fn);
    }

    getAvailableCapacity (): number {
      return this.#pendingWorkers.size * this.#maxConcurrent;
    }

    getCurrentUsage (): number {
      let inFlight = 0;
      for (const worker of this.#readyWorkers) {
        const currentUsage = worker.currentUsage();

        if (Number.isFinite(currentUsage)) inFlight += currentUsage;
      }

      return inFlight;
    }
  }

  const maxConcurrent = 1;
  const maxThreads = 3;
  const customScheduler = new CustomTaskScheduler(maxThreads, maxConcurrent);
  const pool = new Piscina({
    filename: resolve(__dirname, '../fixtures/threadid.js'),
    scheduler: customScheduler,
    maxThreads,
    minThreads: maxThreads,
    concurrentTasksPerWorker: maxConcurrent
  });

  const results = await Promise.all([
    pool.run(0),
    pool.run(1),
    pool.run(2),
    pool.run(3),
    pool.run(4),
    pool.run(5)
  ]);

  const workers = customScheduler
    .getWorkers();

  const expected = workers.concat(workers).map((worker, index) => {
    return {
      input: index,
      threadId: worker.id
    };
  });

  strictSame(results, expected);
});

test('On ready should pass down the error thrown by the worker on initialization', (t) => {
  t.plan(2);
  // Simplistic RoundRobin example
  class CustomTaskScheduler extends PiscinaBaseTaskScheduler {
    #maxConcurrent: number;
    #readyWorkers: Set<PiscinaWorker>;
    #pendingWorkers: Set<PiscinaWorker>;
    #onAvailableListeners: ((item: PiscinaWorker) => void)[];
    #offset: number;

    constructor (maxConcurrent: number) {
      super(maxConcurrent);
      this.#maxConcurrent = maxConcurrent;
      this.#readyWorkers = new Set();
      this.#pendingWorkers = new Set();
      this.#onAvailableListeners = [];
      this.#offset = 0;
    }

    add (item) {
      this.#pendingWorkers.add(item);
      item.onReady((err) => {
        t.equal(err.message, 'failed on initialization');
        t.equal(item.isReady(), false);
      });
    }

    delete (item) {
      this.#pendingWorkers.delete(item) || this.#readyWorkers.delete(item);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    pick (_task): PiscinaWorker | null {
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

    getWorkers (): PiscinaWorker[] {
      return [...this.#pendingWorkers, ...this.#readyWorkers];
    }

    // @ts-expect-error
    get size () {
      return this.#pendingWorkers.size + this.#readyWorkers.size;
    }

    set size (_value) {
      // no-op
    }

    onWorkerAvailable (item: PiscinaWorker) {
      /* istanbul ignore else */
      if (item.currentUsage() < this.#maxConcurrent) {
        for (const listener of this.#onAvailableListeners) {
          listener(item);
        }
      }
    }

    onAvailable (fn: (item: PiscinaWorker) => void) {
      this.#onAvailableListeners.push(fn);
    }

    getAvailableCapacity (): number {
      return this.#pendingWorkers.size * this.#maxConcurrent;
    }

    getCurrentUsage (): number {
      let inFlight = 0;
      for (const worker of this.#readyWorkers) {
        const currentUsage = worker.currentUsage();

        if (Number.isFinite(currentUsage)) inFlight += currentUsage;
      }

      return inFlight;
    }
  }

  const maxConcurrent = 1;
  const pool = new Piscina({
    filename: resolve(__dirname, '../fixtures/fail-on-init.js'),
    scheduler: new CustomTaskScheduler(maxConcurrent),
    maxThreads: 1,
    minThreads: 1,
    concurrentTasksPerWorker: maxConcurrent
  });

  pool.run('test').then(
    () => {},
    () => {}
  );
});

test('Should throw if bad CustomTaskScheduler', ({ plan, throws }) => {
  plan(1);
  const maxConcurrent = 1;
  throws(
    () =>
      new Piscina({
        filename: resolve(__dirname, '../fixtures/threadid.js'),
        // @ts-expect-error
        scheduler: {},
        maxThreads: 3,
        minThreads: 3,
        concurrentTasksPerWorker: maxConcurrent
      }),
    TypeError,
    'options.scheduler must be a valid scheduler instance'
  );
});

test('Should accept CustomTaskSchedulers that does not inherit from base', async ({
  plan,
  strictSame
}) => {
  const maxConcurrent = 1;
  const maxThreads = 3;
  // Simplistic RoundRobin example
  class CustomTaskScheduler extends PiscinaBaseTaskScheduler {
    #maxConcurrent: number;
    #maxThreads: number;
    #readyWorkers: Set<PiscinaWorker>;
    #pendingWorkers: Set<PiscinaWorker>;
    // TODO: create its own type?
    #onAvailableListeners: ((item: PiscinaWorker) => void)[];
    #offset: number;

    constructor (maxThreads: number, maxConcurrent: number) {
      super(maxConcurrent);
      this.#maxConcurrent = maxConcurrent;
      this.#readyWorkers = new Set();
      this.#pendingWorkers = new Set();
      this.#onAvailableListeners = [];
      this.#offset = 0;
      this.#maxThreads = maxThreads;
    }

    add (item) {
      this.#pendingWorkers.add(item);
      item.onReady(() => {
        if (this.#pendingWorkers.delete(item)) {
          this.#readyWorkers.add(item);
        }

        if (this.#readyWorkers.size === this.#maxThreads) {
          this.onWorkerAvailable(item);
        }
      });
    }

    delete (item) {
      this.#pendingWorkers.delete(item);
      this.#readyWorkers.delete(item);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    pick (_task): PiscinaWorker | null {
      let candidate = null;
      const workers = [...this.#readyWorkers];

      if (workers.length === 0) return candidate;

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

    getWorkers (): PiscinaWorker[] {
      return [...this.#pendingWorkers, ...this.#readyWorkers];
    }

    // @ts-expect-error
    get size () {
      return this.#pendingWorkers.size + this.#readyWorkers.size;
    }

    set size (_value) {
      // no-op
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onWorkerAvailable (_item: PiscinaWorker) {
      const worker = this.pick({});
      for (const listener of this.#onAvailableListeners) {
        listener(worker);
      }
    }

    onAvailable (fn: (item: PiscinaWorker) => void) {
      this.#onAvailableListeners.push(fn);
    }

    getAvailableCapacity (): number {
      return this.#pendingWorkers.size * this.#maxConcurrent;
    }

    getCurrentUsage (): number {
      let inFlight = 0;
      for (const worker of this.#readyWorkers) {
        const currentUsage = worker.currentUsage();

        if (Number.isFinite(currentUsage)) inFlight += currentUsage;
      }

      return inFlight;
    }
  }

  plan(1);

  const scheduler = new CustomTaskScheduler(maxThreads, maxConcurrent);
  const pool = new Piscina({
    filename: resolve(__dirname, '../fixtures/threadid.js'),
    scheduler: scheduler,
    maxThreads,
    minThreads: maxThreads,
    concurrentTasksPerWorker: maxConcurrent
  });

  const results = await Promise.all([
    pool.run(0),
    pool.run(1),
    pool.run(2),
    pool.run(3),
    pool.run(4),
    pool.run(5)
  ]);

  const workers = scheduler
    .getWorkers();

  const expected = workers.concat(workers).map((worker, index) => {
    return {
      input: index,
      threadId: worker.id
    };
  });

  strictSame(results, expected);
});
