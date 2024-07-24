---
id: Using Typescript with Piscina
sidebar_position: 2
---
import {WorkerWrapperComponent} from '@site/src/components/WorkerWrapper.mdx';

Although Piscina itself is written in TypeScript and supports TypeScript out of the box, complication arises when trying to use `.ts` files directly as worker files because Node.js does not support TypeScript natively.

To work around this, you would typically need to compile your TypeScript worker files to JavaScript first, and then point Piscina’s `filename` option to the compiled JavaScript files.  Consider the following methods:

## Method 1: Using a Worker Wrapper File and `ts_node`

The worker wrapper checks if the provided file path ends with `.ts` and registers the `ts-node` compiler to handle TypeScript files.

<WorkerWrapperComponent/>

In your `worker.ts`:

```typescript title='worker.ts'

import { resolve } from 'path';

export const filename = resolve(__filename);

interface Inputs {
  a: number;
  b: number;
}

export function addNumbers({ a, b }: Inputs): number {
  return a + b;
}
```

Inside the main application:

```typescript title='main.ts'

import Piscina from 'piscina';
import { resolve } from 'path';
import { filename } from './worker';

const piscina = new Piscina({
  filename: resolve(__dirname, './workerWrapper.js'),
  workerData: { fullpath: filename },
});

(async () => {
  const result = await piscina.run({ a: 2, b: 3 }, { name: 'addNumbers' });
  console.log('Result:', result);
})();
```

## Method 2: Inline Worker Code

Alternatively, you can include the worker code in the same file as your main code and use the `isMainThread` flag from `worker_threads` to determine whether the code is running in the main thread or the worker thread.

```typescript title="main.ts"

import Piscina from 'piscina';
import { isMainThread } from 'worker_threads';

interface Inputs {
  a: number;
  b: number;
}

if (isMainThread) {
  const piscina = new Piscina({ filename: __filename });

  (async () => {
    const task: Inputs = { a: 1, b: 2 };
    console.log(await piscina.run(task));
  })();
} else {
  export default ({ a, b }: Inputs): number => {
    return a + b;
  };
}
```
You can also check out this example on [github](https://github.com/piscinajs/piscina/tree/current/examples/typescript).