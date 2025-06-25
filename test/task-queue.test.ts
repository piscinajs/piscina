import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import Piscina, { PiscinaTask, TaskQueue } from '..';

test('will put items into a task queue until they can run', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/wait-for-notify.ts'),
    minThreads: 2,
    maxThreads: 3
  });

  assert.strictEqual(pool.threads.length, 2);
  assert.strictEqual(pool.queueSize, 0);

  const buffers = [
    new Int32Array(new SharedArrayBuffer(4)),
    new Int32Array(new SharedArrayBuffer(4)),
    new Int32Array(new SharedArrayBuffer(4)),
    new Int32Array(new SharedArrayBuffer(4))
  ];

  const results = [];

  results.push(pool.run(buffers[0]));
  assert.strictEqual(pool.threads.length, 2);
  assert.strictEqual(pool.queueSize, 0);

  results.push(pool.run(buffers[1]));
  assert.strictEqual(pool.threads.length, 2);
  assert.strictEqual(pool.queueSize, 0);

  results.push(pool.run(buffers[2]));
  assert.strictEqual(pool.threads.length, 3);
  assert.strictEqual(pool.queueSize, 0);

  results.push(pool.run(buffers[3]));
  assert.strictEqual(pool.threads.length, 3);
  assert.strictEqual(pool.queueSize, 1);

  for (const buffer of buffers) {
    Atomics.store(buffer, 0, 1);
    Atomics.notify(buffer, 0, 1);
  }

  await results[0];
  assert.strictEqual(pool.queueSize, 0);

  await Promise.all(results);
});

test('will reject items over task queue limit', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 0,
    maxThreads: 1,
    maxQueue: 2
  });

  assert.strictEqual(pool.threads.length, 0);
  assert.strictEqual(pool.queueSize, 0);

  assert.rejects(pool.run('while (true) {}'), /Terminating worker thread/);
  assert.strictEqual(pool.threads.length, 1);
  assert.strictEqual(pool.queueSize, 0);

  assert.rejects(pool.run('while (true) {}'), /Terminating worker thread/);
  assert.strictEqual(pool.threads.length, 1);
  assert.strictEqual(pool.queueSize, 1);

  assert.rejects(pool.run('while (true) {}'), /Terminating worker thread/);
  assert.strictEqual(pool.threads.length, 1);
  assert.strictEqual(pool.queueSize, 2);

  assert.rejects(pool.run('while (true) {}'), /Task queue is at limit/);
  await pool.destroy();
});

test('will reject items when task queue is unavailable', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 0,
    maxThreads: 1,
    maxQueue: 0
  });

  assert.strictEqual(pool.threads.length, 0);
  assert.strictEqual(pool.queueSize, 0);

  assert.rejects(pool.run('while (true) {}'), /Terminating worker thread/);
  assert.strictEqual(pool.threads.length, 1);
  assert.strictEqual(pool.queueSize, 0);

  assert.rejects(pool.run('while (true) {}'), /No task queue available and all Workers are busy/);
  await pool.destroy();
});

test('will reject items when task queue is unavailable (fixed thread count)', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 1,
    maxThreads: 1,
    maxQueue: 0
  });

  assert.strictEqual(pool.threads.length, 1);
  assert.strictEqual(pool.queueSize, 0);

  assert.rejects(pool.run('while (true) {}'), /Terminating worker thread/);
  assert.strictEqual(pool.threads.length, 1);
  assert.strictEqual(pool.queueSize, 0);

  assert.rejects(pool.run('while (true) {}'), /No task queue available and all Workers are busy/);
  await pool.destroy();
});

test('tasks can share a Worker if requested (both tests blocking)', async (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/wait-for-notify.ts'),
    minThreads: 0,
    maxThreads: 1,
    maxQueue: 0,
    concurrentTasksPerWorker: 2
  });

  assert.strictEqual(pool.threads.length, 0);
  assert.strictEqual(pool.queueSize, 0);

  assert.rejects(pool.run(new Int32Array(new SharedArrayBuffer(4))));
  assert.strictEqual(pool.threads.length, 1);
  assert.strictEqual(pool.queueSize, 0);

  assert.rejects(pool.run(new Int32Array(new SharedArrayBuffer(4))));
  assert.strictEqual(pool.threads.length, 1);
  assert.strictEqual(pool.queueSize, 0);

  await pool.destroy();
});

