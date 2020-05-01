'use strict';

const Piscina = require('../../dist/src');
const { resolve } = require('path');

const piscina = new Piscina({
  filename: resolve(__dirname, 'worker.js')
});

(async function() {
  const result = await piscina.runTask({ a: 4, b: 6 });
  console.log(result);  // Prints 10
})();
