import { resolve } from 'node:path';
import { cpus } from 'node:os';
import { once } from 'node:events';
import Piscina from '..';
import { test } from 'tap';

test('will start with minThreads and max out at maxThreads', { only: true }, async ({ equal, rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 2,
    maxThreads: 4,
    concurrentTasksPerWorker: 1
  });
  let counter = 0;

  pool.on('workerCreate', () => {
    counter++;
  });

  equal(pool.threads.length, 2);

  rejects(pool.run('while(true) {}'));
  rejects(pool.run('while(true) {}'));

  // #3
  rejects(pool.run('while(true) {}'));
  await once(pool, 'workerCreate');

  // #4
  rejects(pool.run('while(true) {}'));
  await once(pool, 'workerCreate');

  // #4 - as spawn does not happen synchronously anymore, we wait for the signal once more
  rejects(pool.run('while(true) {}'));
  await once(pool, 'workerCreate');

  equal(pool.threads.length, 4);
  await pool.destroy();
  equal(pool.threads.length, 0);
  equal(counter, 4);
});

test('low maxThreads sets minThreads', async ({ equal }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1
  });
  equal(pool.threads.length, 1);
  equal(pool.options.minThreads, 1);
  equal(pool.options.maxThreads, 1);
});

test('high minThreads sets maxThreads', {
  skip: cpus().length > 8
}, async ({ equal }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 16
  });
  equal(pool.threads.length, 16);
  equal(pool.options.minThreads, 16);
  equal(pool.options.maxThreads, 16);
});

test('conflicting min/max threads is error', async ({ throws }) => {
  throws(() => new Piscina({
    minThreads: 16,
    maxThreads: 8
  }), /options.minThreads and options.maxThreads must not conflict/);
});

test('thread count should be 0 upon destruction', async ({ equal }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 2,
    maxThreads: 4
  });
  equal(pool.threads.length, 2);
  await pool.destroy();
  equal(pool.threads.length, 0);
});
