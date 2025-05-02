![Piscina Logo](https://avatars1.githubusercontent.com/u/65627548?s=200&v=4)

# piscina - the node.js worker pool

![CI](https://github.com/jasnell/piscina/workflows/CI/badge.svg)

* ✔ Fast communication between threads
* ✔ Covers both fixed-task and variable-task scenarios
* ✔ Supports flexible pool sizes
* ✔ Proper async tracking integration
* ✔ Tracking statistics for run and wait times
* ✔ Cancellation Support
* ✔ Supports enforcing memory resource limits
* ✔ Supports CommonJS, ESM, and TypeScript
* ✔ Custom task queues
* ✔ Optional CPU scheduling priorities on Linux

Written in TypeScript.

For Node.js 20.x and higher.

[MIT Licensed][].

## Documentation

- [Website](https://piscinajs.github.io/piscina/)

## Piscina API

### Example

In `main.js`:

```js
const path = require('path');
const Piscina = require('piscina');

const piscina = new Piscina({
  filename: path.resolve(__dirname, 'worker.js')
});

(async function() {
  const result = await piscina.run({ a: 4, b: 6 });
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
const { setTimeout } = require('timers/promises');

module.exports = async ({ a, b }) => {
  // Fake some async activity
  await setTimeout(100);
  return a + b;
};
```

ESM is also supported for both Piscina and workers:

```js
import { Piscina } from 'piscina';

const piscina = new Piscina({
  // The URL must be a file:// URL
  filename: new URL('./worker.mjs', import.meta.url).href
});

const result = await piscina.run({ a: 4, b: 6 });
console.log(result); // Prints 10
```

In `worker.mjs`:

```js
export default ({ a, b }) => {
  return a + b;
};
```

### Exporting multiple worker functions

A single worker file may export multiple named handler functions.

```js
'use strict';

function add({ a, b }) { return a + b; }

function multiply({ a, b }) { return a * b; }

add.add = add;
add.multiply = multiply;

module.exports = add;
```

The export to target can then be specified when the task is submitted:

```js
'use strict';

const Piscina = require('piscina');
const { resolve } = require('path');

const piscina = new Piscina({
  filename: resolve(__dirname, 'worker.js')
});

(async function() {
  const res = await Promise.all([
    piscina.run({ a: 4, b: 6 }, { name: 'add' }),
    piscina.run({ a: 4, b: 6 }, { name: 'multiply' })
  ]);
})();
```

### Cancelable Tasks

Submitted tasks may be canceled using either an `AbortController` or
an `EventEmitter`:

```js
'use strict';

const Piscina = require('piscina');
const { resolve } = require('path');

const piscina = new Piscina({
  filename: resolve(__dirname, 'worker.js')
});

(async function() {
  const abortController = new AbortController();
  try {
    const { signal } = abortController;
    const task = piscina.run({ a: 4, b: 6 }, { signal });
    abortController.abort();
    await task;
  } catch (err) {
    console.log('The task was canceled');
  }
})();
```

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
    const task = piscina.run({ a: 4, b: 6 }, { signal: ee });
    ee.emit('abort');
    await task;
  } catch (err) {
    console.log('The task was canceled');
  }
})();
```

### Delaying Availability of Workers

A worker thread will not be made available to process tasks until Piscina
determines that it is "ready". By default, a worker is ready as soon as
Piscina loads it and acquires a reference to the exported handler function.

There may be times when the availability of a worker may need to be delayed
longer while the worker initializes any resources it may need to operate.
To support this case, the worker module may export a `Promise` that resolves
the handler function as opposed to exporting the function directly:

```js
async function initialize() {
  await someAsyncInitializationActivity();
  return ({ a, b }) => a + b;
}

module.exports = initialize();
```

Piscina will await the resolution of the exported Promise before marking
the worker thread available.

### Backpressure

When the `maxQueue` option is set, once the `Piscina` queue is full, no
additional tasks may be submitted until the queue size falls below the
limit. The `'drain'` event may be used to receive notification when the
queue is empty and all tasks have been submitted to workers for processing.

Example: Using a Node.js stream to feed a Piscina worker pool:

```js
'use strict';

const { resolve } = require('path');
const Pool = require('../..');

