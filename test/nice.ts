import Piscina from '..';
import { resolve } from 'path';
import { test } from 'tap';

test('can set niceness for threads on Linux', {
  skip: process.platform !== 'linux'
}, async ({ equal }) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    niceIncrement: 5
  });

  // ts-ignore because the dependency is not installed on Windows.
  // @ts-ignore
  const currentNiceness = (await import('nice-napi')).default(0);
  const result = await worker.runTask('require("nice-napi")()');

  // niceness is capped to 19 on Linux.
  const expected = Math.min(currentNiceness + 5, 19);
  equal(result, expected);
});

test('setting niceness never does anything bad', async ({ equal }) => {
  const worker = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    niceIncrement: 5
  });

  const result = await worker.runTask('42');
  equal(result, 42);
});
