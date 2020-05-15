'use strict';

const Piscina = require('../..');
const EventEmitter = require('events');
const { resolve } = require('path');

const piscina = new Piscina({
  filename: resolve(__dirname, 'worker.js')
});

(async function () {
  const ee = new EventEmitter();
  // Use a timer to limit task processing length
  const t = setTimeout(() => ee.emit('abort'), 500);
  try {
    await piscina.runTask({ a: 4, b: 6 }, ee);
  } catch (err) {
    console.log('The task timed out');
  } finally {
    // Clear the timeout in a finally to make sure
    // it is definitely cleared.
    clearTimeout(t);
  }
})();
