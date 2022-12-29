import Piscina from '..';
import { test } from 'tap';
import { resolve } from 'path';

test('workerIdEnv: undefined creates no env var', async ({ same }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  const isUndefined = await pool.runTask('process.env.WORKER_ID === undefined');
  same(isUndefined, true);
});

test('workerIdEnv: false creates no env var', async ({ same }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    workerIdEnv: false
  });

  const isUndefined = await pool.runTask('process.env.WORKER_ID === undefined');
  same(isUndefined, true);
});

test('workerIdEnv: true creates env var with name WORKER_ID', async ({ same }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    workerIdEnv: true,
    minThreads: 1
  });

  const id = await pool.runTask('process.env.WORKER_ID');
  same(id, '1');
});

test('workerIdEnv: FOO_ID creates env var with name FOO_ID', async ({ same }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    workerIdEnv: 'FOO_ID',
    minThreads: 1
  });

  const id = await pool.runTask('process.env.FOO_ID');
  same(id, '1');
});

test('Same WORKER_ID for tasks run on same thread', async ({ same }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    workerIdEnv: true,
    minThreads: 1,
    maxThreads: 1
  });

  for (let i = 0; i < 4; i++) {
    const { id, isNew, pastId } = await pool.runTask(`const id = process.env.WORKER_ID; ({
      id: process.env.WORKER_ID,
      isNew: !globalThis.__id__,
      pastId: globalThis.__id__ || (globalThis.__id__ = id)
    })`);
    same(id, 1);
    same(isNew, i === 0);
    same(pastId, id);
  }
});

test('Same WORKER_ID for tasks run on same thread', async ({ same }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    workerIdEnv: true,
    minThreads: 2,
    maxThreads: 2
  });

  const ids = new Set();
  await Promise.all([0, 1, 2, 3, 4, 5, 6, 7].map(async (i) => {
    const { id, isNew, pastId } = await pool.runTask(`const id = process.env.WORKER_ID; ({
      id: process.env.WORKER_ID,
      isNew: !globalThis.__id__,
      pastId: globalThis.__id__ || (globalThis.__id__ = id)
    })`);
    ids.add(id);
    same(id, pastId);
    same(isNew, i < 2);
  }));
  same([...ids].sort(), [1, 2]);
});
