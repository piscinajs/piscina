'use strict';

const Piscina = require('../..');
const { resolve } = require('path');
const { makeTask } = require('./helper');

const piscina = new Piscina({
  filename: resolve(__dirname, 'worker.js')
});

(async function () {
  const result = await Promise.all([
    piscina.run(makeTask('add', 4, 6)),
    piscina.run(makeTask('sub', 4, 6))
  ]);
  console.log(result);
})();
