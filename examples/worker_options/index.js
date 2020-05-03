'use strict';

const Piscina = require('../..');
const { resolve } = require('path');

const piscina = new Piscina({
  filename: resolve(__dirname, 'worker.js'),
  env: { A: '123' },
  argv: ['a', 'b', 'c'],
  execArgv: ['--no-warnings'],
  workerData: 'ABC'
});

(async function () {
  const result = await piscina.runTask({ a: 4, b: 6 });
  console.log(result); // Prints 10
})();
