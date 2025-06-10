import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

import concat from 'concat-stream';
import { test } from 'tap';

test('console.log() calls are not blocked by Atomics.wait() (sync mode)', async ({ equal }) => {
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
  equal(dataStdout, 'A\n');
  equal(dataStderr, 'B\n');
});
