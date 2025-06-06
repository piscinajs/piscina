import { resolve } from 'path';
import { test } from 'tap';
import Piscina from '..';

test('can destroy pool while tasks are running', async ({ rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });
  setImmediate(() => pool.destroy());
  await rejects(pool.run('while(1){}'), /Terminating worker thread/);
});
