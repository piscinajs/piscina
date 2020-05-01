'use strict';

const Piscina = require('../..');
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
  filename: resolve(__dirname, 'scrypt_sync.js')
});

process.on('exit', () => {
  const { runTime, waitTime } = piscina;
  console.log('Run Time Average:', runTime.average);
  console.log('Run Time Mean/Stddev:', runTime.mean, runTime.stddev);
  console.log('Run Time Min:', runTime.min);
  console.log('Run Time Max:', runTime.max);
  console.log('Wait Time Average:', waitTime.average);
  console.log('Wait Time Mean/Stddev:', waitTime.mean, waitTime.stddev);
  console.log('Wait Time Min:', waitTime.min);
  console.log('Wait Time Max:', waitTime.max);
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

  for await (const input of generateInput()) {
    await piscina.runTask({ input, keylen });
  }

  performance.mark('end');
  performance.measure('start to end', 'start', 'end');
})();
