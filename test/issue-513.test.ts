import assert from 'node:assert';
import { test } from 'node:test';
import { resolve } from 'node:path';
import Piscina from '..';

test('pool will maintain run and wait time histograms', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/vm.js')
  });

  try {
    await pool.run({ payload: 'throw new Error("foo")' });
    assert.fail('Expected an error');
  } catch (error) {
    assert.strictEqual(error.message, 'foo');
  }
});
