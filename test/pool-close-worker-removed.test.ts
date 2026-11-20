import * as assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { test } from 'node:test';

test('close() still works through the queue after a worker is removed', async () => {
  // In a child process: if close() spins, it blocks the event loop, so only
  // a timeout outside the process can end it.
  const proc = spawn(process.execPath, [
    ...process.execArgv, resolve(__dirname, 'fixtures/close-after-worker-removed.ts')
  ], {
    stdio: ['ignore', 'pipe', 'inherit'],
    timeout: 5000
  });
  let stdout = '';
  proc.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });

  const [code, signal] = await once(proc, 'exit');
  assert.strictEqual(signal, null, 'close() never finished');
  assert.strictEqual(code, 0);
  assert.strictEqual(stdout, 'closed [1,2,3]\n');
});
