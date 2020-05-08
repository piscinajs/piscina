'use strict';

// node index [maxQueue] [queueLoadThreshold]
// example: node index
//   defaults to 100 0.5
// example: node index 100 0.25
// example: node index 500 0.10

const { resolve } = require('path');
const csv = require('csvtojson');
const Pool = require('../..');
const { performance, PerformanceObserver } = require('perf_hooks');

const p = new PerformanceObserver((entries) => {
  console.log(entries.getEntries()[0].duration);
});
p.observe({ entryTypes: ['measure'] });

const maxQueue = Math.max(parseInt(process.argv[2] || 100), 50);
const queueLoadThreshold =
  Math.max(Math.min(parseFloat(process.argv[3] | 0.5), 1.0), 0.0);

const pool = new Pool({
  filename: resolve(__dirname, 'worker.js'),
  maxQueue,
  queueLoadThreshold
});

const stream = csv().fromFile('./data.csv');
let counter = 0;

pool.on('drain', () => {
  if (stream.isPaused()) {
    console.log('resuming...', counter, pool.queueSize, pool.queueLoad);
    stream.resume();
  }
});

performance.mark('A');
stream
  .on('data', (data) => {
    const line = data.toString('utf8');
    counter++;
    pool.runTask(line);
    if (pool.queueSize === maxQueue) {
      console.log('pausing...', counter, pool.queueSize, pool.queueLoad);
      stream.pause();
    }
  })
  .on('error', console.error)
  .on('end', () => {
    performance.mark('B');
    performance.measure('A to B', 'A', 'B');
    console.log('done');
  });
