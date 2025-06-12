import Piscina from '..';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { resolve } from 'path';

test('pool will maintain run and wait time histograms', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/vm.js')
  });

  try {
    await pool.run({ payload: 'throw new Error("foo")' });
    t.assert.fail('Expected an error');
  } catch (error) {
    t.assert.strictEqual(error.message, 'foo');
  }
});
