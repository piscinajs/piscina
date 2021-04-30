import Piscina from '..';
import { cpus } from 'os';
import { test } from 'tap';
import { resolve } from 'path';

test('will start with minThreads and max out at maxThreads', async ({ equal, rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 2,
    maxThreads: 4
  });
  equal(pool.threads.length, 2);
  rejects(pool.runTask('while(true) {}'));
  equal(pool.threads.length, 2);
  rejects(pool.runTask('while(true) {}'));
  equal(pool.threads.length, 2);
  rejects(pool.runTask('while(true) {}'));
  equal(pool.threads.length, 3);
  rejects(pool.runTask('while(true) {}'));
  equal(pool.threads.length, 4);
  rejects(pool.runTask('while(true) {}'));
  equal(pool.threads.length, 4);
  await pool.destroy();
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
