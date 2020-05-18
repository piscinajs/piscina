'use strict';

const Piscina = require('../..');

const pool = new Piscina();
const { resolve } = require('path');

(async () => {
  await Promise.all([
    pool.runTask({}, resolve(__dirname, 'worker')),
    pool.runTask({}, resolve(__dirname, 'worker.mjs'))
  ]);
})();