const pool = new Pool({
  filename: resolve(__dirname, 'worker.js'),
  maxQueue: 'auto'
});

const stream = getStreamSomehow();
stream.setEncoding('utf8');

pool.on('drain', () => {
  if (stream.isPaused()) {
    console.log('resuming...', counter, pool.queueSize);
    stream.resume();
  }
});

stream
  .on('data', (data) => {
    pool.run(data);
    if (pool.queueSize === pool.options.maxQueue) {
      console.log('pausing...', counter, pool.queueSize);
      stream.pause();
    }
  })
  .on('error', console.error)
  .on('end', () => {
    console.log('done');
  });
```

### Out of scope asynchronous code

A worker thread is **only** active until the moment it returns a result, it can be a result of a synchronous call or a Promise that will be fulfilled/rejected in the future. Once this is done, Piscina will wait for stdout and stderr to be flushed, and then pause the worker's event-loop until the next call. If async code is scheduled without being awaited before returning since Piscina has no way of detecting this, that code execution will be resumed on the next call. Thus, it is highly recommended to properly handle all async tasks before returning a result as it could make your code unpredictable.

For example:

```js
const { setTimeout } = require('timers/promises');

module.exports = ({ a, b }) => {
  // This promise should be awaited
  setTimeout(1000).then(() => {
    console.log('Working'); // This will **not** run during the same worker call
  });
  
  return a + b;
};
```

### Broadcast a message to all worker threads

Piscina supports broadcast communication via BroadcastChannel(Node v18+). Here is an example, the main thread sends a message, and other threads the receive message.

In `main.js`
```js
'use strict';

const { BroadcastChannel } = require('worker_threads');
const { resolve } = require('path');

const Piscina = require('piscina');
const piscina = new Piscina({
  filename: resolve(__dirname, 'worker.js'),
  atomics: 'disabled'
});

async function main () {
  const bc = new BroadcastChannel('my_channel');
  // start worker
  Promise.all([
    piscina.run('thread 1'),
    piscina.run('thread 2')
  ]);
  // post message in one second
  setTimeout(() => {
    bc.postMessage('Main thread message');
  }, 1000);
}

main();

```
In `worker.js`
```js
'use strict';
const { BroadcastChannel } = require('worker_threads');

module.exports = async (thread) => {
  const bc = new BroadcastChannel('my_channel');
  bc.onmessage = (event) => {
    console.log(thread + ' Received from:' + event.data);
  };
  await new Promise((resolve) => {
    setTimeout(resolve, 2000);
  });
};

