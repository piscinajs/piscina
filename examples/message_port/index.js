'use strict';

const Piscina = require('../../dist/src');
const { resolve } = require('path');
const { MessageChannel } = require('worker_threads');

const piscina = new Piscina({
  filename: resolve(__dirname, 'worker.js')
});

(async function() {
  const channel = new MessageChannel();
  channel.port2.on('message', (message) => {
    console.log(message);
    channel.port2.close();
  });
  await piscina.runTask({ port: channel.port1 }, [ channel.port1 ]);
})();
