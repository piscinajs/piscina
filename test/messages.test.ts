import { once } from 'events';
import { resolve } from 'path';
import Piscina from 'piscina';
import { test } from 'tap';

test('Pool receive message from workers', async ({ equal }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  const messagePromise = once(pool, 'message');

  const taskResult = pool.run(`
        require('worker_threads').parentPort.postMessage("some message");
        42
    `);
  equal(await taskResult, 42);
  equal((await messagePromise)[0], 'some message');
});
