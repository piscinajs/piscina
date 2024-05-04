'use strict';
const { Piscina } = require('../dist/src');
const FixedQueue = require('../dist/src/fixed-queue').default;

const { resolve } = require('path');

async function simpleBenchmark ({ duration = 10000 } = {}) {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/add.js'),
    taskQueue: new FixedQueue()
  });
  let done = 0;

  const results = [];
  const start = process.hrtime.bigint();
  while (pool.queueSize === 0) {
    results.push(scheduleTasks());
  }

  async function scheduleTasks () {
    while ((process.hrtime.bigint() - start) / 1_000_000n < duration) {
      await pool.runTask({ a: 4, b: 6 });
      done++;
    }
  }

  await Promise.all(results);

  return done / duration * 1e3;
}

simpleBenchmark().then((opsPerSecond) => {
  console.log(`opsPerSecond: ${opsPerSecond}`);
});
