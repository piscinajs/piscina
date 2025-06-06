import Piscina from '..';
import { test } from 'tap';
import { resolve } from 'path';
import { PiscinaWorker } from '../dist/worker_pool';

test('pool will maintain run and wait time histograms by default', async ({ equal, ok }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  const tasks = [];
  for (let n = 0; n < 10; n++) {
    tasks.push(pool.run('42'));
  }
  await Promise.all(tasks);

  const histogram = pool.histogram;
  const waitTime = histogram.waitTime;
  ok(waitTime);
  equal(typeof waitTime.average, 'number');
  equal(typeof waitTime.mean, 'number');
  equal(typeof waitTime.stddev, 'number');
  equal(typeof waitTime.min, 'number');
  equal(typeof waitTime.max, 'number');

  const runTime = histogram.runTime;
  ok(runTime);
  equal(typeof runTime.average, 'number');
  equal(typeof runTime.mean, 'number');
  equal(typeof runTime.stddev, 'number');
  equal(typeof runTime.min, 'number');
  equal(typeof runTime.max, 'number');
  equal(typeof histogram.resetRunTime, 'function');
  equal(typeof histogram.resetWaitTime, 'function');
});

test('pool will maintain run and wait time histograms when recordTiming is true', async ({ ok }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    recordTiming: true
  });

  const tasks = [];
  for (let n = 0; n < 10; n++) {
    tasks.push(pool.run('42'));
  }
  await Promise.all(tasks);

  const waitTime = pool.histogram.waitTime;
  ok(waitTime);

  const runTime = pool.histogram.runTime;
  ok(runTime);
});

test('pool does not maintain run and wait time histograms when recordTiming is false', async ({ notOk }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    recordTiming: false
  });

  const tasks = [];
  for (let n = 0; n < 10; n++) {
    tasks.push(pool.run('42'));
  }
  await Promise.all(tasks);

  notOk(pool.histogram.waitTime);
  notOk(pool.histogram.runTime);
});

test('workers has histogram', async t => {
  let index = 0;
  let list: PiscinaWorker[];
  // Its expected to have one task get balanced twice due to the load balancer distribution
  // first task enters, its distributed; second is enqueued, once first is done, second is distributed and normalizes
  t.plan(4);
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1,
    concurrentTasksPerWorker: 1,
    workerHistogram: true,
    loadBalancer (_task, workers) {
      // Verify distribution to properly test this feature
      const candidate = workers[index++ % workers.length];

      // We assign it everytime is called to check the histogram
      // and that the list remains the same
      list = workers;

      if (candidate.currentUsage !== 0) {
        return null;
      }

      return candidate;
    }
  });

  const tasks = [];
  for (let n = 0; n < 10; n++) {
    tasks.push(pool.run('new Promise(resolve => setTimeout(resolve, 500))'));
  }
  await Promise.all(tasks);
  const histogram = list[0].histogram;
  t.type(histogram?.average, 'number');
  t.type(histogram?.max, 'number');
  t.type(histogram?.mean, 'number');
  t.type(histogram?.min, 'number');
});

test('workers does not have histogram if disabled', async t => {
  let index = 0;
  // After each task the balancer is called to distribute the next task
  // The first task is distributed, the second is enqueued, once the first is done, the second is distributed and normalizes
  t.plan(10 * 2);
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1,
    concurrentTasksPerWorker: 1,
    workerHistogram: false,
    loadBalancer (_task, workers) {
      // Verify distribution to properly test this feature
      const candidate = workers[index++ % workers.length];
      const histogram = candidate.histogram;
      t.notOk(histogram);

      if (candidate.currentUsage !== 0) {
        return null;
      }

      return candidate;
    }
  });

  const tasks = [];
  for (let n = 0; n < 10; n++) {
    tasks.push(pool.run('new Promise(resolve => setTimeout(resolve, 500))'));
  }
  await Promise.all(tasks);
});

test('opts.workerHistogram should be a boolean value', t => {
  let index = 0;
  t.plan(1);
  t.throws(() => {
    // eslint-disable-next-line no-new
    new Piscina({
      filename: resolve(__dirname, 'fixtures/eval.js'),
      maxThreads: 1,
      concurrentTasksPerWorker: 1,
      // @ts-expect-error
      workerHistogram: 1,
      loadBalancer (_task, workers) {
        // Verify distribution to properly test this feature
        const candidate = workers[index++ % workers.length];
        const histogram = candidate.histogram;

        t.notOk(histogram);

        if (candidate.currentUsage !== 0) {
          return null;
        }

        return candidate;
      }
    });
  }, 'options.workerHistogram must be a boolean');
});
