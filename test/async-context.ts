import { createHook, executionAsyncId } from 'async_hooks';
import Piscina from '..';
import { test } from 'tap';
import { resolve } from 'path';

test('postTask() calls the correct async hooks', async ({ is }) => {
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

  await pool.runTask('42');

  hook.disable();
  is(initCalls, 1);
  is(beforeCalls, 1);
  is(afterCalls, 1);
  is(resolveCalls, 1);
});
