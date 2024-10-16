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

Similar to [`Piscina#needsDrain`](https://github.com/piscinajs/piscina#property-needsdrain-readonly);
this event is triggered once the total capacity of the pool is exceeded
by number of tasks enqueued that are pending of execution.

## Event: `'message'`

A `'message'` event is emitted whenever a message is received from a worker thread.

## Event: `'workerCreate'`

Event that is triggered when a new worker is created.

As argument, it receives the worker instance.

## Event: `'workerDestroy'`

Event that is triggered when a worker is destroyed.

As argument, it receives the worker instance that has been destroyed.