import { resolve } from 'path';

import { test } from 'tap';

import { Piscina, PiscinaBaseTaskScheduler, PiscinaWorker } from '../..';

test('It allows usage of custom scheduler', async ({ plan, strictSame }) => {
  plan(1);
  // Simplistic RoundRobin example
  class CustomTaskScheduler extends PiscinaBaseTaskScheduler {
    #maxConcurrent: number;
    #readyWorkers: Set<PiscinaWorker>;
    #pendingWorkers: Set<PiscinaWorker>;
    // TODO: create its own type?
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
  }
  const maxConcurrent = 1;
  const pool = new Piscina({
    filename: resolve(__dirname, '../fixtures/threadid.js'),
    scheduler: new CustomTaskScheduler(maxConcurrent),
    maxThreads: 3,
    minThreads: 3,
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
  strictSame(results, [
    {
      input: 0,
      threadId: '1'
    },
    {
      input: 1,
      threadId: '2'
    },
    {
      input: 2,
      threadId: '3'
    },
    {
      input: 3,
      threadId: '1'
    },
    {
      input: 4,
      threadId: '2'
    },
    {
      input: 5,
      threadId: '3'
    }
  ]);
});

test('On ready should pass down the error thrown by the worker on initialization', { only: true }, async ({ plan, equals }) => {
  plan(2);
  // Simplistic RoundRobin example
  class CustomTaskScheduler extends PiscinaBaseTaskScheduler {
    #maxConcurrent: number;
    #readyWorkers: Set<PiscinaWorker>;
    #pendingWorkers: Set<PiscinaWorker>;
    // TODO: create its own type?
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
        equals(err.message, 'worker exited with code: 1');
        equals(item.isReady(), false);
        // equals(err.message, 'Error: Worker failed to initialize');
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
  }
  const maxConcurrent = 1;
  const pool = new Piscina({
    filename: resolve(__dirname, '../fixtures/fail-on-init.js'),
    scheduler: new CustomTaskScheduler(maxConcurrent),
    maxThreads: 1,
    minThreads: 1,
    concurrentTasksPerWorker: maxConcurrent
  });

  await pool.run('throw new Error("Worker failed to initialize")');
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
  // Simplistic RoundRobin example
  class CustomTaskScheduler {
    #maxConcurrent: number;
    #readyWorkers: Set<PiscinaWorker>;
    #pendingWorkers: Set<PiscinaWorker>;
    // TODO: create its own type?
    #onAvailableListeners: ((item: PiscinaWorker) => void)[];
    #offset: number;

    constructor (maxConcurrent: number) {
      this.#maxConcurrent = maxConcurrent;
      this.#readyWorkers = new Set();
      this.#pendingWorkers = new Set();
      this.#onAvailableListeners = [];
      this.#offset = 0;
    }

    add (item) {
      this.#pendingWorkers.add(item);
      item.onReady(() => {
        /* istanbul ignore else */
        if (this.#pendingWorkers.delete(item)) {
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
  }
  const pool = new Piscina({
    filename: resolve(__dirname, '../fixtures/threadid.js'),
    scheduler: new CustomTaskScheduler(maxConcurrent),
    maxThreads: 3,
    minThreads: 3,
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

  plan(1);

  strictSame(results, [
    {
      input: 0,
      threadId: '1'
    },
    {
      input: 1,
      threadId: '2'
    },
    {
      input: 2,
      threadId: '3'
    },
    {
      input: 3,
      threadId: '1'
    },
    {
      input: 4,
      threadId: '2'
    },
    {
      input: 5,
      threadId: '3'
    }
  ]);
});
