'use strict';

const Piscina = require('../../dist/src');

const response = {};
module.exports = {
  send: async () => {
    const data = Buffer.from('this is a test').buffer;
    try {
      return Piscina.move(data)
    } finally {
      response.initial = data.byteLength;
      setTimeout(() => { response.after = data.byteLength; }, 1000);
    }
  },
  get: () => {
    return response;
  }
}