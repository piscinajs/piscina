import Piscina from '..';
import { test } from 'tap';
import { resolve } from 'path';

test('coverage test for Atomics optimization', async ({ equal }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/notify-then-sleep-or.ts'),
    minThreads: 2,
    maxThreads: 2,
    concurrentTasksPerWorker: 2
  });

  const tasks = [];
  let v : number;

  // Post 4 tasks, and wait for all of them to be ready.
  const i32array = new Int32Array(new SharedArrayBuffer(4));
  for (let index = 0; index < 4; index++) {
    tasks.push(pool.runTask({ i32array, index }));
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
  equal(popcount8(v), 2);
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
  equal(popcount8(v), 2);
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
    maxThreads: 2
  });

  const tasks = [];
  for (let i = 1; i <= 10000; i++) {
    tasks.push(pool.runTask(null));
  }

  await Promise.all(tasks);
});
