'use strict';

// node index [maxQueue]
// example: node index
//   defaults to 100
// example: node index 100
// example: node index 500

const { resolve } = require('path');
const csv = require('csvtojson');
const Pool = require('../..');
const { performance, PerformanceObserver } = require('perf_hooks');

const p = new PerformanceObserver((entries) => {
  console.log(entries.getEntries()[0].duration);
});
p.observe({ entryTypes: ['measure'] });

const maxQueue = Math.max(parseInt(process.argv[2] || 100), 50);

const pool = new Pool({
  filename: resolve(__dirname, 'worker.js'),
  maxQueue
});

const stream = csv().fromFile('./data.csv');
let counter = 0;

pool.on('drain', () => {
  if (stream.isPaused()) {
    console.log('resuming...', counter, pool.queueSize);
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
      console.log('pausing...', counter, pool.queueSize, pool.utilization);
      stream.pause();
    }
  })
  .on('error', (err) => {
    console.log(err.message);
    console.log('run: `node generate` to generate the sample data');
  })
  .on('end', () => {
    performance.mark('B');
    performance.measure('A to B', 'A', 'B');
    console.log('done');
  });

process.on('exit', () => {
  console.log(pool.waitTime);
  console.log(pool.runTime);
});