```

### Additional Examples

Additional examples can be found in the GitHub repo at
https://github.com/piscinajs/piscina/tree/master/examples

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
  * `name`: (`string | null`) Provides the name of the default exported worker
    function. The default is `'default'`, indicating the default export of the
    worker module.
  * `minThreads`: (`number`) Sets the minimum number of threads that are always
    running for this thread pool. The default is the number provided by [`os.availableParallelism`](https://nodejs.org/api/os.html#osavailableparallelism).
  * `maxThreads`: (`number`) Sets the maximum number of threads that are
    running for this thread pool. The default is the number provided by [`os.availableParallelism`](https://nodejs.org/api/os.html#osavailableparallelism) * 1.5.
  * `idleTimeout`: (`number`) A timeout in milliseconds that specifies how long
    a `Worker` is allowed to be idle, i.e. not handling any tasks, before it is
    shut down. By default, this is immediate. If `Infinity` is passed as the value, 
    the `Worker` never shuts down. Be careful when using `Infinity`, 
    as it can lead to resource overuse. **Tip**: *The default `idleTimeout`
    can lead to some performance loss in the application because of the overhead
    involved with stopping and starting new worker threads. To improve performance,
    try setting the `idleTimeout` explicitly.*
  * `maxQueue`: (`number` | `string`) The maximum number of tasks that may be
    scheduled to run, but not yet running due to lack of available threads, at
    a given time. By default, there is no limit. The special value `'auto'`
    may be used to have Piscina calculate the maximum as the square of `maxThreads`.
    When `'auto'` is used, the calculated `maxQueue` value may be found by checking
    the [`options.maxQueue`](#property-options-readonly) property.
  * `concurrentTasksPerWorker`: (`number`) Specifies how many tasks can share
    a single Worker thread simultaneously. The default is `1`. This generally
    only makes sense to specify if there is some kind of asynchronous component
    to the task. Keep in mind that Worker threads are generally not built for
    handling I/O in parallel.
  * `atomics`: (`sync` | `async` | `disabled`) Use the [`Atomics`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics) API for faster communication
    between threads. This is on by default. You can disable `Atomics` globally by
    setting the environment variable `PISCINA_DISABLE_ATOMICS` to `1` .
    If `atomics` is `sync`, it will cause to pause threads (stoping all execution)
    between tasks. Ideally, threads should wait for all operations to finish before
    returning control to the main thread (avoid having open handles within a thread). If still want to have the possibility
    of having open handles or handle asynchrnous tasks, you can set the environment variable `PISCINA_ENABLE_ASYNC_ATOMICS` to `1` or setting `options.atomics` to `async`.

   > **Note**: The `async` mode comes with performance penalties and can lead to undesired behaviour if open handles are not tracked correctly.
  
  * `resourceLimits`: (`object`) See [Node.js new Worker options][]
    * `maxOldGenerationSizeMb`: (`number`) The maximum size of each worker threads
      main heap in MB.
    * `maxYoungGenerationSizeMb`: (`number`) The maximum size of a heap space for
      recently created objects.
    * `codeRangeSizeMb`: (`number`) The size of a pre-allocated memory range used
      for generated code.
    * `stackSizeMb` : (`number`) The default maximum stack size for the thread.
      Small values may lead to unusable Worker instances. Default: 4
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
  * `taskQueue`: (`TaskQueue`) By default, Piscina uses a first-in-first-out
    queue for submitted tasks. The `taskQueue` option can be used to provide an
    alternative implementation. See [Custom Task Queues][] for additional detail.
  * `niceIncrement`: (`number`) An optional value that decreases priority for
    the individual threads, i.e. the higher the value, the lower the priority
    of the Worker threads. This value is used on Unix/Windows and requires the
    optional [`@napi-rs/nice`][https://www.npmjs.com/package/@napi-rs/nice] module to be installed.
    See [`nice(2)`][https://linux.die.net/man/2/nice] for more details.
  * `trackUnmanagedFds`: (`boolean`) An optional setting that, when `true`, will
    cause Workers to track file descriptors managed using `fs.open()` and
    `fs.close()`, and will close them automatically when the Worker exits.
    Defaults to `true`. (This option is only supported on Node.js 12.19+ and
    all Node.js versions higher than 14.6.0).
  * `closeTimeout`: (`number`) An optional time (in milliseconds) to wait for the pool to 
  complete all in-flight tasks when `close()` is called. The default is `30000`
  * `recordTiming`: (`boolean`) By default, run and wait time will be recorded
    for the pool. To disable, set to `false`.

Use caution when setting resource limits. Setting limits that are too low may
result in the `Piscina` worker threads being unusable.

### Method: `run(task[, options])`

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

### Method: `destroy()`

Stops all Workers and rejects all `Promise`s for pending tasks.

This returns a `Promise` that is fulfilled once all threads have stopped.

### Method: `close([options])`

* `options`:
  * `force`: A `boolean` value that indicates whether to abort all tasks that 
  are enqueued but not started yet. The default is `false`.

Stops all Workers gracefully.

This returns a `Promise` that is fulfilled once all tasks that were started 
have completed and all threads have stopped.

This method is similar to `destroy()`, but with the difference that `close()` 
will wait for the worker tasks to finish, while `destroy()` 
will abort them immediately.

### Event: `'error'`

An `'error'` event is emitted by instances of this class when:

- Uncaught exceptions occur inside Worker threads that do not currently handle
  tasks.
- Unexpected messages are sent from from Worker threads.

All other errors are reported by rejecting the `Promise` returned from
`run()`, including rejections reported by the handler function
itself.

### Event: `'drain'`

A `'drain'` event is emitted when the current usage of the
pool is below the maximum capacity of the same.
The intended goal is to provide backpressure to the task source
so creating tasks that can not be executed at immediately can be avoided.


### Event: `'needsDrain'`

Similar to [`Piscina#needsDrain`](#property-needsdrain-readonly);
this event is triggered once the total capacity of the pool is exceeded
by number of tasks enqueued that are pending of execution.

