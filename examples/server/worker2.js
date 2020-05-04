'use strict';

const sab = new SharedArrayBuffer(4);
const lock = new Int32Array(sab);

module.exports = async () => {
  Atomics.wait(lock, 0, 0, 100);
  return { hello: 'world' };
};
