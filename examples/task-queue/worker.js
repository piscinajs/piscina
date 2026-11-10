'use strict';

const { promisify } = require('util');
const sleep = promisify(setTimeout);

module.exports = async ({ priority }) => {
  await sleep(100);
  process._rawDebug(`${priority}`);
  return priority;
};