### Event: `'message'`

A `'message'` event is emitted whenever a message is received from a worker thread.

### Property: `completed` (readonly)

The current number of completed tasks.

### Property: `duration` (readonly)

The length of time (in milliseconds) since this `Piscina` instance was
created.

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

### Property: `needsDrain` (readonly)

Boolean value that specifies whether the capacity of the pool has
been exceeded by the number of tasks submitted.

This property is helpful to make decisions towards creating backpressure
over the number of tasks submitted to the pool.

### Property: `utilization` (readonly)

A point-in-time ratio comparing the approximate total mean run time
of completed tasks to the total runtime capacity of the pool.

A pools runtime capacity is determined by multiplying the `duration`
by the `options.maxThread` count. This provides an absolute theoretical
maximum aggregate compute time that the pool would be capable of.

The approximate total mean run time is determined by multiplying the
mean run time of all completed tasks by the total number of completed
tasks. This number represents the approximate amount of time the
pool as been actively processing tasks.

The utilization is then calculated by dividing the approximate total
mean run time by the capacity, yielding a fraction between `0` and `1`.

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

### Static method: `move(value)`

By default, any value returned by a worker function will be cloned when
returned back to the Piscina pool, even if that object is capable of
being transfered. The `Piscina.move()` method can be used to wrap and
mark transferable values such that they will by transfered rather than
cloned.

The `value` may be any object supported by Node.js to be transferable
(e.g. `ArrayBuffer`, any `TypedArray`, or `MessagePort`), or any object
implementing the `Transferable` interface.

```js
const { move } = require('piscina');

module.exports = () => {
  return move(new ArrayBuffer(10));
}
```

The `move()` method will throw if the `value` is not transferable.

The object returned by the `move()` method should not be set as a
nested value in an object. If it is used, the `move()` object itself
will be cloned as opposed to transfering the object it wraps.

#### Interface: `Transferable`

Objects may implement the `Transferable` interface to create their own
custom transferable objects. This is useful when an object being
passed into or from a worker contains a deeply nested transferable
object such as an `ArrayBuffer` or `MessagePort`.

`Transferable` objects expose two properties inspected by Piscina
to determine how to transfer the object. These properties are
named using the special static `Piscina.transferableSymbol` and
`Piscina.valueSymbol` properties:

* The `Piscina.transferableSymbol` property provides the object
  (or objects) that are to be included in the `transferList`.

* The `Piscina.valueSymbol` property provides a surrogate value
  to transmit in place of the `Transferable` itself.

Both properties are required.

For example,

```js
const {
  move,
  transferableSymbol,
  valueSymbol
} = require('piscina');

module.exports = () => {
  const obj = {
    a: { b: new Uint8Array(5); },
    c: { new Uint8Array(10); },

    get [transferableSymbol]() {
      // Transfer the two underlying ArrayBuffers
      return [this.a.b.buffer, this.c.buffer];
    }

    get [valueSymbol]() {
      return { a: { b: this.a.b }, c: this.c };
    }
  };
  return move(obj);
};
```

## Custom Task Queues

By default, Piscina uses a simple array-based first-in-first-out (fifo)
task queue. When a new task is submitted and there are no available
workers, tasks are pushed on to the queue until a worker becomes
available.

If the default fifo queue is not sufficient, user code may replace the
task queue implementation with a custom implementation using the
`taskQueue` option on the Piscina constructor.

Custom task queue objects *must* implement the `TaskQueue` interface,
described below using TypeScript syntax:

```ts
interface Task {
  readonly [Piscina.queueOptionsSymbol] : object | null;
}

interface TaskQueue {
  readonly size : number;
  shift () : Task | null;
  remove (task : Task) : void;
  push (task : Task) : void;
}
```

An example of a custom task queue that uses a shuffled priority queue
is available in [`examples/task-queue`](./examples/task-queue/index.js);

The special symbol `Piscina.queueOptionsSymbol` may be set as a property
on tasks submitted to `run()` as a way of passing additional
options on to the custom `TaskQueue` implementation. (Note that because the
queue options are set as a property on the task, tasks with queue
options cannot be submitted as JavaScript primitives).

