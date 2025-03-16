---
id: Class
sidebar_position: 2
---

## Class: `Piscina`

Piscina works by creating a pool of Node.js Worker Threads to which
one or more tasks may be dispatched. Each worker thread executes a
single exported function defined in a separate file. Whenever a
task is dispatched to a worker, the worker invokes the exported
function and reports the return value back to Piscina when the
function completes.

This class extends [`EventEmitter`](https://nodejs.org/api/events.html) from Node.js.

### Constructor: `new Piscina([options])`

- The following optional configuration is supported:

  - `filename`: (`string | null`) Provides the default source for the code that
    runs the tasks on Worker threads. This should be an absolute path or an
    absolute `file://` URL to a file that exports a JavaScript `function` or
    `async function` as its default export or `module.exports`. [ES modules](https://nodejs.org/api/esm.html)
    are supported.
  - `name`: (`string | null`) Provides the name of the default exported worker
    function. The default is `'default'`, indicating the default export of the
    worker module.
  - `minThreads`: (`number`) Sets the minimum number of threads that are always
    running for this thread pool. The default is the number provided by [`os.availableParallelism`](https://nodejs.org/api/os.html#osavailableparallelism).
  - `maxThreads`: (`number`) Sets the maximum number of threads that are
    running for this thread pool. The default is the number provided by [`os.availableParallelism`](https://nodejs.org/api/os.html#osavailableparallelism) \* 1.5.
  - `idleTimeout`: (`number`) A timeout in milliseconds that specifies how long
    a `Worker` is allowed to be idle, i.e. not handling any tasks, before it is
    shut down. By default, this is immediate. If `Infinity` is passed as the value,
    the `Worker` never shuts down.
    :::info
    The default `idleTimeout` can lead to some performance loss in the application because of the overhead involved with stopping and starting new worker threads. To improve performance, try setting the `idleTimeout` explicitly.
    :::
    :::info
    Be careful when when setting `idleTimeout` to `Infinity`, as this will prevent the worker from shutting down, even when idle, potentially leading to resource overuse.
    :::
  - `maxQueue`: (`number` | `string`) The maximum number of tasks that may be
    scheduled to run, but not yet running due to lack of available threads, at
    a given time. By default, there is no limit. The special value `'auto'`
    may be used to have Piscina calculate the maximum as the square of `maxThreads`.
    When `'auto'` is used, the calculated `maxQueue` value may be found by checking
    the [`options.maxQueue`](#property-options-readonly) property.
  - `concurrentTasksPerWorker`: (`number`) Specifies how many tasks can share
    a single Worker thread simultaneously. The default is `1`. This generally
    only makes sense to specify if there is some kind of asynchronous component
    to the task. Keep in mind that Worker threads are generally not built for
    handling I/O in parallel.
  - `useAtomics`: (`boolean`) Use the [`Atomics`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics) API for faster communication
    between threads. This is on by default. You can disable `Atomics` globally by
    setting the environment variable `PISCINA_DISABLE_ATOMICS` to `1`.
    If `useAtomics` is `true`, it will cause to pause threads (stoping all execution)
    between tasks. Ideally, threads should wait for all operations to finish before
    returning control to the main thread (avoid having open handles within a thread).
  - `resourceLimits`: (`object`) See [Node.js new Worker options](https://nodejs.org/api/worker_threads.html#worker_threads_new_worker_filename_options)
    - `maxOldGenerationSizeMb`: (`number`) The maximum size of each worker threads
      main heap in MB.
    - `maxYoungGenerationSizeMb`: (`number`) The maximum size of a heap space for
      recently created objects.
    - `codeRangeSizeMb`: (`number`) The size of a pre-allocated memory range used
      for generated code.
    - `stackSizeMb` : (`number`) The default maximum stack size for the thread.
      Small values may lead to unusable Worker instances. Default: 4
  - `env`: (`object`) If set, specifies the initial value of `process.env` inside
    the worker threads. See [Node.js new Worker options](https://nodejs.org/api/worker_threads.html#worker_threads_new_worker_filename_options) for details.
  - `argv`: (`any[]`) List of arguments that will be stringified and appended to
    `process.argv` in the worker. See [Node.js new Worker options](https://nodejs.org/api/worker_threads.html#worker_threads_new_worker_filename_options) for details.
  - `execArgv`: (`string[]`) List of Node.js CLI options passed to the worker.
    See [Node.js new Worker options](https://nodejs.org/api/worker_threads.html#worker_threads_new_worker_filename_options) for details.
  - `workerData`: (`any`) Any JavaScript value that can be cloned and made
    available as `require('piscina').workerData`. See [Node.js new Worker options](https://nodejs.org/api/worker_threads.html#worker_threads_new_worker_filename_options)
    for details. Unlike regular Node.js Worker Threads, `workerData` must not
    specify any value requiring a `transferList`. This is because the `workerData`
    will be cloned for each pooled worker.
  - `taskQueue`: (`TaskQueue`) By default, Piscina uses a first-in-first-out
    queue for submitted tasks. The `taskQueue` option can be used to provide an
    alternative implementation. See [Custom Task Queues](https://github.com/piscinajs/piscina#custom_task_queues) for additional detail.
  - `niceIncrement`: (`number`) An optional value that decreases priority for
    the individual threads, i.e. the higher the value, the lower the priority
    of the Worker threads. This value is used on Unix/Windows and requires the
    optional [`@napi-rs/nice`](https://npmjs.org/package/@napi-rs/nice) module to be installed.
    See [`nice(2)`](https://linux.die.net/man/2/nice) and [`SetThreadPriority`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-setthreadpriority) for more details.
  - `trackUnmanagedFds`: (`boolean`) An optional setting that, when `true`, will
    cause Workers to track file descriptors managed using `fs.open()` and
    `fs.close()`, and will close them automatically when the Worker exits.
    Defaults to `true`. (This option is only supported on Node.js 12.19+ and
    all Node.js versions higher than 14.6.0).
  - `closeTimeout`: (`number`) An optional time (in milliseconds) to wait for the pool to
    complete all in-flight tasks when `close()` is called. The default is `30000`
  - `recordTiming`: (`boolean`) By default, run and wait time will be recorded
    for the pool. To disable, set to `false`.

:::caution
Use caution when setting resource limits. Setting limits that are too low may
result in the `Piscina` worker threads being unusable.
:::
