'use strict';

const { BroadcastChannel } = require('worker_threads');
const { resolve } = require('path');

const Piscina = require('piscina');
const piscina = new Piscina({
  filename: resolve(__dirname, 'worker.js'),
  // Set atomics to disabled to avoid threads being blocked when idle
  atomics: 'disabled'
});

async function main () {
  const bc = new BroadcastChannel('my_channel');
  // start worker
  Promise.all([
    piscina.run('thread 1'),
    piscina.run('thread 2')
  ]);
  // post message in one second
  setTimeout(() => {
    bc.postMessage('Main thread message');
  }, 1000);
}

main();
