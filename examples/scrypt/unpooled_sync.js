'use strict';

const crypto = require('crypto');
const { promisify } = require('util');
const { scryptSync, randomFillSync } = crypto;
const randomFill = promisify(crypto.randomFill);
const { performance, PerformanceObserver } = require('perf_hooks')

const salt = Buffer.allocUnsafe(16);

const obs = new PerformanceObserver((entries) => {
  console.log(entries.getEntries()[0].duration)
});
obs.observe({ entryTypes: ['measure']});

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
    // Everything in here is intentionally sync
    scryptSync(input, randomFillSync(salt), keylen).toString('hex');
  }
  performance.mark('end');
  performance.measure('start to end', 'start', 'end');
})();
