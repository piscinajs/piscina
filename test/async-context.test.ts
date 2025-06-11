import { createHook, executionAsyncId } from 'async_hooks';
import Piscina from '..';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { resolve } from 'path';

test('postTask() calls the correct async hooks', async (t: TestContext) => {
  let taskId;
  let initCalls = 0;
  let beforeCalls = 0;
  let afterCalls = 0;
  let resolveCalls = 0;

  const hook = createHook({
    init (id, type) {
      if (type === 'Piscina.Task') {
        initCalls++;
        taskId = id;
      }
    },
    before (id) {
      if (id === taskId) beforeCalls++;
    },
    after (id) {
      if (id === taskId) afterCalls++;
    },
    promiseResolve () {
      if (executionAsyncId() === taskId) resolveCalls++;
    }
  });
  hook.enable();

  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  await pool.run('42');

  hook.disable();
  t.assert.strictEqual(initCalls, 1);
  t.assert.strictEqual(beforeCalls, 1);
  t.assert.strictEqual(afterCalls, 1);
  t.assert.strictEqual(resolveCalls, 1);
});
