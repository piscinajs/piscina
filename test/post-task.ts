import { MessageChannel } from 'worker_threads';
import Piscina from '..';
import { test } from 'tap';
import { resolve } from 'path';
import { cpus, platform } from 'os';

test('postTask() can transfer ArrayBuffer instances', async ({ is }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread.ts')
  });

  const ab = new ArrayBuffer(40);
  await pool.runTask({ ab }, [ab]);
  is(pool.completed, 1);
  is(ab.byteLength, 0);
});

test('postTask() cannot clone build-in objects', async ({ rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread.ts')
  });

  const obj = new MessageChannel().port1;
  rejects(pool.runTask({ obj }));
});

test('postTask() resolves with a rejection when the handler rejects', async ({ rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  rejects(pool.runTask('Promise.reject(new Error("foo"))'), /foo/);
});

test('postTask() resolves with a rejection when the handler throws', async ({ rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  rejects(pool.runTask('throw new Error("foo")'), /foo/);
});

test('postTask() validates transferList', async ({ rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  rejects(pool.runTask('0', 42 as any),
    /transferList argument must be an Array/);
});

test('postTask() validates filename', async ({ rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  rejects(pool.runTask('0', [], 42 as any),
    /filename argument must be a string/);
});

test('postTask() validates abortSignal', async ({ rejects }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  rejects(pool.runTask('0', [], undefined, 42 as any),
    /abortSignal argument must be an object/);
});

test('Piscina emits drain', async ({ ok }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  let drained = false;
  pool.on('drain', () => {
    drained = true;
  });

  await Promise.all([pool.runTask('123'), pool.runTask('123')]);

  ok(drained);
});

test('Piscina can use async loaded workers', async ({ is }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval-async.js')
  });
  is(await pool.runTask('1'), 1);
});

test('Piscina can use async loaded esm workers', {
  skip: process.version.startsWith('v12.') // ESM support is flagged on v12.x
}, async ({ is }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/esm-async.mjs')
  });
  is(await pool.runTask('1'), 1);
});

test('Using cpuLoadAvgThreshold works as expected', {
  skip: platform() === 'win32' // os.loadavg() is always 0 on Windows
}, async ({ is }) => {
  const pool = new Piscina({
    cpuLoadAvgThreshold: 0.90,
    filename: resolve(__dirname, 'fixtures/eval.js')
  });

  // This is imperfect because the cpu loadavg is difficult
  // to reliably mock. What we want to ensure is that the
  // test still finishes even with a load threshold -- it
  // just might take longer to finish than it overwise would.
  const taskCount = cpus().length * 1.5;
  const tasks = new Array(taskCount);
  for (let n = 0; n < taskCount; n++) {
    tasks[n] = pool.runTask(`for (let n = 0; n < 1e6; n++) {}; ${n}`);
  }

  const res = await Promise.all(tasks);

  for (let n = 0; n < taskCount; n++) {
    is(res[n], n);
  }
});
