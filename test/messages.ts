import Piscina from '..';
import { test } from 'tap';
import { resolve } from 'path';
import { once } from 'events';

test('Pool receive message from workers', async ({ equal }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  const messagePromise = once(pool, 'message');

  const taskResult = pool.runTask(`
        require('worker_threads').parentPort.postMessage("some message");
        42
    `);
  equal(await taskResult, 42);
  equal((await messagePromise)[0], 'some message');
});
