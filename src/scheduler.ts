import type { PiscinaWorker, PiscinaTask, RunTaskOptions } from '.';

function isTaskSchedulerLike (obj: {}): obj is TaskScheduler {
  if (Object.getPrototypeOf(obj) === TaskScheduler) return true;

  const keys: (keyof TaskScheduler)[] = [
    'onWorkerAvailable',
    'onAvailable',
    'pick',
    'delete',
    'size'
  ];

  for (const key of keys) {
    if (!(key in obj)) return false;
  }

  return true;
}

class TaskScheduler {
  size: number;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor (_concurrentTasksPerWorker: number) {
    this.size = 0;
  }

  [Symbol.iterator] (): IterableIterator<PiscinaWorker> {
    throw new Error('Iterator not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  add (_worker: PiscinaWorker): void {
    throw new Error('add Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  pick (_task: PiscinaTask, _runOptions: RunTaskOptions): PiscinaWorker | null {
    throw new Error('pick Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onAvailable (_cb: (worker: PiscinaWorker) => void): void {
    throw new Error('onAvailable Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  delete (_worker: PiscinaWorker): void {
    throw new Error('delete Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onWorkerAvailable (_worker: PiscinaWorker): void {
    throw new Error('onNewWorker Method not implemented.');
  }

  getAvailableCapacity (): number {
    throw new Error('getAvailableCapacity Method not implemented.');
  }
}

class DefaultTaskScheduler extends TaskScheduler {
  #pendingItems = new Set<PiscinaWorker>();
  #readyItems = new Set<PiscinaWorker>();
  #maximumUsage: number;
  #onAvailableListeners: ((item: PiscinaWorker) => void)[];

  constructor (maximumUsage: number) {
    super(maximumUsage);
    this.#maximumUsage = maximumUsage;
    this.#onAvailableListeners = [];
  }

  add (item: PiscinaWorker) {
    this.#pendingItems.add(item);
    item.onReady(() => {
      /* istanbul ignore else */
      if (this.#pendingItems.has(item)) {
        this.#pendingItems.delete(item);
        this.#readyItems.add(item);
        this.onWorkerAvailable(item);
      }
    });
  }

  delete (item: PiscinaWorker) {
    this.#pendingItems.delete(item);
    this.#readyItems.delete(item);
  }

  pick (_task: PiscinaTask, opts: RunTaskOptions): PiscinaWorker | null {
    let minUsage = this.#maximumUsage;
    let candidate = null;
    for (const item of this.#readyItems) {
      const usage = item.currentUsage();
      if (usage === 0) {
        return item;
      };

      // If we want the ability to abort this task, use only workers that have
      // no running tasks.
      if (opts.signal == null && usage < minUsage) {
        candidate = item;
        minUsage = usage;
      }
    }

    return candidate;
  }

  * [Symbol.iterator] () {
    yield * this.#pendingItems;
    yield * this.#readyItems;
  }

  // @ts-expect-error
  get size () {
    return this.#pendingItems.size + this.#readyItems.size;
  }

  set size (_value) {
    // no-op
  }

  onWorkerAvailable (item: PiscinaWorker) {
    /* istanbul ignore else */
    if (item.currentUsage() < this.#maximumUsage) {
      for (const listener of this.#onAvailableListeners) {
        listener(item);
      }
    }
  }

  onAvailable (fn: (item: PiscinaWorker) => void) {
    this.#onAvailableListeners.push(fn);
  }

  getAvailableCapacity (): number {
    return this.#pendingItems.size * this.#maximumUsage;
  }
}

export { TaskScheduler, DefaultTaskScheduler, isTaskSchedulerLike };
