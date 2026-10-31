---
id: Events
sidebar_position: 4
---

## Event: `'error'`

An `'error'` event is emitted by instances of this class when:

- Uncaught exceptions occur inside Worker threads that do not currently handle
  tasks.
- Unexpected messages are sent from from Worker threads.

All other errors are reported by rejecting the `Promise` returned from
`run()` or `runTask()`, including rejections reported by the handler function
itself.

## Event: `'drain'`

A `'drain'` event is emitted whenever the `queueSize` reaches `0`.

## Event: `'needsDrain'`

Similar to [`Piscina#needsDrain`](https://github.com/piscinajs/piscina#property-needsdrain-readonly).

## Event: `'message'`

A `'message'` event is emitted whenever a message is received from a worker thread.

## Event: `'workerCreate'`

Event that is triggered when a new worker is created.

As argument, it receives the worker instance.

## Event: `'workerDestroy'`

Event that is triggered when a worker is destroyed.

As argument, it receives the worker instance that has been destroyed.

## Diagnostics channels

Piscina also publishes task and pool events on
[`node:diagnostics_channel`](https://nodejs.org/api/diagnostics_channel.html).
Messages are only built while a channel has subscribers, so an unused channel
costs a single check. Channels are shared by every pool in the process: use
`message.pool` to tell pools apart. To label metrics per pool, map each pool
to a name, for example with a `WeakMap`.

| Channel | Published when | Message |
| --- | --- | --- |
| `piscina:task:submit` | `run()` creates a task, including one it then rejects because the queue is full or unavailable | `pool`, `task`, `queueSize` |
| `piscina:task:start` | A task is sent to a worker | `pool`, `task`, `worker`, `workerReady` |
| `piscina:task:done` | A submitted task settles, however it ends (completed, failed, aborted, rejected by the queue limit, or flushed by `destroy()`/`close()`) | `pool`, `task`, `queued`, `started`, `waitTime`, `runTime`, `error`, `aborted`, `queueSize`, `idleThreads` |
| `piscina:pool:new_worker` | Alongside the `'workerCreate'` event | `pool`, `worker` |
| `piscina:pool:evict_worker` | Alongside the `'workerDestroy'` event | `pool`, `worker`, `reason` |
| `piscina:pool:drain` | Alongside the `'drain'` event | `pool` |

Every `piscina:task:submit` is followed by exactly one `piscina:task:done` for
the same `task.taskId`, with at most one `piscina:task:start` between them.
Task events are published in the async context of the `run()` call, so a
subscriber can read the caller's `AsyncLocalStorage` stores.

- `task` is a [`PiscinaTask`](./class.md#interface-piscinatask) and `worker` a
  [`PiscinaWorker`](./class.md#interface-piscinaworker). `worker.id` keeps
  the thread ID after the thread exits; the other `worker` fields are live.
- `queued`: whether the task waited in the queue because no worker could take
  it when it was submitted.
- `started`: whether the task was sent to a worker, i.e. whether
  `piscina:task:start` was published for it.
- `workerReady`: whether the worker had finished starting up when the task was
  sent. If not, the task waits for it, and that wait counts in the task's
  `waitTime`.
- `waitTime` and `runTime` (milliseconds) are `null` when the task never
  started. The wait ends when the worker reports that it began the task, so it
  includes the time a new worker spent starting up. A task that never reports
  back (aborted while running, or its worker crashed), or that was sent before
  any `piscina:task:done` subscriber existed, ends its wait when it was sent,
  or when its worker became ready if that was later. These values
  are reported even when `recordTiming` is `false`, and can differ from
  `histogram.waitTime` and `histogram.runTime`, which end the wait when the
  task is sent.
- `error` is the value the task ended with: usually an `Error`, but whatever
  the task threw otherwise; `null` on success. For a task aborted while
  running, it is the worker termination error; check `aborted` to tell aborts
  apart.
- `queueSize` and `idleThreads` are the pool's values when the message is
  published. A finished task's worker takes the next queued task before
  `piscina:task:done` is published, so these values already include it.
- `reason` is one of `'idle'` (removed after `idleTimeout`), `'abort'` (its
  task was aborted), `'error'` (the worker errored or exited), or `'destroy'`
  (`destroy()` or `close()`). A worker that fails while starting up gets
  `piscina:pool:evict_worker` without a `piscina:pool:new_worker`, just as it
  gets `'workerDestroy'` without `'workerCreate'`.
- Whether a task's `piscina:task:done` comes before or after its worker's
  `piscina:pool:evict_worker` depends on how the worker was removed.

As with any `diagnostics_channel` subscriber, an error thrown by a subscriber
is reported as an uncaught exception and does not affect the task.

**Example**: count tasks that had to wait for a free worker.

```js
const { subscribe } = require('node:diagnostics_channel');
const { Piscina } = require('piscina');

const pool = new Piscina({ filename: require.resolve('./worker.js') });

subscribe('piscina:task:done', ({ pool: source, queued, waitTime, task }) => {
  if (source !== pool || !queued) return;
  console.log(`task ${task.taskId} waited ${waitTime ?? 'without starting'} ms`);
});
```
