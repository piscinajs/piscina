import assert from 'node:assert';

export abstract class AsynchronouslyCreatedResource {
    onreadyListeners : (() => void)[] | null = [];
    ondestroyListeners : (() => void)[] | null = [];

    markAsReady () : void {
      const listeners = this.onreadyListeners;
      assert(listeners !== null);
      this.onreadyListeners = null;
      for (const listener of listeners) {
        listener();
      }
    }

    isReady () : boolean {
      return this.onreadyListeners === null;
    }

    onReady (fn : () => void) {
      if (this.onreadyListeners === null) {
        fn(); // Zalgo is okay here.
        return;
      }
      this.onreadyListeners.push(fn);
    }

    onDestroy (fn : () => void) {
      if (this.ondestroyListeners === null) {
        return;
      }

      this.ondestroyListeners.push(fn);
    }

    markAsDestroyed () {
      const listeners = this.ondestroyListeners;
      assert(listeners !== null);
      this.ondestroyListeners = null;
      for (const listener of listeners) {
        listener();
      }
    }

    isDestroyed () {
      return this.ondestroyListeners === null;
    }

    abstract currentUsage() : number;
}

// TODO: this will eventually become an scheduler
export class AsynchronouslyCreatedResourcePool<
  T extends AsynchronouslyCreatedResource> {
  pendingItems = new Set<T>();
  readyItems = new Set<T>();
  maximumUsage : number;
  onAvailableListeners : ((item : T) => void)[];
  onTaskDoneListeners : ((item : T) => void)[];

  constructor (maximumUsage : number) {
    this.maximumUsage = maximumUsage;
    this.onAvailableListeners = [];
    this.onTaskDoneListeners = [];
  }

  add (item : T) {
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

  delete (item : T) {
    this.pendingItems.delete(item);
    this.readyItems.delete(item);
  }

  * [Symbol.iterator] () {
    yield * this.pendingItems;
    yield * this.readyItems;
  }

  get size () {
    return this.pendingItems.size + this.readyItems.size;
  }

  maybeAvailable (item : T) {
    /* istanbul ignore else */
    if (item.currentUsage() < this.maximumUsage) {
      for (const listener of this.onAvailableListeners) {
        listener(item);
      }
    }
  }

  onAvailable (fn : (item : T) => void) {
    this.onAvailableListeners.push(fn);
  }

  taskDone (item : T) {
    for (let i = 0; i < this.onTaskDoneListeners.length; i++) {
      this.onTaskDoneListeners[i](item);
    }
  }

  onTaskDone (fn : (item : T) => void) {
    this.onTaskDoneListeners.push(fn);
  }

  getCurrentUsage (): number {
    let inFlight = 0;
    for (const worker of this.readyItems) {
      const currentUsage = worker.currentUsage();

      if (Number.isFinite(currentUsage)) inFlight += currentUsage;
    }

    return inFlight;
  }
}
