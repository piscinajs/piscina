import Piscina from '..';
import { test } from 'tap';
import { resolve } from 'path';
import { promisify } from 'util';

const delay = promisify(setTimeout);

test('idle timeout will let go of threads early', async ({ equal }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/wait-for-others.ts'),
    idleTimeout: 500,
    minThreads: 1,
    maxThreads: 2
  });

  equal(pool.threads.length, 1);
  const buffer = new Int32Array(new SharedArrayBuffer(4));

  const firstTasks = [
    pool.run([buffer, 2]),
    pool.run([buffer, 2])
  ];
  equal(pool.threads.length, 2);

  const earlyThreadIds = await Promise.all(firstTasks);
  equal(pool.threads.length, 2);

  await delay(2000);
  equal(pool.threads.length, 1);

  const secondTasks = [
    pool.run([buffer, 4]),
    pool.run([buffer, 4])
  ];
  equal(pool.threads.length, 2);

  const lateThreadIds = await Promise.all(secondTasks);

  // One thread should have been idle in between and exited, one should have
  // been reused.
  equal(earlyThreadIds.length, 2);
  equal(lateThreadIds.length, 2);
  equal(new Set([...earlyThreadIds, ...lateThreadIds]).size, 3);
});

test('idle timeout will not let go of threads if Infinity is used as the value', async ({ deepEqual, equal }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/wait-for-others.ts'),
    idleTimeout: Infinity,
    minThreads: 1,
    maxThreads: 2
  });
  equal(pool.threads.length, 1);
  const buffer = new Int32Array(new SharedArrayBuffer(4));

  const firstTasks = [
    pool.run([buffer, 2]),
    pool.run([buffer, 2])
  ];
  equal(pool.threads.length, 2);

  const earlyThreadIds = await Promise.all(firstTasks);
  equal(pool.threads.length, 2);

  await delay(2000);
  equal(pool.threads.length, 2);

  const secondTasks = [
    pool.run([buffer, 4]),
    pool.run([buffer, 4]),
  ];
  equal(pool.threads.length, 2);



  const lateThreadIds = await Promise.all(secondTasks);
  deepEqual(earlyThreadIds, lateThreadIds);

  await Promise.all([pool.run([buffer, 6]), pool.run([buffer, 6]), pool.run([buffer, 6])]);
  equal(pool.threads.length, 2);
});