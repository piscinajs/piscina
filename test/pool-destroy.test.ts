import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import Piscina from '..';

test('can destroy pool while tasks are running', () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });
  setImmediate(() => pool.destroy());

  assert.rejects(pool.run('while(1){}'), /Terminating worker thread/);
});
