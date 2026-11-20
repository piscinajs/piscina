'use strict';

const Piscina = require('../../dist');

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

let data;
module.exports = {
  send: async () => {
    data = new ArrayBuffer(128);
    const shared = new Shared(data);
    return shared.make();
  },
  // Runs after send()'s response was posted, which detached the buffer.
  get: () => {
    return data.byteLength;
  }
};
