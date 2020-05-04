import Piscina from '..';
import { test } from 'tap';
import { resolve } from 'path';

test('pool will maintain run and wait time histograms', async ({ is, ok }) => {
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
  is(typeof waitTime.average, 'number');
  is(typeof waitTime.mean, 'number');
  is(typeof waitTime.stddev, 'number');
  is(typeof waitTime.min, 'number');
  is(typeof waitTime.max, 'number');

  const runTime = pool.runTime as any;
  ok(runTime);
  is(typeof runTime.average, 'number');
  is(typeof runTime.mean, 'number');
  is(typeof runTime.stddev, 'number');
  is(typeof runTime.min, 'number');
  is(typeof runTime.max, 'number');
});
