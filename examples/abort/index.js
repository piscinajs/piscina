'use strict';

const Piscina = require('../..');
const { AbortController } = require('abort-controller');
const { resolve } = require('path');

const piscina = new Piscina({
  filename: resolve(__dirname, 'worker.js')
});

(async function () {
  const abortController = new AbortController();
  try {
    const task = piscina.runTask({ a: 4, b: 6 }, abortController.signal);
    abortController.abort();
    await task;
  } catch (err) {
    console.log('The task was cancelled');
  }
})();
