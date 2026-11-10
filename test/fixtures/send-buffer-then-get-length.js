'use strict';

const Piscina = require('../../dist');

let time;
module.exports = {
  send: async () => {
    const data = new ArrayBuffer(128);
    try {
      return Piscina.move(data);
    } finally {
      setTimeout(() => { time = data.byteLength; }, 5);
    }
  },
  get: () => {
    return time;
  }
};
