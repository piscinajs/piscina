import Piscina from '..';
import { test } from 'tap';
import { resolve } from 'path';
import { Task, TaskQueue } from '../dist/src/common';

test('will put items into a task queue until they can run', async ({ equal }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/wait-for-notify.ts'),
    minThreads: 2,
    maxThreads: 3
  });

  equal(pool.threads.length, 2);
  equal(pool.queueSize, 0);

  const buffers = [
    new Int32Array(new SharedArrayBuffer(4)),
    new Int32Array(new SharedArrayBuffer(4)),
    new Int32Array(new SharedArrayBuffer(4)),
    new Int32Array(new SharedArrayBuffer(4))
  ];

  const results = [];

  results.push(pool.runTask(buffers[0]));
  equal(pool.threads.length, 2);
  equal(pool.queueSize, 0);

  results.push(pool.runTask(buffers[1]));
  equal(pool.threads.length, 2);
  equal(pool.queueSize, 0);

  results.push(pool.runTask(buffers[2]));
  equal(pool.threads.length, 3);
  equal(pool.queueSize, 0);

  results.push(pool.runTask(buffers[3]));
  equal(pool.threads.length, 3);
  equal(pool.queueSize, 1);

  for (const buffer of buffers) {
    Atomics.store(buffer, 0, 1);
    Atomics.notify(buffer, 0, 1);
  }

  await results[0];
  equal(pool.queueSize, 0);

  await Promise.all(results);
});

test('will reject items over task queue limit', async ({ equal, rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 0,
    maxThreads: 1,
    maxQueue: 2
  });

  equal(pool.threads.length, 0);
  equal(pool.queueSize, 0);

  rejects(pool.runTask('while (true) {}'), /Terminating worker thread/);
  equal(pool.threads.length, 1);
  equal(pool.queueSize, 0);

  rejects(pool.runTask('while (true) {}'), /Terminating worker thread/);
  equal(pool.threads.length, 1);
  equal(pool.queueSize, 1);

  rejects(pool.runTask('while (true) {}'), /Terminating worker thread/);
  equal(pool.threads.length, 1);
  equal(pool.queueSize, 2);

  rejects(pool.runTask('while (true) {}'), /Task queue is at limit/);
  await pool.destroy();
});

test('will reject items when task queue is unavailable', async ({ equal, rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 0,
    maxThreads: 1,
    maxQueue: 0
  });

  equal(pool.threads.length, 0);
  equal(pool.queueSize, 0);

  rejects(pool.runTask('while (true) {}'), /Terminating worker thread/);
  equal(pool.threads.length, 1);
  equal(pool.queueSize, 0);

  rejects(pool.runTask('while (true) {}'), /No task queue available and all Workers are busy/);
  await pool.destroy();
});

test('will reject items when task queue is unavailable (fixed thread count)', async ({ equal, rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 1,
    maxThreads: 1,
    maxQueue: 0
  });

  equal(pool.threads.length, 1);
  equal(pool.queueSize, 0);

  rejects(pool.runTask('while (true) {}'), /Terminating worker thread/);
  equal(pool.threads.length, 1);
  equal(pool.queueSize, 0);

  rejects(pool.runTask('while (true) {}'), /No task queue available and all Workers are busy/);
  await pool.destroy();
});

test('tasks can share a Worker if requested (both tests blocking)', async ({ equal, rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/wait-for-notify.ts'),
    minThreads: 0,
    maxThreads: 1,
    maxQueue: 0,
    concurrentTasksPerWorker: 2
  });

  equal(pool.threads.length, 0);
  equal(pool.queueSize, 0);

  rejects(pool.runTask(new Int32Array(new SharedArrayBuffer(4))));
  equal(pool.threads.length, 1);
  equal(pool.queueSize, 0);

  rejects(pool.runTask(new Int32Array(new SharedArrayBuffer(4))));
  equal(pool.threads.length, 1);
  equal(pool.queueSize, 0);

  await pool.destroy();
});

