import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import Piscina from '..';

test('transferable objects must be transferred', async () => {
  // One worker, so get() runs where send() kept the buffer.
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/send-buffer-then-get-length.js'),
    atomics: 'disabled',
    minThreads: 1,
    maxThreads: 1
  });
  await pool.run({}, { name: 'send' });
  const after = await pool.run({}, { name: 'get' });
  assert.strictEqual(after, 0);
});

test('objects that implement transferable must be transferred', async () => {
  const pool = new Piscina({
    filename: resolve(
      __dirname,
      'fixtures/send-transferrable-then-get-length.js'
    ),
    atomics: 'disabled',
    minThreads: 1,
    maxThreads: 1
  });
  await pool.run({}, { name: 'send' });
  const after = await pool.run({}, { name: 'get' });
  assert.strictEqual(after, 0);
});
