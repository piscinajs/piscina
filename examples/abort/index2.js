'use strict';

const Piscina = require('../..');
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
    console.log('The task was cancelled');
  }
})();