test('tasks can share a Worker if requested (one test finishes)', async ({ equal, rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/wait-for-notify.ts'),
    minThreads: 0,
    maxThreads: 1,
    maxQueue: 0,
    concurrentTasksPerWorker: 2
  });

  const buffers = [
    new Int32Array(new SharedArrayBuffer(4)),
    new Int32Array(new SharedArrayBuffer(4))
  ];

  equal(pool.threads.length, 0);
  equal(pool.queueSize, 0);

  const firstTask = pool.runTask(buffers[0]);
  equal(pool.threads.length, 1);
  equal(pool.queueSize, 0);

  rejects(pool.runTask(
    'new Promise((resolve) => setTimeout(resolve, 1000000))',
    resolve(__dirname, 'fixtures/eval.js')), /Terminating worker thread/);
  equal(pool.threads.length, 1);
  equal(pool.queueSize, 0);

  Atomics.store(buffers[0], 0, 1);
  Atomics.notify(buffers[0], 0, 1);

  await firstTask;
  equal(pool.threads.length, 1);
  equal(pool.queueSize, 0);

  await pool.destroy();
});

test('tasks can share a Worker if requested (both tests finish)', async ({ equal }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/wait-for-notify.ts'),
    minThreads: 1,
    maxThreads: 1,
    maxQueue: 0,
    concurrentTasksPerWorker: 2
  });

  const buffers = [
    new Int32Array(new SharedArrayBuffer(4)),
    new Int32Array(new SharedArrayBuffer(4))
  ];

  equal(pool.threads.length, 1);
  equal(pool.queueSize, 0);

  const firstTask = pool.runTask(buffers[0]);
  equal(pool.threads.length, 1);
  equal(pool.queueSize, 0);

  const secondTask = pool.runTask(buffers[1]);
  equal(pool.threads.length, 1);
  equal(pool.queueSize, 0);

  Atomics.store(buffers[0], 0, 1);
  Atomics.store(buffers[1], 0, 1);
  Atomics.notify(buffers[0], 0, 1);
  Atomics.notify(buffers[1], 0, 1);
  Atomics.wait(buffers[0], 0, 1);
  Atomics.wait(buffers[1], 0, 1);

  await firstTask;
  equal(buffers[0][0], -1);
  await secondTask;
  equal(buffers[1][0], -1);

  equal(pool.threads.length, 1);
  equal(pool.queueSize, 0);
});

test('custom task queue works', async ({ equal, ok }) => {
  let sizeCalled : boolean = false;
  let shiftCalled : boolean = false;
  let pushCalled : boolean = false;

  class CustomTaskPool implements TaskQueue {
    tasks: Task[] = [];

    get size () : number {
      sizeCalled = true;
      return this.tasks.length;
    }

    shift () : Task | null {
      shiftCalled = true;
      return this.tasks.length > 0 ? this.tasks.shift() as Task : null;
    }

    push (task : Task) : void {
      pushCalled = true;
      this.tasks.push(task);

      ok(Piscina.queueOptionsSymbol in task);
      if ((task as any).task.a === 3) {
        equal(task[Piscina.queueOptionsSymbol], null);
      } else {
        equal(task[Piscina.queueOptionsSymbol].option,
          (task as any).task.a);
      }
    }

    remove (task : Task) : void {
      const index = this.tasks.indexOf(task);
      this.tasks.splice(index, 1);
    }
  };

  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    taskQueue: new CustomTaskPool(),
    // Setting maxThreads low enough to ensure we queue
    maxThreads: 1,
    minThreads: 1
  });

  function makeTask (task, option) {
    return { ...task, [Piscina.queueOptionsSymbol]: { option } };
  }

  const ret = await Promise.all([
    pool.runTask(makeTask({ a: 1 }, 1)),
    pool.runTask(makeTask({ a: 2 }, 2)),
    pool.runTask({ a: 3 }) // No queueOptionsSymbol attached
  ]);

  equal(ret[0].a, 1);
  equal(ret[1].a, 2);
  equal(ret[2].a, 3);

  ok(sizeCalled);
  ok(pushCalled);
  ok(shiftCalled);
});
