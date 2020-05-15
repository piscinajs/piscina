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
const Progress = require('./progress');

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

pool.on('drain', () => {
  if (stream.isPaused()) {
    console.log('resuming...', pool.queueSize);
    stream.resume();
  }
});

const progress = new Progress();
progress.on('finished', () => {
  console.log(progress.message);
});

performance.mark('A');
stream
  .on('data', (data) => {
    const line = data.toString('utf8');
    progress.incSubmitted();
    pool.runTask(line)
      .then(() => {
        progress.incCompleted();
      })
      .catch((err) => {
        progress.incFailed();
        stream.destroy(err);
      });
    if (pool.queueSize === maxQueue) {
      console.log('pausing...', pool.queueSize, pool.utilization);
      stream.pause();
    }
  })
  .on('error', console.error)
  .on('end', () => {
    // We are done submitting tasks
    progress.done();
    performance.mark('B');
    performance.measure('A to B', 'A', 'B');
  });

process.on('exit', () => {
  console.log('Mean Wait Time:', pool.waitTime.mean, 'ms');
  console.log('Mean Run Time:', pool.runTime.mean, 'ms');
});
