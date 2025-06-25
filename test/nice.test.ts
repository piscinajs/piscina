import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { getCurrentProcessPriority, WindowsThreadPriority } from '@napi-rs/nice';
import Piscina from '..';

test('niceness - Linux:', { skip: process.platform !== 'linux' }, async scope => {
  scope.plan(2);

  await scope.test('can set niceness for threads on Linux', async () => {
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
    assert.strictEqual(result, expected);
  });

  await scope.test('setting niceness never does anything bad', async () => {
    const worker = new Piscina({
      filename: resolve(__dirname, 'fixtures/eval.js'),
      niceIncrement: 5
    });

    const result = await worker.run('42');
    assert.strictEqual(result, 42);
  });
});

test('niceness - Windows', {
  skip: process.platform !== 'win32'
}, scope => {
  scope.plan(1);
  scope.test('can set niceness for threads on Windows', async () => {
    const worker = new Piscina({
      filename: resolve(__dirname, 'fixtures/eval.js'),
      niceIncrement: WindowsThreadPriority.ThreadPriorityAboveNormal
    });

    const result = await worker.run('require("@napi-rs/nice").getCurrentProcessPriority()');

    assert.strictEqual(result, WindowsThreadPriority.ThreadPriorityAboveNormal);
  });
});
