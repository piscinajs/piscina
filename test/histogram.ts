import Piscina from '..';
import { test } from 'tap';
import { resolve } from 'path';

test('pool will maintain run and wait time histograms by default', async ({ equal, ok }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  const tasks = [];
  for (let n = 0; n < 10; n++) {
    tasks.push(pool.runTask('42'));
  }
  await Promise.all(tasks);

  const waitTime = pool.waitTime as any;
  ok(waitTime);
  equal(typeof waitTime.average, 'number');
  equal(typeof waitTime.mean, 'number');
  equal(typeof waitTime.stddev, 'number');
  equal(typeof waitTime.min, 'number');
  equal(typeof waitTime.max, 'number');

  const runTime = pool.runTime as any;
  ok(runTime);
  equal(typeof runTime.average, 'number');
  equal(typeof runTime.mean, 'number');
  equal(typeof runTime.stddev, 'number');
  equal(typeof runTime.min, 'number');
  equal(typeof runTime.max, 'number');
});

test('pool will maintain run and wait time histograms when recordTiming is true', async ({ ok }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    recordTiming: true
  });

  const tasks = [];
  for (let n = 0; n < 10; n++) {
    tasks.push(pool.runTask('42'));
  }
  await Promise.all(tasks);

  const waitTime = pool.waitTime as any;
  ok(waitTime);

  const runTime = pool.runTime as any;
  ok(runTime);
});

test('pool does not maintain run and wait time histograms when recordTiming is false', async ({ equal }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    recordTiming: false
  });

  const tasks = [];
  for (let n = 0; n < 10; n++) {
    tasks.push(pool.runTask('42'));
  }
  await Promise.all(tasks);

  equal(pool.waitTime, null);
  equal(pool.runTime, null);
});
