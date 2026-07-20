'use strict';

const Piscina = require('../..');
const { resolve } = require('path');
const ProgressBar = require('progress');

const piscina = new Piscina({
  filename: resolve(__dirname, 'worker.js')
});

// Illustrates using a MessageChannel to allow the worker to
// notify the main thread about current progress.

async function task (a, b) {
  const bar = new ProgressBar(':bar [:current/:total]', { total: b });
  const mc = new MessageChannel();
  mc.port2.onmessage = () => bar.tick();
  mc.port2.unref();
  return await piscina.run({ a, b, port: mc.port1 }, { transferList: [mc.port1] });
}

Promise.all([
  task(0, 50),
  task(0, 25),
  task(0, 90)
]).catch((err) => console.error(err));
