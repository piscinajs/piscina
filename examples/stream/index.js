'use strict';

const Piscina = require('../../dist/src');
const { resolve } = require('path');
const { MessageChannel } = require('worker_threads');
const PortDuplex = require('./port_duplex');
const { pipeline, Writable } = require('stream');

const piscina = new Piscina({
  filename: resolve(__dirname, 'worker.js')
});

class W extends Writable {
  length = 0;
  _write (chunk, encoding, callback) {
    this.length += chunk.length;
    callback();
  }
};

(async function () {
  const channel = new MessageChannel();
  const duplex = new PortDuplex(channel.port2, { writable: false });
  const w = new W();

  duplex.on('close', () => channel.port2.close());

  pipeline(duplex, w, () => console.log(w.length));

  await piscina.runTask({ port: channel.port1 }, [channel.port1]);
})();
