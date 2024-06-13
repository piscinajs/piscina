---
id: Installation and Basic Usage
sidebar_position: 2
---
This section will guide you through the process of getting started with Piscina.js. We'll cover installation, basic usage, and configuration options to help you quickly integrate Piscina.js into your project.

To get started, you'll need to have Node.js version 16.x or higher installed on your system. You can install Piscina.js using `npm`. Open your terminal and run the following command:

```
npm install piscina
```

This will download and install the latest version of Piscina.js and its dependencies.
Once you have Piscina.js installed, you can start using it in your code.


## Setting Up Your Main File (`main.js`)

```javascript
const path = require('path');
const Piscina = require('piscina');

// Create a new Piscina instance pointing to your worker file
const piscina = new Piscina({
  filename: path.resolve(__dirname, 'worker.js')
});

// Run a task using Piscina
(async () => {
  const result = await piscina.run({ a: 4, b: 6 });
  console.log(result);  // prints 10
})();
```

## Creating a Worker File (`worker.js`)

```javascript
// A simple worker function that adds two numbers
module.exports = ({ a, b }) => a + b;
```

## Using Async Functions or Promises

Workers can be asynchronous or return a promise:

```javascript
const { setTimeout } = require('timers/promises');

// An async worker function with simulated delay
module.exports = async ({ a, b }) => {
   // Fake some async activity with a delay
  await setTimeout(100);
  return a + b;
};
```

## Supporting ECMAScript Modules (ESM)

Piscina.js also works with ECMAScript modules:

```javascript
import { Piscina } from 'piscina';

const piscina = new Piscina({
  // The URL must be a file:// URL
  filename: new URL('./worker.mjs', import.meta.url).href
});

const result = await piscina.run({ a: 4, b: 6 });
console.log(result); // Prints 10
```

In your worker module (`worker.mjs`):

```javascript
// Default export of an addition function
export default ({ a, b }) => a + b;
```

## Exporting Multiple Worker Functions

A single worker file may export multiple named handler functions:

```javascript
'use strict';

function add({ a, b }) { return a + b; }

function multiply({ a, b }) { return a * b; }

add.add = add;
add.multiply = multiply;

module.exports = add;
```

The export to target can then be specified when the task is submitted:

```javascript
'use strict';

const Piscina = require('piscina');
const { resolve } = require('path');

// Initialize Piscina with the worker file
const piscina = new Piscina({
  filename: resolve(__dirname, 'worker.js')
});

// Run multiple tasks concurrently
(async () => {
  const [sum, product] = await Promise.all([
    piscina.run({ a: 4, b: 6 }, { name: 'add' }),
    piscina.run({ a: 4, b: 6 }, { name: 'multiply' })
  ]);
})();
```

## Cancelable Tasks

Tasks can be canceled using an `AbortController` or an `EventEmitter`:

### Using `AbortController`

```javascript
'use strict';

const Piscina = require('piscina');
const { resolve } = require('path');

// Set up Piscina with the worker file
const piscina = new Piscina({
  filename: resolve(__dirname, 'worker.js')
});

// Run a task and cancel it using AbortController
(async () => {
  const abortController = new AbortController();
  const { signal } = abortController;
  const task = piscina.run({ a: 4, b: 6 }, { signal });
  abortController.abort(); // Cancel the task

  try {
    await task;
  } catch (err) {
    console.log('The task was canceled'); // Handle the cancellation
  }
})();
```

### Using `EventEmitter`

```javascript
'use strict';

const Piscina = require('piscina');
const EventEmitter = require('events');
const { resolve } = require('path');

// Initialize Piscina with the worker file
const piscina = new Piscina({
  filename: resolve(__dirname, 'worker.js')
});

// Run a task and cancel it using an EventEmitter
(async () => {
  const ee = new EventEmitter();
  const task = piscina.run({ a: 4, b: 6 }, { signal: ee });
  ee.emit('abort'); // Emit an 'abort' event to cancel the task

  try {
    await task;
  } catch (err) {
    console.log('The task was canceled'); // Handle the cancellation
  }
})();
```


