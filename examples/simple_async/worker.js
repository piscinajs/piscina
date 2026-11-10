'use strict';

const { promisify } = require('util');
const sleep = promisify(setTimeout);

module.exports = async ({ a, b }) => {
  // Fake some async activity
  await sleep(100);
  return a + b;
};
