import Piscina from '..';
import { test } from 'tap';
import { resolve } from 'path';

test('can destroy pool while tasks are running', async ({ rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });
  setImmediate(() => pool.destroy());
  await rejects(pool.runTask('while(1){}'), /Terminating worker thread/);
});
