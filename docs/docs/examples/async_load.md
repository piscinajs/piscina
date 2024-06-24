---
id: Async Load
sidebar_position: 2
---

import {WorkerWrapperComponent} from '@site/src/components/WorkerWrapper.mdx';

Piscina supports asynchronously loaded workers. This feature allows you to perform asynchronous operations during worker initialization, such as loading configurations or establishing database connections.

For example, the main script below creates a Piscina pool and runs tasks from two worker files.

```js title="main.js" tab={"label":"Javascript"}
"use strict";

const Piscina = require("../..");

const pool = new Piscina();
const { resolve } = require("path");

(async () => {
  await Promise.all([
    pool.run({}, { filename: resolve(__dirname, "worker") }),
    pool.run({}, { filename: resolve(__dirname, "worker.mjs") }),
  ]);
})();
```
```javascript tab={"label":"Typescript","span":2} title="main.ts"
import Piscina from "piscina";
import { resolve } from "path";
import { filename } from "./worker";

const pool = new Piscina({
  workerData: { fullpath: filename },
});

(async () => {
  try {
    await Promise.all([
      pool.run(
        {},
        {
          name: "callSleep",
          filename: resolve(__dirname, "./workerWrapper.js"),
        }
      ),
      pool.run({}, { filename: resolve(__dirname, "worker.mjs") }),
    ]);
  } catch (error) {
    console.log(error);
  }
})();
```
```js title="workerWrapper.js"
const { workerData } = require('worker_threads');

if (workerData.fullpath.endsWith(".ts")) {
require("ts-node").register();
}
module.exports = require(workerData.fullpath);
```

Both worker files demonstrate asynchronous loading. They use a sleep function to simulate an asynchronous operation that takes 500 milliseconds.

```js title="worker.js" tab={"label":"Javascript"}
"use strict";

const { promisify } = require("util");
const sleep = promisify(setTimeout);

module.exports = (async () => {
  await sleep(500);
  return () => console.log("hello from an async loaded CommonJS worker");
})();
```

```js title="worker.ts" tab={"label":"Typescript"}
import { promisify } from "util";
import { resolve } from "path";

export const filename = resolve(__filename);

const sleep = promisify(setTimeout);

export async function callSleep(): Promise<void> {
  await sleep(500);
  return console.log("hello from an async loaded TypeScript worker");
}
```

In `worker.mjs`:

```js title="worker.mjs"
// eslint-disable-next-line no-eval
import util from "util";
const sleep = util.promisify(setTimeout);

async function load() {
  await sleep(500);
  return () => console.log("hello from an async loaded ESM worker");
}

export default load();
```
