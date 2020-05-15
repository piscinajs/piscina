import Piscina from '..';
import { test } from 'tap';
import { resolve } from 'path';
import { promisify } from 'util';

const delay = promisify(setTimeout);

test('idle timeout will let go of threads early', async ({ is }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/wait-for-others.ts'),
    idleTimeout: 500,
    minThreads: 1,
    maxThreads: 2
  });

  is(pool.threads.length, 1);
  const buffer = new Int32Array(new SharedArrayBuffer(4));

  const firstTasks = [
    pool.runTask([buffer, 2]),
    pool.runTask([buffer, 2])
  ];
  is(pool.threads.length, 2);

  const earlyThreadIds = await Promise.all(firstTasks);
  is(pool.threads.length, 2);

  await delay(2000);
  is(pool.threads.length, 1);

  const secondTasks = [
    pool.runTask([buffer, 4]),
    pool.runTask([buffer, 4])
  ];
  is(pool.threads.length, 2);

  const lateThreadIds = await Promise.all(secondTasks);

  // One thread should have been idle in between and exited, one should have
  // been reused.
  is(earlyThreadIds.length, 2);
  is(lateThreadIds.length, 2);
  is(new Set([...earlyThreadIds, ...lateThreadIds]).size, 3);
});
