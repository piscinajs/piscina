import * as assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { subscribe, unsubscribe } from 'node:diagnostics_channel';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import Piscina, {
  PiscinaTaskSubmitMessage,
  PiscinaTaskStartMessage,
  PiscinaTaskDoneMessage,
  PiscinaNewWorkerMessage,
  PiscinaEvictWorkerMessage,
  PiscinaDrainMessage
} from '..';

const evalFile = resolve(__dirname, 'fixtures/eval.js');

// Channels are process-wide, so keep only the messages from the pool under test.
function record<T extends { pool: Piscina }> (
  t: TestContext,
  name: string,
  getPool: () => Piscina | undefined
): T[] {
  const messages: T[] = [];
  function onMessage (message: unknown) {
    if ((message as T).pool === getPool()) messages.push(message as T);
  }
  subscribe(name, onMessage);
  t.after(() => unsubscribe(name, onMessage));
  return messages;
}

// Records task events in publish order, with the async context each one saw.
function recordTaskEvents (t: TestContext, pool: Piscina, als?: AsyncLocalStorage<string>) {
  const events: { name: string, taskId: string, store: string | undefined }[] = [];
  for (const name of ['submit', 'start', 'done']) {
    const onMessage = (message: unknown) => {
      const { pool: source, task } = message as PiscinaTaskStartMessage;
      if (source === pool) events.push({ name, taskId: task.taskId, store: als?.getStore() });
    };
    subscribe(`piscina:task:${name}`, onMessage);
    t.after(() => unsubscribe(`piscina:task:${name}`, onMessage));
  }
  return events;
}

function idsAndReasons (evictions: PiscinaEvictWorkerMessage[]) {
  return evictions.map(({ worker, reason }) => ({ id: worker.id, reason }));
}

function doneFor (dones: PiscinaTaskDoneMessage[], submit: PiscinaTaskSubmitMessage) {
  return dones.filter(done => done.task.taskId === submit.task.taskId);
}

test('publishes submit, start and done for a task that runs right away', async (t: TestContext) => {
  const pool = new Piscina({ filename: evalFile, maxThreads: 1 });
  await pool.run('0');
  const submits = record<PiscinaTaskSubmitMessage>(t, 'piscina:task:submit', () => pool);
  const starts = record<PiscinaTaskStartMessage>(t, 'piscina:task:start', () => pool);
  const dones = record<PiscinaTaskDoneMessage>(t, 'piscina:task:done', () => pool);
  const events = recordTaskEvents(t, pool);

  assert.strictEqual(await pool.run('42'), 42);

  assert.deepStrictEqual(events.map(e => e.name), ['submit', 'start', 'done']);
  assert.strictEqual(starts[0].worker.id, pool.threads[0].threadId);
  assert.strictEqual(starts[0].workerReady, true);
  assert.strictEqual(submits.length, 1);
  const [done, ...rest] = doneFor(dones, submits[0]);
  assert.strictEqual(rest.length, 0);
  assert.strictEqual(done.queued, false);
  assert.strictEqual(done.started, true);
  assert.strictEqual(done.aborted, false);
  assert.strictEqual(done.error, null);
  assert.strictEqual(typeof done.waitTime, 'number');
  assert.strictEqual(typeof done.runTime, 'number');
  await pool.destroy();
});

test('reports the wait of a task queued behind a busy worker', async (t: TestContext) => {
  const pool = new Piscina({ filename: evalFile, maxThreads: 1 });
  await pool.run('0');
  const submits = record<PiscinaTaskSubmitMessage>(t, 'piscina:task:submit', () => pool);
  const dones = record<PiscinaTaskDoneMessage>(t, 'piscina:task:done', () => pool);

  await Promise.all([
    pool.run('new Promise(resolve => setTimeout(resolve, 200))'),
    pool.run('42')
  ]);

  const [first] = doneFor(dones, submits[0]);
  const [second] = doneFor(dones, submits[1]);
  assert.strictEqual(first.queued, false);
  assert.strictEqual(second.queued, true);
  assert.ok(second.waitTime! >= 150, `waitTime was ${second.waitTime}`);
  await pool.destroy();
});

