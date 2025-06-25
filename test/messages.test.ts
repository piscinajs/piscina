import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { once } from 'node:events';
import Piscina from '..';

test('Pool receive message from workers', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  const messagePromise = once(pool, 'message');

  const taskResult = pool.run(`
        require('worker_threads').parentPort.postMessage("some message");
        42
    `);

  assert.strictEqual(await taskResult, 42);
  assert.strictEqual((await messagePromise)[0], 'some message');
});
