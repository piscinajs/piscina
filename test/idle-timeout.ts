'use strict';

import Piscina from '..';
import { test } from 'tap';
import { resolve } from 'path';
import { promisify } from 'util';
import { once } from 'events';

const getThreadId = 'require("worker_threads").threadId';
const busyLoop = (ms : number) =>
  `{const start = Date.now(); while(Date.now() - start < ${ms}) {}}`;
const delay = promisify(setTimeout);

test('idle timeout will let go of threads early', async ({ is }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    idleTimeout: 2000,
    minThreads: 1,
    maxThreads: 2
  });

  is(pool.threads.length, 1);
  pool.threads[0].ref();
  await once(pool.threads[0], 'online');

  // The busy loops are here to prevent one task accidentally finishing before
  // the other and the two of them sharing a thread.
  const firstTasks = [
    pool.runTask(busyLoop(100) + getThreadId),
    pool.runTask(busyLoop(100) + getThreadId)
  ];
  is(pool.threads.length, 2);

  const earlyThreadIds = await Promise.all(firstTasks);
  is(pool.threads.length, 2);

  await delay(3000);
  is(pool.threads.length, 1);

  const secondTasks = [
    pool.runTask(busyLoop(100) + getThreadId),
    pool.runTask(busyLoop(100) + getThreadId)
  ];
  is(pool.threads.length, 2);

  const lateThreadIds = await Promise.all(secondTasks);

  // One thread should have been idle in between and exited, one should have
  // been reused.
  is(earlyThreadIds.length, 2);
  is(lateThreadIds.length, 2);
  is(new Set([...earlyThreadIds, ...lateThreadIds]).size, 3);
});
