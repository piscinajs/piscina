'use strict';

const Piscina = require('../../dist/src');
const { resolve } = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const randomFill = promisify(crypto.randomFill);
const { performance, PerformanceObserver } = require('perf_hooks')

const obs = new PerformanceObserver((entries) => {
  console.log(entries.getEntries()[0].duration)
});
obs.observe({ entryTypes: ['measure']});

const piscina = new Piscina({
  filename: resolve(__dirname, 'scrypt.js'),
  concurrentTasksPerWorker: 10
});

async function* generateInput() {
  let max = parseInt(process.argv[2] || 10);
  const data = Buffer.allocUnsafe(10);
  while (max-- > 0) {
    yield randomFill(data);
  }
}

(async function() {
  performance.mark('start');
  const keylen = 64;

  for await (const input of generateInput())
    await piscina.runTask({ input, keylen });

  performance.mark('end');
  performance.measure('start to end', 'start', 'end');
})();
