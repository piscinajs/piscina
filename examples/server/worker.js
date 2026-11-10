'use strict';

const { promisify } = require('util');
const sleep = promisify(setTimeout);

module.exports = async () => {
  await sleep(100);
  return { hello: 'world' };
};
