---
id: Methods
sidebar_position: 3
---
## Method: `run(task[, options])`

Schedules a task to be run on a Worker thread.

* `task`: Any value. This will be passed to the function that is exported from
  `filename`.
* `options`:
  * `transferList`: An optional lists of objects that is passed to
    [`postMessage()`] when posting `task` to the Worker, which are transferred
    rather than cloned.
  * `filename`: Optionally overrides the `filename` option passed to the
    constructor for this task. If no `filename` was specified to the constructor,
    this is mandatory.
  * `name`: Optionally overrides the exported worker function used for the task.
  * `abortSignal`: An `AbortSignal` instance. If passed, this can be used to
    cancel a task. If the task is already running, the corresponding `Worker`
    thread will be stopped.
    (More generally, any `EventEmitter` or `EventTarget` that emits `'abort'`
    events can be passed here.) Abortable tasks cannot share threads regardless
    of the `concurrentTasksPerWorker` options.

This returns a `Promise` for the return value of the (async) function call
made to the function exported from `filename`. If the (async) function throws
an error, the returned `Promise` will be rejected with that error.
If the task is aborted, the returned `Promise` is rejected with an error
as well.

## Method: `runTask(task[, transferList][, filename][, abortSignal])`

**Deprecated** -- Use `run(task, options)` instead.

Schedules a task to be run on a Worker thread.

* `task`: Any value. This will be passed to the function that is exported from
  `filename`.
* `transferList`: An optional lists of objects that is passed to
  [`postMessage()`] when posting `task` to the Worker, which are transferred
  rather than cloned.
* `filename`: Optionally overrides the `filename` option passed to the
  constructor for this task. If no `filename` was specified to the constructor,
  this is mandatory.
* `signal`: An [`AbortSignal`][] instance. If passed, this can be used to
  cancel a task. If the task is already running, the corresponding `Worker`
  thread will be stopped.
  (More generally, any `EventEmitter` or `EventTarget` that emits `'abort'`
  events can be passed here.) Abortable tasks cannot share threads regardless
  of the `concurrentTasksPerWorker` options.

This returns a `Promise` for the return value of the (async) function call
made to the function exported from `filename`. If the (async) function throws
an error, the returned `Promise` will be rejected with that error.
If the task is aborted, the returned `Promise` is rejected with an error
as well.

## Method: `destroy()`

Stops all Workers and rejects all `Promise`s for pending tasks.

This returns a `Promise` that is fulfilled once all threads have stopped.

## Method: `close([options])`

* `options`:
  * `force`: A `boolean` value that indicates whether to abort all tasks that
  are enqueued but not started yet. The default is `false`.

It stops all Workers gracefully.

This returns a `Promise` that is fulfilled once all tasks that were started
have completed and all threads have stopped.

This method is similar to `destroy()`, but with the difference that `close()`
will wait for the worker tasks to finish, while `destroy()`
will abort them immediately.