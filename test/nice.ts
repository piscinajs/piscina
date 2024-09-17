import Piscina from '..';
import { getCurrentProcessPriority, WindowsThreadPriority } from '@napi-rs/nice';
import { resolve } from 'path';
import { test } from 'tap';

test('can set niceness for threads on Linux', {
  skip: process.platform !== 'linux'
}, async ({ equal }) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    niceIncrement: 5
  });

  const currentNiceness = getCurrentProcessPriority();
  const result = await worker.runTask('require("@napi-rs/nice").getCurrentProcessPriority()');

  // niceness is capped to 19 on Linux.
  const expected = Math.min(currentNiceness + 5, 19);
  equal(result, expected);
});

test('can set niceness for threads on Windows', {
  skip: process.platform !== 'win32'
}, async ({ equal }) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    niceIncrement: WindowsThreadPriority.ThreadPriorityAboveNormal
  });

  const result = await worker.runTask('require("@napi-rs/nice").getCurrentProcessPriority()');

  equal(result, WindowsThreadPriority.ThreadPriorityAboveNormal);
});

test('setting niceness never does anything bad', async ({ equal }) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    niceIncrement: 5
  });

  const result = await worker.runTask('42');
  equal(result, 42);
});
