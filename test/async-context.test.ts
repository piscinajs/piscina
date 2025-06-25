import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { createHook, executionAsyncId } from 'node:async_hooks';
import Piscina from '..';


test('postTask() calls the correct async hooks', async () => {
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
  assert.strictEqual(initCalls, 1);
  assert.strictEqual(beforeCalls, 1);
  assert.strictEqual(afterCalls, 1);
  assert.strictEqual(resolveCalls, 1);
});
