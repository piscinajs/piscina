'use strict';

const tf = require('@tensorflow/tfjs');
require('@tensorflow/tfjs-node');
const pitch_type = require('./pitch_type');
const { resolve } = require('path');
const { pathToFileURL } = require('url');

const dest = pathToFileURL(resolve(__dirname, 'model.json')).toString();
pitch_type.model = tf.loadLayersModel(dest);

module.exports = ({ sample }) => pitch_type.predictSample(sample);
