import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import Piscina from '..';
import { PiscinaWorker } from '../dist/worker_pool';

test('pool will maintain run and wait time histograms by default', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  const tasks = [];
  for (let n = 0; n < 5; n++) {
    tasks.push(pool.run('42'));
  }
  await Promise.all(tasks);

  const histogram = pool.histogram;
  const waitTime = histogram.waitTime;
  assert.ok(waitTime);
  assert.strictEqual(typeof waitTime.average, 'number');
  assert.strictEqual(typeof waitTime.mean, 'number');
  assert.strictEqual(typeof waitTime.stddev, 'number');
  assert.strictEqual(typeof waitTime.min, 'number');
  assert.strictEqual(typeof waitTime.max, 'number');

  const runTime = histogram.runTime;
  assert.ok(runTime);
  assert.strictEqual(typeof runTime.average, 'number');
  assert.strictEqual(typeof runTime.mean, 'number');
  assert.strictEqual(typeof runTime.stddev, 'number');
  assert.strictEqual(typeof runTime.min, 'number');
  assert.strictEqual(typeof runTime.max, 'number');
  assert.strictEqual(typeof histogram.resetRunTime, 'function');
  assert.strictEqual(typeof histogram.resetWaitTime, 'function');
});

test('pool will maintain reset histograms upon call', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  const tasks = [];
  for (let n = 0; n < 5; n++) {
    tasks.push(pool.run('42'));
  }
  await Promise.all(tasks);

  const histogram = pool.histogram;
  let waitTime = histogram.waitTime;
  assert.ok(waitTime);
  assert.strictEqual(typeof waitTime.average, 'number');
  assert.strictEqual(typeof waitTime.mean, 'number');
  assert.strictEqual(typeof waitTime.stddev, 'number');
  assert.ok(waitTime.min > 0);
  assert.ok(waitTime.max > 0);

  let runTime = histogram.runTime;
  assert.ok(runTime);
  assert.strictEqual(typeof runTime.average, 'number');
  assert.strictEqual(typeof runTime.mean, 'number');
  assert.strictEqual(typeof runTime.stddev, 'number');
  assert.ok(runTime.min > 0);
  assert.ok(runTime.max > 0);

  histogram.resetRunTime();
  runTime = histogram.runTime;
  assert.ok(Number.isNaN(runTime.average));
  assert.ok(Number.isNaN(runTime.mean));
  assert.ok(Number.isNaN(runTime.stddev));
  assert.strictEqual(runTime.max, 0);

  histogram.resetWaitTime();
  waitTime = histogram.waitTime;
  assert.ok(Number.isNaN(waitTime.average));
  assert.ok(Number.isNaN(waitTime.mean));
  assert.ok(Number.isNaN(waitTime.stddev));
  assert.strictEqual(waitTime.max, 0);
});

test('pool will maintain run and wait time histograms when recordTiming is true', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    recordTiming: true
  });

  const tasks = [];
  for (let n = 0; n < 5; n++) {
    tasks.push(pool.run('42'));
  }
  await Promise.all(tasks);

  const waitTime = pool.histogram.waitTime;
  assert.ok(waitTime);

  const runTime = pool.histogram.runTime;
  assert.ok(runTime);
});

test('pool does not maintain run and wait time histograms when recordTiming is false', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    recordTiming: false
  });

  const tasks = [];
  for (let n = 0; n < 5; n++) {
    tasks.push(pool.run('42'));
  }
  await Promise.all(tasks);

  assert.ok(!pool.histogram.waitTime);
  assert.ok(!pool.histogram.runTime);
});

test('workers has histogram', async (t: TestContext) => {
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
  for (let n = 0; n < 5; n++) {
    tasks.push(pool.run('new Promise(resolve => setTimeout(resolve, 500))'));
  }
  await Promise.all(tasks);
  const histogram = list[0].histogram;
  t.assert.ok(typeof histogram?.average, 'number');
  t.assert.ok(typeof histogram?.max, 'number');
  t.assert.ok(typeof histogram?.mean, 'number');
  t.assert.ok(typeof histogram?.min, 'number');
});

test('workers does not have histogram if disabled', async (t: TestContext) => {
  let index = 0;
  // After each task the balancer is called to distribute the next task
  // The first task is distributed, the second is enqueued, once the first is done, the second is distributed and normalizes
  t.plan(5 * 2);
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1,
    concurrentTasksPerWorker: 1,
    workerHistogram: false,
    loadBalancer (_task, workers) {
      // Verify distribution to properly test this feature
      const candidate = workers[index++ % workers.length];
      const histogram = candidate.histogram;
      t.assert.ok(!histogram);

      if (candidate.currentUsage !== 0) {
        return null;
      }

      return candidate;
    }
  });

  const tasks = [];
  for (let n = 0; n < 5; n++) {
    tasks.push(pool.run('new Promise(resolve => setTimeout(resolve, 5))'));
  }
  await Promise.all(tasks);
});

test('opts.workerHistogram should be a boolean value', (t: TestContext) => {
  let index = 0;
  t.plan(1);
  t.assert.throws(() => {
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

        t.assert.ok(!histogram);

        if (candidate.currentUsage !== 0) {
          return null;
        }

        return candidate;
      }
    });
  }, {
    message: 'options.workerHistogram must be a boolean'
  });
});
