---
id: Aborting Tasks
sidebar_position: 1
---
import {WorkerWrapperComponent} from '@site/src/components/WorkerWrapper.mdx';

Piscina allows submitted tasks to be cancelled even if the task has already been submitted to a worker and is being actively processed. This can be used, for instance, to cancel tasks that are taking too long to run.

In this example, we'll simulate a long running task using `setTimeout`:

```js title="worker.js" tab={"label":"Javascript"}
"use strict";

const { promisify } = require("util");
const sleep = promisify(setTimeout);

module.exports = async ({ a, b }) => {
  await sleep(10000);
  return a + b;
};
```

```js title="worker.ts" tab={"label":"Typescript"}
import { promisify } from "util";
import { resolve } from "path";

export const filename = resolve(__filename);

const sleep = promisify(setTimeout);

interface OperationInput {
  a: number;
  b: number;
}

export default async ({ a, b }: OperationInput): Promise<number> => {
  await sleep(10000);
  return a + b;
};
```

Tasks can be canceled using an `AbortController` or an `EventEmitter`.

## Using AbortController

In this example, the AbortController instance is passed as the signal option to the `piscina.run` method. After submitting the task, we call `abortController.abort()` to cancel the task.

```js tab={"label":"Javascript"}
"use strict";

const Piscina = require("piscina");
const { AbortController } = require("abort-controller");
const { resolve } = require("path");

const piscina = new Piscina({
  filename: resolve(__dirname, "worker.js"),
});

(async function () {
  const abortController = new AbortController();
  try {
    const task = piscina.run(
      { a: 4, b: 6 },
      { signal: abortController.signal }
    );
    abortController.abort();
    await task;
  } catch (err) {
    console.log("The task was cancelled");
  }
})();
```

```js tab={"label":"Typescript","span":2}
import Piscina from "piscina"; // Adjust the import path as necessary
import { AbortController } from "abort-controller";
import { resolve } from "path";
import { filename } from "./worker.js";

const piscina = new Piscina({
  filename: resolve(__dirname, "./workerWrapper.js"),
  workerData: { fullpath: filename },
});

(async () => {
  const abortController = new AbortController();
  try {
    const task = piscina.run(
      { a: 4, b: 6 },
      { signal: abortController.signal }
    );
    abortController.abort(); // Cancel the task
    await task; // This will now throw due to the task being cancelled
  } catch (err) {
    console.log("The task was cancelled");
  }
})();
```
<WorkerWrapperComponent/>

## Using EventEmitter

The EventEmitter instance is passed as the signal option to the `piscina.run` method.

```js tab={"label":"Javascript"}
"use strict";

const Piscina = require("../..");
const EventEmitter = require("events");
const { resolve } = require("path");

const piscina = new Piscina({
  filename: resolve(__dirname, "worker.js"),
});

(async function () {
  const ee = new EventEmitter();
  try {
    const task = piscina.run({ a: 4, b: 6 }, { signal: ee });
    ee.emit("abort");
    await task;
  } catch (err) {
    console.log("The task was cancelled");
  }
})();
```

```js tab={"label":"Typescript","span":2}
import Piscina from "piscina";
import { resolve } from "path";
import { filename } from "./worker.js";
import { EventEmitter } from "events";

const piscina = new Piscina({
  filename: resolve(__dirname, "./workerWrapper.js"),
  workerData: { fullpath: filename },
});

(async function () {
  const ee = new EventEmitter();
  try {
    const task = piscina.run({ a: 4, b: 6 }, { signal: ee });
    ee.emit("abort");
    await task;
  } catch (err) {
    console.log("The task was cancelled");
  }
})();
```
<WorkerWrapperComponent/>

## Using a Timer with EventEmitter

In this example, we use a timer and an `EventEmitter` instance to cancel a task that takes longer than a specified time to complete.

```js tab={"label":"Javascript"}
"use strict";

const Piscina = require("../..");
const EventEmitter = require("events");
const { resolve } = require("path");

const piscina = new Piscina({
  filename: resolve(__dirname, "worker.js"),
});

(async function () {
  const ee = new EventEmitter();
  // Use a timer to limit task processing length
  const t = setTimeout(() => ee.emit("abort"), 500);
  try {
    await piscina.run({ a: 4, b: 6 }, { signal: ee });
  } catch (err) {
    console.log("The task timed out");
  } finally {
    // Clear the timeout in a finally to make sure
    // it is definitely cleared.
    clearTimeout(t);
  }
})();
```

```js tab={"label":"Typescript","span":2}
import Piscina from "piscina";
import { resolve } from "path";
import { filename } from "./worker.js";
import { EventEmitter } from "events";

const piscina = new Piscina({
  filename: resolve(__dirname, "./workerWrapper.js"),
  workerData: { fullpath: filename },
});

(async function () {
  const ee = new EventEmitter();
  // Use a timer to limit task processing length
  const t = setTimeout(() => ee.emit("abort"), 500);
  try {
    await piscina.run({ a: 4, b: 6 }, { signal: ee });
  } catch (err) {
    console.log("The task timed out");
  } finally {
    // Clear the timeout in a finally to make sure
    // it is definitely cleared.
    clearTimeout(t);
  }
})();
```
<WorkerWrapperComponent/>

## Using a Timer with AbortController

In this example, we use a timer `AbortController` to cancel a task that takes longer than a specified time to complete.

```js tab={"label":"Javascript"}
'use strict';

const Piscina = require('../..');
const { resolve } = require('path');

const piscina = new Piscina({
  filename: resolve(__dirname, 'worker.js')
});

(async function () {
  // Using the new built-in Node.js AbortController
  // Node.js version 15.0 or higher

  const ac = new AbortController();

  // Use a timer to limit task processing length
  const t = setTimeout(() => ac.abort(), 500);
  try {
    await piscina.run({ a: 4, b: 6 }, { signal: ac.signal });
  } catch (err) {
    console.log('The task timed out');
  } finally {
    // Clear the timeout in a finally to make sure
    // it is definitely cleared.
    clearTimeout(t);
  }
})();
```

```js tab={"label":"Typescript","span":2}
import Piscina from "piscina";
import { resolve } from "path";
import { filename } from "./worker.js";
import { EventEmitter } from "events";

const piscina = new Piscina({
  filename: resolve(__dirname, "./workerWrapper.js"),
  workerData: { fullpath: filename },
});

(async function () {
  // Using the new built-in Node.js AbortController
  // Node.js version 15.0 or higher

  const ac = new AbortController();

  // Use a timer to limit task processing length
  const t = setTimeout(() => ac.abort(), 500);
  try {
    await piscina.run({ a: 4, b: 6 }, { signal: ac.signal });
  } catch (err) {
    console.log("The task timed out");
  } finally {
    // Clear the timeout in a finally to make sure
    // it is definitely cleared.
    clearTimeout(t);
  }
})();
```
<WorkerWrapperComponent/>

You can also check out this example on [github](https://github.com/piscinajs/piscina/tree/current/examples/abort).