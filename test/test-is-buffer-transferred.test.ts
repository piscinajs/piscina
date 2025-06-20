import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import Piscina from '..';

function wait () {
  // Timeout here should be little bit longer
  // than in the worker timeout
  // to ensure there are no flaky tests
  return new Promise((resolve) => setTimeout(resolve, 10));
}

test('transferable objects must be transferred', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/send-buffer-then-get-length.js'),
    atomics: 'disabled'
  });
  await pool.run({}, { name: 'send' });
  await wait();
  const after = await pool.run({}, { name: 'get' });
  assert.strictEqual(after, 0);
});

test('objects that implement transferable must be transferred', async () => {
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
  assert.strictEqual(after, 0);
});