test('publishes task events in the async context of the run() caller', async (t: TestContext) => {
  const pool = new Piscina({ filename: evalFile, maxThreads: 1 });
  await pool.run('0');
  const als = new AsyncLocalStorage<string>();
  const events = recordTaskEvents(t, pool, als);

  // B starts from A's completion, and another caller aborts C while it is
  // queued; each must still see the context of its own run() call.
  const ee = new AbortController();
  const tasks = Promise.allSettled([
    als.run('A', () => pool.run('new Promise(resolve => setTimeout(resolve, 100))')),
    als.run('B', () => pool.run('42')),
    als.run('C', () => pool.run('42', { signal: ee.signal }))
  ]);
  als.run('aborter', () => ee.abort());
  await tasks;

  assert.deepStrictEqual(
    events.map(e => `${e.name} ${e.store}`).sort(),
    ['done A', 'done B', 'done C', 'start A', 'start B', 'submit A', 'submit B', 'submit C']);
  await pool.destroy();
});

test('publishes done once for a task aborted while queued', async (t: TestContext) => {
  const pool = new Piscina({ filename: evalFile, maxThreads: 1 });
  await pool.run('0');
  const submits = record<PiscinaTaskSubmitMessage>(t, 'piscina:task:submit', () => pool);
  const starts = record<PiscinaTaskStartMessage>(t, 'piscina:task:start', () => pool);
  const dones = record<PiscinaTaskDoneMessage>(t, 'piscina:task:done', () => pool);

  const first = pool.run('new Promise(resolve => setTimeout(resolve, 1000))').catch(() => {});
  const ee = new AbortController();
  const aborted = assert.rejects(pool.run('42', { signal: ee.signal }), /The task has been aborted/);
  ee.abort();
  await aborted;

  const [done] = doneFor(dones, submits[1]);
  assert.deepStrictEqual(starts.map(s => s.task.taskId), [submits[0].task.taskId]);
  assert.strictEqual(done.started, false);
  assert.strictEqual(done.aborted, true);
  assert.strictEqual(done.waitTime, null);
  assert.strictEqual(done.runTime, null);
  assert.match((done.error as Error).message, /The task has been aborted/);

  // An aborted task can stay in the skipQueue until destroy() flushes it; it
  // must still be reported only once.
  await pool.destroy();
  await first;
  assert.strictEqual(doneFor(dones, submits[1]).length, 1);
});

test('reports an abort while running once, as an abort eviction', async (t: TestContext) => {
  const pool = new Piscina({ filename: evalFile, maxThreads: 1 });
  await pool.run('0');
  const dones = record<PiscinaTaskDoneMessage>(t, 'piscina:task:done', () => pool);
  const evictions = record<PiscinaEvictWorkerMessage>(t, 'piscina:pool:evict_worker', () => pool);

  const [thread] = pool.threads;
  const threadId = thread.threadId;
  const exited = once(thread, 'exit');
  const ee = new AbortController();
  const aborted = assert.rejects(
    pool.run('new Promise(resolve => setTimeout(resolve, 1000))', { signal: ee.signal }),
    /The task has been aborted/);
  ee.abort();
  await aborted;
  await exited;

  assert.deepStrictEqual(idsAndReasons(evictions), [{ id: threadId, reason: 'abort' }]);
  assert.strictEqual(dones.length, 1);
  assert.strictEqual(dones[0].started, true);
  assert.strictEqual(dones[0].aborted, true);
  await pool.destroy();
});

test('publishes submit and done for a task rejected by the queue limit', async (t: TestContext) => {
  const pool = new Piscina({ filename: evalFile, maxThreads: 1, maxQueue: 1 });
  await pool.run('0');
  const submits = record<PiscinaTaskSubmitMessage>(t, 'piscina:task:submit', () => pool);
  const dones = record<PiscinaTaskDoneMessage>(t, 'piscina:task:done', () => pool);

  const running = Promise.allSettled([
    pool.run('new Promise(resolve => setTimeout(resolve, 1000))'),
    pool.run('42')
  ]);
  await assert.rejects(pool.run('42'), /Task queue is at limit/);

  assert.strictEqual(submits.length, 3);
  const [done] = doneFor(dones, submits[2]);
  assert.strictEqual(done.started, false);
  assert.strictEqual(done.queued, false);
  assert.match((done.error as Error).message, /Task queue is at limit/);

  await pool.destroy();
  await running;
});