### Built-In Queues
Piscina also provides the `FixedQueue`, a more performant task queue implementation based on [`FixedQueue`](https://github.com/nodejs/node/blob/de7b37880f5a541d5f874c1c2362a65a4be76cd0/lib/internal/fixed_queue.js) from Node.js project.  

Here are some benchmarks to compare new `FixedQueue` with `ArrayTaskQueue` (current default). The benchmarks demonstrate substantial improvements in push and shift operations, especially with larger queue sizes.
```
Queue size = 1000
┌─────────┬─────────────────────────────────────────┬───────────┬────────────────────┬──────────┬─────────┐
│ (index) │ Task Name                               │ ops/sec   │ Average Time (ns)  │ Margin   │ Samples │
├─────────┼─────────────────────────────────────────┼───────────┼────────────────────┼──────────┼─────────┤
│ 0       │ 'ArrayTaskQueue full push + full shift' │ '9 692'   │ 103175.15463917515 │ '±0.80%' │ 970     │
│ 1       │ 'FixedQueue  full push + full shift'    │ '131 879' │ 7582.696390658352  │ '±1.81%' │ 13188   │
└─────────┴─────────────────────────────────────────┴───────────┴────────────────────┴──────────┴─────────┘

Queue size = 100_000
┌─────────┬─────────────────────────────────────────┬─────────┬────────────────────┬──────────┬─────────┐
│ (index) │ Task Name                               │ ops/sec │ Average Time (ns)  │ Margin   │ Samples │
├─────────┼─────────────────────────────────────────┼─────────┼────────────────────┼──────────┼─────────┤
│ 0       │ 'ArrayTaskQueue full push + full shift' │ '0'     │ 1162376920.0000002 │ '±1.77%' │ 10      │
│ 1       │ 'FixedQueue full push + full shift'     │ '1 026' │ 974328.1553396407  │ '±2.51%' │ 103     │
└─────────┴─────────────────────────────────────────┴─────────┴────────────────────┴──────────┴─────────┘
```
In terms of Piscina performance itself, using `FixedQueue` with a queue size of 100,000 queued tasks can result in up to 6 times faster execution times.

Users can import `FixedQueue` from the `Piscina` package and pass it as the `taskQueue` option to leverage its benefits.


#### Using FixedQueue Example

Here's an example of how to use the `FixedQueue`:

```js
const { Piscina, FixedQueue } = require('piscina');
const { resolve } = require('path');

// Create a Piscina pool with FixedQueue
const piscina = new Piscina({
  filename: resolve(__dirname, 'worker.js'),
  taskQueue: new FixedQueue()
});

// Submit tasks to the pool
for (let i = 0; i < 10; i++) {
  piscina.run({ data: i }).then((result) => {
    console.log(result);
  }).catch((error) => {
    console.error(error);
  });
}
```

## Current Limitations (Things we're working on / would love help with)

* Improved Documentation
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

### Queue Size

Piscina provides the ability to configure the minimum and
maximum number of worker threads active in the pool, as well as
set limits on the number of tasks that may be queued up waiting
for a free worker. It is important to note that setting the
`maxQueue` size too high relative to the number of worker threads
can have a detrimental impact on performance and memory usage.
Setting the `maxQueue` size too small can also be problematic
as doing so could cause your worker threads to become idle and
be shutdown. Our testing has shown that a `maxQueue` size of
approximately the square of the maximum number of threads is
generally sufficient and performs well for many cases, but this
will vary significantly depending on your workload. It will be
important to test and benchmark your worker pools to ensure you've
effectively balanced queue wait times, memory usage, and worker
pool utilization.

### Queue Pressure and Idle Threads

The thread pool maintained by Piscina has both a minimum and maximum
limit to the number of threads that may be created. When a Piscina
instance is created, it will spawn the minimum number of threads
immediately, then create additional threads as needed up to the
limit set by `maxThreads`. Whenever a worker completes a task, a
check is made to determine if there is additional work for it to
perform. If there is no additional work, the thread is marked idle.
By default, idle threads are shutdown immediately, with Piscina
ensuring that the pool always maintains at least the minimum.

When a Piscina pool is processing a stream of tasks (for instance,
processing http server requests as in the React server-side
rendering example in examples/react-ssr), if the rate in which
new tasks are received and queued is not sufficient to keep workers
from going idle and terminating, the pool can experience a thrashing
effect -- excessively creating and terminating workers that will
cause a net performance loss. There are a couple of strategies to
avoid this churn:

Strategy 1: Ensure that the queue rate of new tasks is sufficient to
keep workers from going idle. We refer to this as "queue pressure".
If the queue pressure is too low, workers will go idle and terminate.
If the queue pressure is too high, tasks will stack up, experience
increased wait latency, and consume additional memory.

Strategy 2: Increase the `idleTimeout` configuration option. By
default, idle threads terminate immediately. The `idleTimeout` option
can be used to specify a longer period of time to wait for additional
tasks to be submitted before terminating the worker. If the queue
pressure is not maintained, this could result in workers sitting idle
but those will have less of a performance impact than the thrashing
that occurs when threads are repeatedly terminated and recreated.

Strategy 3: Increase the `minThreads` configuration option. This has
the same basic effect as increasing the `idleTimeout`. If the queue
pressure is not high enough, workers may sit idle indefinitely but
there will be less of a performance hit.

In applications using Piscina, it will be most effective to use a
combination of these three approaches and tune the various configuration
parameters to find the optimum combination both for the application
workload and the capabilities of the deployment environment. There
are no one set of options that are going to work best.

### Thread priority on Linux systems

On Linux systems that support [`nice(2)`][], Piscina is capable of setting
the priority of every worker in the pool. To use this mechanism, an additional
optional native addon dependency (`@napi-rs/nice`, `npm i @napi-rs/nice`) is required.
Once [`@napi-rs/nice`][] is installed, creating a `Piscina` instance with the
`niceIncrement` configuration option will set the priority for the pool:

```js
const Piscina = require('piscina');
const pool = new Piscina({
  worker: '/absolute/path/to/worker.js',
  niceIncrement: 20
});
```

The higher the `niceIncrement`, the lower the CPU scheduling priority will be
for the pooled workers which will generally extend the execution time of
CPU-bound tasks but will help prevent those threads from stealing CPU time from
the main Node.js event loop thread. Whether this is a good thing or not depends
entirely on your application and will require careful profiling to get correct.

The key metrics to pay attention to when tuning the `niceIncrement` are the
sampled run times of the tasks in the worker pool (using the [`runTime`][]
property) and the [delay of the Node.js main thread event loop][].

### Multiple Thread Pools and Embedding Piscina as a Dependency

Every `Piscina` instance creates a separate pool of threads and operates
without any awareness of the other. When multiple pools are created in a
single application the various threads may contend with one another, and
with the Node.js main event loop thread, and may cause an overall reduction
in system performance.

Modules that embed Piscina as a dependency *should* make it clear via
documentation that threads are being used. It would be ideal if those
would make it possible for users to provide an existing `Piscina` instance
as a configuration option in lieu of always creating their own.

## The Team

* James M Snell <jasnell@gmail.com>
* Anna Henningsen <anna@addaleax.net>
* Matteo Collina <matteo.collina@gmail.com>
* Rafael Gonzaga <rafael.nunu@hotmail.com>
* Robert Nagy <ronagy@icloud.com>
* Carlos Fuentes <me@metcoder.dev>

## Acknowledgements

Piscina development is sponsored by [NearForm Research][].

[`Atomics`]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics
[`EventEmitter`]: https://nodejs.org/api/events.html
[`postMessage`]: https://nodejs.org/api/worker_threads.html#worker_threads_port_postmessage_value_transferlist
[`examples/task-queue`]: https://github.com/jasnell/piscina/blob/master/examples/task-queue/index.js
[`nice(2)`]: https://linux.die.net/man/2/nice
[`@napi-rs/nice`]: https://npmjs.org/package/@napi-rs/nice
[`runTime`]: #property-runtime-readonly
[Custom Task Queues]: #custom_task_queues
[ES modules]: https://nodejs.org/api/esm.html
[Node.js new Worker options]: https://nodejs.org/api/worker_threads.html#worker_threads_new_worker_filename_options
[MIT Licensed]: LICENSE.md
[NearForm Research]: https://www.nearform.com/research/
[delay of the Node.js main thread event loop]: https://nodejs.org/dist/latest-v14.x/docs/api/perf_hooks.html#perf_hooks_perf_hooks_monitoreventloopdelay_options
