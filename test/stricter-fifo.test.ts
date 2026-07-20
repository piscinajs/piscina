import * as assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import Piscina from '..';

test('stricterFIFO keeps queued tasks in submission order', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/task-logger.js'),
    minThreads: 1,
    maxThreads: 1,
    stricterFIFO: true
  });

  const tasks = new Array(20).fill(0).map((_, i) => ({ i }));
  const pending = tasks.map((task) => pool.run(task, { name: 'run' }));
  await Promise.all(pending);

  const log = await pool.run({}, { name: 'getLog' });
  assert.deepEqual(log, tasks);

  await pool.destroy();
});

test('stricterFIFO must be a boolean', () => {
  assert.throws(
    () => new Piscina({ stricterFIFO: 1 } as any),
    /options.stricterFIFO must be a boolean/
  );
});
