'use strict';

const Piscina = require('../../dist/src');

class Shared {
  constructor (data) {
    this.name = 'shared';
    this.data = data;
  }

  get [Piscina.transferableSymbol] () {
    return [this.data];
  }

  get [Piscina.valueSymbol] () {
    return { name: this.name, data: this.data };
  }

  make () {
    return Piscina.move(this);
  }
}

const response = {};
module.exports = {
  send: async () => {
    const data = Buffer.from('this is a test').buffer;
    const shared = new Shared(data);
    try {
      return shared.make();
    } finally {
      response.initial = data.byteLength;
      setTimeout(() => { response.after = data.byteLength; }, 1000);
    }
  },
  get: () => {
    return response;
  }
}
