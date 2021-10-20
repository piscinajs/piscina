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

let time;
module.exports = {
  send: async () => {
    const data = new ArrayBuffer(128);
    const shared = new Shared(data);
    try {
      return shared.make();
    } finally {
      setTimeout(() => { time = data.byteLength; }, 1000);
    }
  },
  get: () => {
    return time;
  }
};
