import Piscina from '..';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { resolve } from 'path';

function wait () {
  return new Promise((resolve) => setTimeout(resolve, 1500));
}

test('transferable objects must be transferred', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/send-buffer-then-get-length.js'),
    atomics: 'disabled'
  });
  await pool.run({}, { name: 'send' });
  await wait();
  const after = await pool.run({}, { name: 'get' });
  t.assert.strictEqual(after, 0);
});

test('objects that implement transferable must be transferred', async (t: TestContext) => {
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
  t.assert.strictEqual(after, 0);
});
