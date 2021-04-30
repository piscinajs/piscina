import concat from 'concat-stream';
import { spawn } from 'child_process';
import { resolve } from 'path';
import { test } from 'tap';

test('console.log() calls are not blocked by Atomics.wait()', async ({ equal }) => {
  const proc = spawn(process.execPath, [
    ...process.execArgv, resolve(__dirname, 'fixtures/console-log.ts')
  ], {
    stdio: ['inherit', 'pipe', 'inherit']
  });

  const data = await new Promise((resolve) => {
    proc.stdout.setEncoding('utf8').pipe(concat(resolve));
  });
  equal(data, 'A\nB\n');
});
