import { resolve } from 'node:path';

import { test } from 'node:test';
import type { TestContext } from 'node:test';

import Piscina from '..';

test('coverage test for Atomics optimization (sync mode)', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/notify-then-sleep-or.js'),
    minThreads: 2,
    maxThreads: 2,
    concurrentTasksPerWorker: 2,
    atomics: 'sync'
  });

  const tasks = [];
  let v: number;

  // Post 4 tasks, and wait for all of them to be ready.
  const i32array = new Int32Array(new SharedArrayBuffer(4));
  for (let index = 0; index < 4; index++) {
    tasks.push(pool.run({ i32array, index }));
  }

  // Wait for 2 tasks to enter 'wait' state.
  do {
    v = Atomics.load(i32array, 0);
    if (popcount8(v) >= 2) break;
    Atomics.wait(i32array, 0, v);
  } while (true);

  // The check above could also be !== 2 but it's hard to get things right
  // sometimes and this gives us a nice assertion. Basically, at this point
  // exactly 2 tasks should be in Atomics.wait() state.
  t.assert.strictEqual(popcount8(v), 2);
  // Wake both tasks up as simultaneously as possible. The other 2 tasks should
  // then start executing.
  Atomics.store(i32array, 0, 0);
  Atomics.notify(i32array, 0, Infinity);

  // Wait for the other 2 tasks to enter 'wait' state.
  do {
    v = Atomics.load(i32array, 0);
    if (popcount8(v) >= 2) break;
    Atomics.wait(i32array, 0, v);
  } while (true);

  // At this point, the first two tasks are definitely finished and have
  // definitely posted results back to the main thread, and the main thread
  // has definitely not received them yet, meaning that the Atomics check will
  // be used. Making sure that that works is the point of this test.

  // Wake up the remaining 2 tasks in order to make sure that the test finishes.
  // Do the same consistency check beforehand as above.
  t.assert.strictEqual(popcount8(v), 2);
  Atomics.store(i32array, 0, 0);
  Atomics.notify(i32array, 0, Infinity);

  await Promise.all(tasks);
});

// Inefficient but straightforward 8-bit popcount
function popcount8 (v : number) : number {
  v &= 0xff;
  if (v & 0b11110000) return popcount8(v >>> 4) + popcount8(v & 0xb00001111);
  if (v & 0b00001100) return popcount8(v >>> 2) + popcount8(v & 0xb00000011);
  if (v & 0b00000010) return popcount8(v >>> 1) + popcount8(v & 0xb00000001);
  return v;
}

test('avoids unbounded recursion', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread.ts'),
    minThreads: 2,
    maxThreads: 2,
    atomics: 'sync'
  });

  const tasks = [];
  for (let i = 1; i <= 10000; i++) {
    tasks.push(pool.run(null));
  }

  await Promise.all(tasks);
});

test('enable async mode', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval-params.js'),
    minThreads: 1,
    maxThreads: 1,
    atomics: 'async'
  });

  const bufs = [
    new Int32Array(new SharedArrayBuffer(4)),
    new Int32Array(new SharedArrayBuffer(4)),
    new Int32Array(new SharedArrayBuffer(4))
  ];

  const script = `
    setTimeout(() => { Atomics.add(input.shared[0], 0, 1); Atomics.notify(input.shared[0], 0, Infinity); }, 100);
    setTimeout(() => { Atomics.add(input.shared[1], 0, 1); Atomics.notify(input.shared[1], 0, Infinity);  }, 300);
    setTimeout(() => { Atomics.add(input.shared[2], 0, 1); Atomics.notify(input.shared[2], 0, Infinity); }, 500);

    true
  `;

  const promise = pool.run({
    code: script,
    shared: bufs
  });

  t.plan(2);

  const atResult1 = Atomics.wait(bufs[0], 0, 0);
  const atResult2 = Atomics.wait(bufs[1], 0, 0);
  const atResult3 = Atomics.wait(bufs[2], 0, 0);

  t.assert.deepStrictEqual([atResult1, atResult2, atResult3], ['ok', 'ok', 'ok']);
  t.assert.strictEqual(await promise, true);
});
