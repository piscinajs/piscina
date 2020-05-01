'use strict';

const tf = require('@tensorflow/tfjs');
require('@tensorflow/tfjs-node');
const { promisify } = require('util');
const { resolve } = require('path');
const { pathToFileURL } = require('url');

const pitch_type = require('./pitch_type');
const sleep = promisify(setTimeout);

const iters = 1;
const dest = pathToFileURL(resolve(__dirname, 'model.json')).toString();

(async function train() {
  for (var n = 0; n < iters; n++) {
    await pitch_type.model.fitDataset(pitch_type.trainingData, { epochs: 1 });
    console.log('accuracy:', await pitch_type.evaluate(true));
    await sleep(500);
  }
  await pitch_type.model.save(dest);
  pitch_type.model = await tf.loadLayersModel(`${dest}/model.json`);
  console.log('accuracy:', await pitch_type.evaluate(true));
  console.log('done');
})();