test('publishes done for every task flushed by destroy()', async (t: TestContext) => {
  const pool = new Piscina({ filename: evalFile, maxThreads: 1 });
  await pool.run('0');
  const submits = record<PiscinaTaskSubmitMessage>(t, 'piscina:task:submit', () => pool);
  const dones = record<PiscinaTaskDoneMessage>(t, 'piscina:task:done', () => pool);
  const evictions = record<PiscinaEvictWorkerMessage>(t, 'piscina:pool:evict_worker', () => pool);

  const tasks = Promise.allSettled([
    pool.run('new Promise(resolve => setTimeout(resolve, 1000))'),
    pool.run('42'),
    pool.run('42')
  ]);
  await pool.destroy();
  await tasks;

  for (const submit of submits) {
    assert.strictEqual(doneFor(dones, submit).length, 1);
  }
  assert.deepStrictEqual(evictions.map(e => e.reason), ['destroy']);
});

test('reports a crashed worker as an error eviction', async (t: TestContext) => {
  const pool = new Piscina({ filename: evalFile, maxThreads: 1 });
  await pool.run('0');
  const dones = record<PiscinaTaskDoneMessage>(t, 'piscina:task:done', () => pool);
  const evictions = record<PiscinaEvictWorkerMessage>(t, 'piscina:pool:evict_worker', () => pool);
  const [thread] = pool.threads;
  const threadId = thread.threadId;

  await assert.rejects(pool.run('process.exit(1)'), /worker exited with code: 1/);

  // The thread has exited by the time this eviction is published.
  assert.deepStrictEqual(idsAndReasons(evictions), [{ id: threadId, reason: 'error' }]);
  assert.strictEqual(dones.length, 1);
  assert.match((dones[0].error as Error).message, /worker exited with code: 1/);
  await pool.destroy();
});

test('reports a task that could not be sent to a worker as not started', async (t: TestContext) => {
  const pool = new Piscina({ filename: evalFile, maxThreads: 1 });
  await pool.run('0');
  const starts = record<PiscinaTaskStartMessage>(t, 'piscina:task:start', () => pool);
  const dones = record<PiscinaTaskDoneMessage>(t, 'piscina:task:done', () => pool);

  await assert.rejects(pool.run(() => {}), { name: 'DataCloneError' });

  assert.strictEqual(starts.length, 0);
  assert.strictEqual(dones.length, 1);
  assert.strictEqual(dones[0].started, false);
  assert.strictEqual(dones[0].waitTime, null);
  assert.strictEqual(dones[0].runTime, null);
  await pool.destroy();
});

test('reports an idle worker removal as an idle eviction', async (t: TestContext) => {
  const pool = new Piscina({ filename: evalFile, minThreads: 0, maxThreads: 1, idleTimeout: 50 });
  const evictions = record<PiscinaEvictWorkerMessage>(t, 'piscina:pool:evict_worker', () => pool);

  await pool.run('42');
  await new Promise(resolve => setTimeout(resolve, 300));

  assert.deepStrictEqual(evictions.map(e => e.reason), ['idle']);
  await pool.destroy();
});

test('publishes new_worker whenever the pool emits workerCreate', async (t: TestContext) => {
  // Subscribe before the pool exists: its first workers are reported right away.
  const newWorkers = record<PiscinaNewWorkerMessage>(t, 'piscina:pool:new_worker', () => pool);
  const pool = new Piscina({ filename: evalFile, minThreads: 1, maxThreads: 2 });
  let created = 0;
  pool.on('workerCreate', () => { created++; });

  await Promise.all([
    pool.run('new Promise(resolve => setTimeout(resolve, 100))'),
    pool.run('new Promise(resolve => setTimeout(resolve, 100))')
  ]);

  assert.strictEqual(created, 2);
  assert.strictEqual(newWorkers.length, created);
  await pool.destroy();
});

