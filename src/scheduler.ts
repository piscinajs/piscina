import { WorkerInfo } from '.';

function isTaskSchedulerLike(obj: {}): obj is TaskScheduler {
  if (Object.getPrototypeOf(obj) === TaskScheduler) return true;

  const keys: (keyof TaskScheduler)[] = [
    'findAvailable',
    'onAvailable',
    'addWorker',
    'delete',
    'size'
  ];

  for (const key of keys) {
    // @ts-expect-error
    if (obj[key] == null) return false;
  }

  return true;
}

class TaskScheduler {
  size: number;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_concurrentTasksPerWorker: number) {
    this.size = 0;
  }

  [Symbol.iterator](): IterableIterator<WorkerInfo> {
    throw new Error('Iterator not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  add(_worker: WorkerInfo): void {
    throw new Error('add Method not implemented.');
  }

  findAvailable(): WorkerInfo | null {
    throw new Error('findAvailable Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onAvailable(_cb: (worker: WorkerInfo) => void): void {
    throw new Error('onAvailable Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addWorker(_worker: WorkerInfo): void {
    throw new Error('addWorker Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  delete(_worker: WorkerInfo): void {
    throw new Error('delete Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  maybeAvailable(_worker: WorkerInfo): void {
    throw new Error('maybeAvailable Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getAvailableCapacity(): number {
    throw new Error('getCurrentCapacity Method not implemented.');
  }
}

class DefaultTaskScheduler extends TaskScheduler {
  pendingItems = new Set<WorkerInfo>();
  readyItems = new Set<WorkerInfo>();
  maximumUsage: number;
  onAvailableListeners: ((item: WorkerInfo) => void)[];

  constructor(maximumUsage: number) {
    super(maximumUsage);
    this.maximumUsage = maximumUsage;
    this.onAvailableListeners = [];
  }

  add(item: WorkerInfo) {
    this.pendingItems.add(item);
    item.onReady(() => {
      /* istanbul ignore else */
      if (this.pendingItems.has(item)) {
        this.pendingItems.delete(item);
        this.readyItems.add(item);
        this.maybeAvailable(item);
      }
    });
  }

  delete(item: WorkerInfo) {
    this.pendingItems.delete(item);
    this.readyItems.delete(item);
  }

  findAvailable(): WorkerInfo | null {
    let minUsage = this.maximumUsage;
    let candidate = null;
    for (const item of this.readyItems) {
      const usage = item.currentUsage();
      if (usage === 0) return item;
      if (usage < minUsage) {
        candidate = item;
        minUsage = usage;
      }
    }
    return candidate;
  }

  *[Symbol.iterator]() {
    yield* this.pendingItems;
    yield* this.readyItems;
  }

  // @ts-expect-error
  get size() {
    return this.pendingItems.size + this.readyItems.size;
  }

  maybeAvailable(item: WorkerInfo) {
    /* istanbul ignore else */
    if (item.currentUsage() < this.maximumUsage) {
      for (const listener of this.onAvailableListeners) {
        listener(item);
      }
    }
  }

  onAvailable(fn: (item: WorkerInfo) => void) {
    this.onAvailableListeners.push(fn);
  }

  getAvailableCapacity(): number {
    return this.pendingItems.size * this.maximumUsage;
  }
}

export { TaskScheduler, DefaultTaskScheduler, isTaskSchedulerLike };
