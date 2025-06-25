import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import concat from 'concat-stream';

test('console.log() calls are not blocked by Atomics.wait() (sync mode)', async () => {
  const proc = spawn(process.execPath, [
    ...process.execArgv, resolve(__dirname, 'fixtures/console-log.ts')
  ], {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: {
      PISCINA_ENABLE_ASYNC_ATOMICS: '0'
    }
  });

  const dataStdout = await new Promise((resolve) => {
    proc.stdout.setEncoding('utf8').pipe(concat(resolve));
  });
  const dataStderr = await new Promise((resolve) => {
    proc.stderr.setEncoding('utf8').pipe(concat(resolve));
  });
  assert.strictEqual(dataStdout, 'A\n');
  assert.strictEqual(dataStderr, 'B\n');
});
