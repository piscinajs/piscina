import Piscina from '..';
import { getCurrentProcessPriority, WindowsThreadPriority } from '@napi-rs/nice';
import { resolve } from 'path';
import { test } from 'tap';

test('niceness - Linux:', { skip: process.platform !== 'linux' }, scope => {
  scope.plan(2);

  scope.test('can set niceness for threads on Linux', async ({ equal }) => {
    const worker = new Piscina({
      filename: resolve(__dirname, 'fixtures/eval.js'),
      niceIncrement: 5
    });

    // ts-ignore because the dependency is not installed on Windows.
    // @ts-ignore
    const currentNiceness = getCurrentProcessPriority();
    const result = await worker.run('require("@napi-rs/nice").getCurrentProcessPriority()');
    // niceness is capped to 19 on Linux.
    const expected = Math.min(currentNiceness + 5, 19);
    equal(result, expected);
  });

  scope.test('setting niceness never does anything bad', async ({ equal }) => {
    const worker = new Piscina({
      filename: resolve(__dirname, 'fixtures/eval.js'),
      niceIncrement: 5
    });

    const result = await worker.run('42');
    equal(result, 42);
  });
});

test('niceness - Windows', {
  skip: process.platform !== 'win32'
}, scope => {
  scope.plan(1);
  scope.test('can set niceness for threads on Windows', async ({ equal }) => {
    const worker = new Piscina({
      filename: resolve(__dirname, 'fixtures/eval.js'),
      niceIncrement: WindowsThreadPriority.ThreadPriorityAboveNormal
    });

    const result = await worker.run('require("@napi-rs/nice").getCurrentProcessPriority()');

    equal(result, WindowsThreadPriority.ThreadPriorityAboveNormal);
  });
});
