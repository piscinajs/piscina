import { resolve } from 'path';
import { test } from 'tap';
import Piscina from '..';

test('pool will maintain run and wait time histograms', async ({
  equal,
  fail
}) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/vm.js')
  });

  try {
    await pool.run({ payload: 'throw new Error("foo")' });
    fail('Expected an error');
  } catch (error) {
    equal(error.message, 'foo');
  }
});
