'use strict';

const Piscina = require('../..');
const { resolve } = require('path');

// It is possible for a single Piscina pool to run multiple
// workers at the same time. To do so, pass the worker filename
// to runTask rather than to the Piscina constructor.

const pool = new Piscina();

(async () => {
  console.log(await Promise.all([
    pool.run({ a: 2, b: 3 }, { filename: resolve(__dirname, 'add_worker') }),
    pool.run({ a: 2, b: 3 }, { filename: resolve(__dirname, 'multiply_worker') })
  ]));
})();