test('publishes drain whenever the pool emits drain', async (t: TestContext) => {
  const pool = new Piscina({ filename: evalFile, maxQueue: 3, maxThreads: 1 });
  const drains = record<PiscinaDrainMessage>(t, 'piscina:pool:drain', () => pool);
  let drained = 0;
  pool.on('drain', () => { drained++; });

  await Promise.all([pool.run('123'), pool.run('123'), pool.run('123'), pool.run('123')]);
  await new Promise(resolve => setImmediate(resolve));

  assert.ok(drained > 0);
  assert.strictEqual(drains.length, drained);
  await pool.destroy();
});

test('reports wait and run time when recordTiming is false', async (t: TestContext) => {
  const pool = new Piscina({ filename: evalFile, maxThreads: 1, recordTiming: false });
  const dones = record<PiscinaTaskDoneMessage>(t, 'piscina:task:done', () => pool);

  await pool.run('42');

  assert.strictEqual(typeof dones[0].waitTime, 'number');
  assert.strictEqual(typeof dones[0].runTime, 'number');
  await pool.destroy();
});

test('a done subscriber that aborts the finished task does not affect the next task', async (t: TestContext) => {
  const pool = new Piscina({ filename: evalFile, maxThreads: 1 });
  await pool.run('0');
  const ee = new AbortController();
  const onDone = (message: unknown) => {
    const { pool: source, task } = message as PiscinaTaskDoneMessage;
    if (source === pool && task.isAbortable) ee.abort();
  };
  subscribe('piscina:task:done', onDone);
  t.after(() => unsubscribe('piscina:task:done', onDone));

  // The 2nd task is queued and takes the worker before the 1st one's done
  // message is published.
  const first = pool.run('new Promise(resolve => setTimeout(resolve, 50))', { signal: ee.signal });
  const second = pool.run('42');

  assert.strictEqual(await second, 42);
  await first;
  await pool.destroy();
});

test('publishes done once to a subscriber that joins after submit', async (t: TestContext) => {
  const pool = new Piscina({ filename: evalFile, maxThreads: 1 });
  const task = pool.run('new Promise(resolve => setTimeout(resolve, 100))');
  const dones = record<PiscinaTaskDoneMessage>(t, 'piscina:task:done', () => pool);

  await task;

  assert.strictEqual(dones.length, 1);
  await pool.destroy();
});

test('counts the boot time of a worker in the wait of a task handed to it', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/slow-boot.js'),
    minThreads: 1,
    maxThreads: 2
  });
  await pool.run('0');
  const starts = record<PiscinaTaskStartMessage>(t, 'piscina:task:start', () => pool);
  const dones = record<PiscinaTaskDoneMessage>(t, 'piscina:task:done', () => pool);

  // The 2nd task starts a 2nd worker. When the 1st task finishes, the 1st
  // worker takes one of the queued tasks and the other is handed to the
  // still-booting worker.
  await Promise.all([
    pool.run('new Promise(resolve => setTimeout(resolve, 50))'),
    pool.run('1'),
    pool.run('2')
  ]);

  const booting = starts.filter(s => !s.workerReady);
  assert.strictEqual(booting.length, 1);
  const [done] = dones.filter(d => d.task.taskId === booting[0].task.taskId);
  assert.ok(done.waitTime! >= 200, `waitTime was ${done.waitTime}`);
  await pool.destroy();
});

test('counts worker boot time as wait even when the main thread is busy', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/slow-boot.js'),
    minThreads: 1,
    maxThreads: 1
  });
  const starts = record<PiscinaTaskStartMessage>(t, 'piscina:task:start', () => pool);
  const dones = record<PiscinaTaskDoneMessage>(t, 'piscina:task:done', () => pool);

  // Block the main thread past the ~300 ms boot, so the task's response and
  // the worker's READY message are both waiting when it resumes.
  const task = pool.run('42');
  const stallUntil = Date.now() + 650;
  while (Date.now() < stallUntil);
  await task;
  // The response is handled first, so READY may still be queued here.
  await pool.run('1');

  assert.ok(dones[0].waitTime! >= 250, `waitTime was ${dones[0].waitTime}`);
  assert.strictEqual(starts[1].workerReady, true);
  await pool.destroy();
});
