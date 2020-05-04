# piscina - the node.js worker pool

![CI](https://github.com/jasnell/piscina/workflows/CI/badge.svg)

* ✔ Fast communication between threads
* ✔ Covers both fixed-task and variable-task scenarios
* ✔ Supports flexible pool sizes
* ✔ Proper async tracking integration
* ✔ Tracking statistics for run and wait times
* ✔ Cancelation Support
* ✔ Supports enforcing memory resource limits
* ✔ Supports CommonJS and ESM

Written in TypeScript.

For Node.js 12.x and higher.

[MIT Licensed][].

## Piscina API

### Example

In `main.js`:

```js
const Piscina = require('piscina');

const piscina = new Piscina({
  filename: path.resolve(__dirname, 'worker.js')
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

The worker may also be an async function or may return a Promise:

```js
const { promisify } = require('util');
const sleep = promisify(setTimeout);

module.exports = async ({ a, b } => {
  // Fake some async activity
  await sleep(100);
  return a + b;
})
```

ESM is also supported for both Piscina and workers:

```js
import { Piscina } from 'piscina';

const piscina = new Piscina({
  // The URL must be a file:// URL
  filename: new URL('./worker.mjs', import.meta.url).href
});

(async function () {
  const result = await piscina.runTask({ a: 4, b: 6 });
  console.log(result); // Prints 10
})();
```

In `worker.mjs`:

```js
export default ({ a, b }) => {
  return a + b;
};
```

### Cancelable Tasks

Submitted tasks may be canceled using either an `AbortController` or
an `EventEmitter`:

```js
'use strict';

const Piscina = require('piscina');
const { AbortController } = require('abort-controller');
const { resolve } = require('path');

const piscina = new Piscina({
  filename: resolve(__dirname, 'worker.js')
});

(async function() {
  const abortController = new AbortController();
  try {
    const task = piscina.runTask({ a: 4, b: 6 }, abortController.signal);
    abortController.abort();
    await task;
  } catch (err) {
    console.log('The task was canceled');
  }
})();
```

To use `AbortController`, you will need to `npm i abort-controller`
(or `yarn add abort-controller`).

Alternatively, any `EventEmitter` that emits an `'abort'` event
may be used as an abort controller:

```js
'use strict';

const Piscina = require('piscina');
const EventEmitter = require('events');
const { resolve } = require('path');

const piscina = new Piscina({
  filename: resolve(__dirname, 'worker.js')
});

(async function() {
  const ee = new EventEmitter();
  try {
    const task = piscina.runTask({ a: 4, b: 6 }, ee);
    ee.emit('abort');
    await task;
  } catch (err) {
    console.log('The task was canceled');
  }
})();
```

## Class: `Piscina`

Piscina works by creating a pool of Node.js Worker Threads to which
one or more tasks may be dispatched. Each worker thread executes a
single exported function defined in a separate file. Whenever a
task is dispatched to a worker, the worker invokes the exported
function and reports the return value back to Piscina when the
function completes.

This class extends [`EventEmitter`][] from Node.js.

### Constructor: `new Piscina([options])`

* The following optional configuration is supported:
  * `filename`: (`string | null`) Provides the default source for the code that
    runs the tasks on Worker threads. This should be an absolute path or an
    absolute `file://` URL to a file that exports a JavaScript `function` or
    `async function` as its default export or `module.exports`. [ES modules][]
    are supported.
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
  * `resourceLimits`: (`object`) See [Node.js new Worker options][]
    * `maxOldGenerationSizeMb`: (`number`) The maximum size of each worker threads
      main heap in MB.
    * `maxYoungGenerationSizeMb`: (`number`) The maximum size of a heap space for
      recently created objects.
    * `codeRangeSizeMb`: (`number`) The size of a pre-allocated memory range used
      for generated code.
  * `env`: (`object`) If set, specifies the initial value of `process.env` inside
    the worker threads. See [Node.js new Worker options][] for details.
  * `argv`: (`any[]`) List of arguments that will be stringified and appended to
    `process.argv` in the worker. See [Node.js new Worker options][] for details.
  * `execArgv`: (`string[]`) List of Node.js CLI options passed to the worker.
    See [Node.js new Worker options][] for details.
  * `workerData`: (`any`) Any JavaScript value that can be cloned and made
    available as `require('piscina').workerData`. See [Node.js new Worker options][]
    for details. Unlike regular Node.js Worker Threads, `workerData` must not
    specify any value requiring a `transferList`. This is because the `workerData`
    will be cloned for each pooled worker.

Use caution when setting resource limits. Setting limits that are too low may
result in the `Piscina` worker threads being unusable.

### Method: `runTask(task[, transferList][, filename][, abortSignal])`

Schedules a task to be run on a Worker thread.

* `task`: Any value. This will be passed to the function that is exported from
  `filename`.
* `transferList`: An optional lists of objects that is passed to
  [`postMessage()`] when posting `task` to the Worker, which are transferred
  rather than cloned.
* `filename`: Optionally overrides the `filename` option passed to the
  constructor for this task. If no `filename` was specified to the constructor,
  this is mandatory.
* `abortSignal`: An [`AbortSignal`][] instance. If passed, this can be used to
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

### Method: `destroy()`

Stops all Workers and rejects all `Promise`s for pending tasks.

This returns a `Promise` that is fulfilled once all threads have stopped.

### Event: `'error'`

An `'error'` event is emitted by instances of this class when:

- Uncaught exceptions occur inside Worker threads that do not currently handle
  tasks.
- Unexpected messages are sent from from Worker threads.

All other errors are reported by rejecting the `Promise` returned from
`runTask()`, including rejections reported by the handler function itself.

### Property: `completed` (readonly)

The current number of completed tasks.

### Property: `options` (readonly)

A copy of the options that are currently being used by this instance. This
object has the same properties as the options object passed to the constructor.

### Property: `runTime` (readonly)

A histogram summary object summarizing the collected run times of completed
tasks. All values are expressed in milliseconds.

* `runTime.average` {`number`} The average run time of all tasks
* `runTime.mean` {`number`} The mean run time of all tasks
* `runTime.stddev` {`number`} The standard deviation of collected run times
* `runTime.min` {`number`} The fastest recorded run time
* `runTime.max` {`number`} The slowest recorded run time

All properties following the pattern `p{N}` where N is a number (e.g. `p1`, `p99`)
represent the percentile distributions of run time observations. For example,
`p99` is the 99th percentile indicating that 99% of the observed run times were
faster or equal to the given value.

```js
{
  average: 1880.25,
  mean: 1880.25,
  stddev: 1.93,
  min: 1877,
  max: 1882.0190887451172,
  p0_001: 1877,
  p0_01: 1877,
  p0_1: 1877,
  p1: 1877,
  p2_5: 1877,
  p10: 1877,
  p25: 1877,
  p50: 1881,
  p75: 1881,
  p90: 1882,
  p97_5: 1882,
  p99: 1882,
  p99_9: 1882,
  p99_99: 1882,
  p99_999: 1882
}
```

### Property: `threads` (readonly)

An Array of the `Worker` instances used by this pool.

### Property: `queueSize` (readonly)

The current number of tasks waiting to be assigned to a Worker thread.

### Property: `waitTime` (readonly)

A histogram summary object summarizing the collected times tasks spent
waiting in the queue. All values are expressed in milliseconds.

* `waitTime.average` {`number`} The average wait time of all tasks
* `waitTime.mean` {`number`} The mean wait time of all tasks
* `waitTime.stddev` {`number`} The standard deviation of collected wait times
* `waitTime.min` {`number`} The fastest recorded wait time
* `waitTime.max` {`number`} The longest recorded wait time

All properties following the pattern `p{N}` where N is a number (e.g. `p1`, `p99`)
represent the percentile distributions of wait time observations. For example,
`p99` is the 99th percentile indicating that 99% of the observed wait times were
faster or equal to the given value.

```js
{
  average: 1880.25,
  mean: 1880.25,
  stddev: 1.93,
  min: 1877,
  max: 1882.0190887451172,
  p0_001: 1877,
  p0_01: 1877,
  p0_1: 1877,
  p1: 1877,
  p2_5: 1877,
  p10: 1877,
  p25: 1877,
  p50: 1881,
  p75: 1881,
  p90: 1882,
  p97_5: 1882,
  p99: 1882,
  p99_9: 1882,
  p99_99: 1882,
  p99_999: 1882
}
```

### Static property: `isWorkerThread` (readonly)

Is `true` if this code runs inside a `Piscina` threadpool as a Worker.

### Static property: `version` (readonly)

Provides the current version of this library as a semver string.

## Current Limitations (Things we're working on / would love help with)

* Improved Documentation
* More examples
* Benchmarks

## Performance Notes

Workers are generally optimized for offloading synchronous,
compute-intensive operations off the main Node.js event loop thread.
While it is possible to perform asynchronous operations and I/O
within a Worker, the performance advantages of doing so will be
minimal.

Specifically, it is worth noting that asynchronous operations
within Node.js, including I/O such as file system operations
or CPU-bound tasks such as crypto operations or compression
algorithms, are already performed in parallel by Node.js and
libuv on a per-process level. This means that there will be
little performance impact on moving such async operations into
a Piscina worker (see examples/scrypt for example).

## Release Notes

### 1.2.0

* Added support for ESM and file:// URLs
* Added `env`, `argv`, `execArgv`, and `workerData` options
* More examples

### 1.1.0

* Added support for Worker Thread `resourceLimits`

### 1.0.0

* Initial release!

## The Team

* James M Snell <jasnell@gmail.com>
* Anna Henningsen <anna@addaleax.net>
* Matteo Collina <matteo.collina@gmail.com>

## Acknowledgements

Piscina development is sponsored by [NearForm Research][].

[`Atomics`]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics
[`EventEmitter`]: https://nodejs.org/api/events.html
[`postMessage`]: https://nodejs.org/api/worker_threads.html#worker_threads_port_postmessage_value_transferlist
[ES modules]: https://nodejs.org/api/esm.html
[Node.js new Worker options]: https://nodejs.org/api/worker_threads.html#worker_threads_new_worker_filename_options
[MIT Licensed]: LICENSE.md
[NearForm Research]: https://www.nearform.com/research/
