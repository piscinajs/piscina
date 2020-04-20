# piscina - the node.js worker pool

* ✔ Fast communication between threads
* ✔ Covers both fixed-task and variable-task scenarios
* ✔ Supports flexible pool sizes
* ✔ Proper async tracking integration

## Piscina API

### Example

In `main.js`:

```js
const Piscina = require('piscina');

const piscina = new Piscina({
  fileName: path.resolve(__dirname, 'worker.js');
});

(async function() {
  const result = await piscina.runTask({ a: 4, b: 6 });
  console.log(result);  // Prints 10
})();
```

In `worker.js`:

```js
module.exports = ({ a, b }) => {
  return a + b;
};
```

## Class: `Piscina`

### Constructor: `new Piscina([options])`

* The following options are supported. All options are optional.
  * `fileName`: (`string | null`) Provides the default source for the code that
    runs the tasks on Worker threads. This should be an absolute path to a file
    that exports a JavaScript `function` or `async function` as its default
    export or `module.exports`.
  * `minThreads`: (`number`) Sets the minimum number of threads that are always
    running for this thread pool. The default is based on the number of
    available CPUs.
  * `maxThreads`: (`number`) Sets the maximum number of threads that are
    running for this thread pool. The default is based on the number of
    available CPUs.
  * `idleTimeout`: (`number`) A timeout in milliseconds that specifies how long
    a `Worker` is allowed to be idle, i.e. not handling any tasks, before it is
    shut down. By default, this is immediate.
  * `maxQueue`: (`number`) The maximum number of tasks that may be scheduled
    to run, but not yet running due to lack of available threads, at a given
    time. By default, there is no limit.
  * `concurrentTasksPerWorker`: (`number`) Specifies how many tasks can share
    a single Worker thread simultaneously. The default is `1`. This generally
    only makes sense to specify if there is some kind of asynchronous component
    to the task. Keep in mind that Worker threads are generally not built for
    handling I/O in parallel.
  * `useAtomics`: (`boolean`) Use the [`Atomics`][] API for faster communication
    between threads. This is on by default.

### Method: `runTask(task[, fileName])`

Schedules a task to be run on a Worker thread.

* `task`: Any value. This will be passed to the function that is exported from
  `fileName`.
* `fileName`: Optionally overrides the `fileName` option passed to the
  constructor for this task. If no `fileName` was specified to the constructor,
  this is mandatory.

This returns a `Promise` for the return value of the (async) function call
made to the function exported from `fileName`.

### Method: `destroy()`

Stops all Workers and rejects all `Promise`s for pending tasks.

This returns a `Promise` that is fulfilled once all threads have stopped.

### Property: `options` (readonly)

A copy of the options that are currently being used by this instance. This
object has the same properties as the options object passed to the constructor.

### Property: `threads` (readonly)

An Array of the `Worker` instances used by this pool.

### Property: `queueSize` (readonly)

The current number of tasks waiting to be assigned to a Worker thread.

### Static property: `isWorkerThread` (readonly)

Is `true` if this code runs inside a `Piscina` threadpool as a Worker.

### Static property: `version` (readonly)

Provides the current version of this library as a semver string.

## The Team

* James M Snell <piscina@jasnell.me>
* Anna Henningsen <anna@addaleax.net>

[`Atomics`]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics
