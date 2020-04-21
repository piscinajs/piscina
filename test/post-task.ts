'use strict';

import { MessageChannel } from 'worker_threads';
import Piscina from '..';
import { test } from 'tap';
import { resolve } from 'path';

test('postTask() can transfer ArrayBuffer instances', async ({ is }) => {
  const pool = new Piscina({
    fileName: resolve(__dirname, 'fixtures/simple-isworkerthread.ts')
  });

  const ab = new ArrayBuffer(40);
  await pool.runTask({ ab }, [ab]);
  is(ab.byteLength, 0);
});

test('postTask() cannot clone build-in objects', async ({ rejects }) => {
  const pool = new Piscina({
    fileName: resolve(__dirname, 'fixtures/simple-isworkerthread.ts')
  });

  const obj = new MessageChannel().port1;
  rejects(pool.runTask({ obj }));
});
