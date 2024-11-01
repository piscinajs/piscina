import Piscina from '..';
import { test } from 'tap';
import { resolve } from 'path';

function wait () {
  return new Promise((resolve) => setTimeout(resolve, 1500));
}

test('transferable objects must be transferred', async ({ equal }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/send-buffer-then-get-length.js'),
    atomics: 'disabled'
  });
  await pool.run({}, { name: 'send' });
  await wait();
  const after = await pool.run({}, { name: 'get' });
  equal(after, 0);
});

test('objects that implement transferable must be transferred', async ({
  equal
}) => {
  const pool = new Piscina({
    filename: resolve(
      __dirname,
      'fixtures/send-transferrable-then-get-length.js'
    ),
    atomics: 'disabled'
  });
  await pool.run({}, { name: 'send' });
  await wait();
  const after = await pool.run({}, { name: 'get' });
  equal(after, 0);
});
