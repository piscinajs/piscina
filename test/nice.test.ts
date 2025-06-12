import Piscina from '..';
import { getCurrentProcessPriority, WindowsThreadPriority } from '@napi-rs/nice';
import { resolve } from 'path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';

test('niceness - Linux:', { skip: process.platform !== 'linux' }, async scope => {
  scope.plan(2);

  await scope.test('can set niceness for threads on Linux', async (t: TestContext) => {
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
    t.assert.strictEqual(result, expected);
  });

  await scope.test('setting niceness never does anything bad', async (t: TestContext) => {
    const worker = new Piscina({
      filename: resolve(__dirname, 'fixtures/eval.js'),
      niceIncrement: 5
    });

    const result = await worker.run('42');
    t.assert.strictEqual(result, 42);
  });
});

test('niceness - Windows', {
  skip: process.platform !== 'win32'
}, scope => {
  scope.plan(1);
  scope.test('can set niceness for threads on Windows', async (t: TestContext) => {
    const worker = new Piscina({
      filename: resolve(__dirname, 'fixtures/eval.js'),
      niceIncrement: WindowsThreadPriority.ThreadPriorityAboveNormal
    });

    const result = await worker.run('require("@napi-rs/nice").getCurrentProcessPriority()');

    t.assert.strictEqual(result, WindowsThreadPriority.ThreadPriorityAboveNormal);
  });
});
