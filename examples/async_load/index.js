'use strict';

const Piscina = require('../..');

const pool = new Piscina();
const { resolve } = require('path');

(async () => {
  await Promise.all([
    pool.run({}, { filename: resolve(__dirname, 'worker') }),
    pool.run({}, { filename: resolve(__dirname, 'worker.mjs') })
  ]);
})();
