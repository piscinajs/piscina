'use strict';

const Piscina = require('../../dist');

let data;
module.exports = {
  send: async () => {
    data = new ArrayBuffer(128);
    return Piscina.move(data);
  },
  // Runs after send()'s response was posted, which detached the buffer.
  get: () => {
    return data.byteLength;
  }
};
