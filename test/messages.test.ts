import Piscina from '..';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { resolve } from 'path';
import { once } from 'events';

test('Pool receive message from workers',  async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  const messagePromise = once(pool, 'message');

  const taskResult = pool.run(`
        require('worker_threads').parentPort.postMessage("some message");
        42
    `);
  t.assert.strictEqual(await taskResult, 42);
  t.assert.strictEqual((await messagePromise)[0], 'some message');
});
