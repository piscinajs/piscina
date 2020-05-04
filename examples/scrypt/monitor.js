'use strict';

const { monitorEventLoopDelay } = require('perf_hooks');
const { isMainThread } = require('worker_threads');

if (!isMainThread) return;

const monitor = monitorEventLoopDelay({ resolution: 20 });

monitor.enable();

process.on('exit', () => {
  monitor.disable();
  console.log('Main Thread Mean/Max/99% Event Loop Delay:',
    monitor.mean,
    monitor.max,
    monitor.percentile(99));
});
