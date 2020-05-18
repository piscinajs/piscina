'use strict';

const { platform } = require('os');
const isWindows = platform() === 'win32';

module.exports = {
  'ignore-class-method': isWindows ? '_acceptableCpuLoad' : undefined
};