test('tasks can share a Worker if requested (one test finishes)', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/wait-for-notify.js'),
    minThreads: 0,
    maxThreads: 1,
    maxQueue: 0,
    concurrentTasksPerWorker: 2
  });

  const buffers = [
    new Int32Array(new SharedArrayBuffer(4)),
    new Int32Array(new SharedArrayBuffer(4))
  ];

  assert.strictEqual(pool.threads.length, 0);
  assert.strictEqual(pool.queueSize, 0);

  const firstTask = pool.run(buffers[0]);
  assert.strictEqual(pool.threads.length, 1);
  assert.strictEqual(pool.queueSize, 0);

  assert.rejects(pool.run(
    'new Promise((resolve) => setTimeout(resolve, 5))',
    { filename: resolve(__dirname, 'fixtures/eval.js') })
  , /Terminating worker thread/);
  assert.strictEqual(pool.threads.length, 1);
  assert.strictEqual(pool.queueSize, 0);

  Atomics.store(buffers[0], 0, 1);
  Atomics.notify(buffers[0], 0, 1);

  await firstTask;
  assert.strictEqual(pool.threads.length, 1);
  assert.strictEqual(pool.queueSize, 0);

  await pool.destroy();
});

test('tasks can share a Worker if requested (both tests finish)', async () => {
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

  assert.strictEqual(pool.threads.length, 1);
  assert.strictEqual(pool.queueSize, 0);

  const firstTask = pool.run(buffers[0]);
  assert.strictEqual(pool.threads.length, 1);
  assert.strictEqual(pool.queueSize, 0);

  const secondTask = pool.run(buffers[1]);
  assert.strictEqual(pool.threads.length, 1);
  assert.strictEqual(pool.queueSize, 0);

  Atomics.store(buffers[0], 0, 1);
  Atomics.store(buffers[1], 0, 1);
  Atomics.notify(buffers[0], 0, 1);
  Atomics.notify(buffers[1], 0, 1);
  Atomics.wait(buffers[0], 0, 1);
  Atomics.wait(buffers[1], 0, 1);

  await firstTask;
  assert.strictEqual(buffers[0][0], -1);
  await secondTask;
  assert.strictEqual(buffers[1][0], -1);

  assert.strictEqual(pool.threads.length, 1);
  assert.strictEqual(pool.queueSize, 0);
});

test('custom task queue works', async () => {
  let sizeCalled : boolean = false;
  let shiftCalled : boolean = false;
  let pushCalled : boolean = false;

  class CustomTaskPool implements TaskQueue {
    tasks: PiscinaTask[] = [];

    get size () : number {
      sizeCalled = true;
      return this.tasks.length;
    }

    shift () : PiscinaTask | null {
      shiftCalled = true;
      return this.tasks.length > 0 ? this.tasks.shift() as PiscinaTask : null;
    }

    push (task : PiscinaTask) : void {
      pushCalled = true;
      this.tasks.push(task);

      assert.ok(Piscina.queueOptionsSymbol in task);
      if ((task as any).task.a === 3) {
        assert.strictEqual(task[Piscina.queueOptionsSymbol], null);
      } else {
        assert.strictEqual(task[Piscina.queueOptionsSymbol].option,
          (task as any).task.a);
      }
    }

    remove (task : PiscinaTask) : void {
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
    pool.run(makeTask({ a: 1 }, 1)),
    pool.run(makeTask({ a: 2 }, 2)),
    pool.run({ a: 3 }) // No queueOptionsSymbol attached
  ]);

  assert.strictEqual(ret[0].a, 1);
  assert.strictEqual(ret[1].a, 2);
  assert.strictEqual(ret[2].a, 3);

  assert.ok(sizeCalled);
  assert.ok(pushCalled);
  assert.ok(shiftCalled);
});
