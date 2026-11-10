'use strict';

const { promisify } = require('node:util');

const sleep = promisify(setTimeout);

const buf = new Uint32Array(new SharedArrayBuffer(4));

module.exports = async ({ time = 5, a }) => {
  await sleep(time);
  const ret = Atomics.exchange(buf, 0, a);
  return ret;
};
