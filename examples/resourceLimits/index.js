'use strict';

const Piscina = require('../..');
const { resolve } = require('path');
const { strictEqual } = require('assert');

const piscina = new Piscina({
  filename: resolve(__dirname, 'worker.js'),
  resourceLimits: {
    maxOldGenerationSizeMb: 16,
    maxYoungGenerationSizeMb: 4,
    codeRangeSizeMb: 16
  }
});

(async function () {
  try {
    await piscina.run();
  } catch (err) {
    console.log('Worker terminated due to resource limits');
    strictEqual(err.code, 'ERR_WORKER_OUT_OF_MEMORY');
  }
})();
