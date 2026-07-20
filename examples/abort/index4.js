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
