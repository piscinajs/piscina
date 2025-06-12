import Piscina from '..';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { resolve } from 'path';

test('can destroy pool while tasks are running', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });
  setImmediate(() => pool.destroy());
  await t.assert.rejects(pool.run('while(1){}'), /Terminating worker thread/);
});
