'use strict'
const { resolve } = require('node:path')
const { Suite } = require('bench-node')
const { Piscina, FixedQueue } = require('../dist')

const suite = new Suite({
  // useWorkers: true, // Does not supports async/await
  pretty: true,
  benchmarkMode: 'time'
})

suite.add('Default', { maxTime: 1 }, async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/add.js'),
    taskQueue: new FixedQueue()
  })

  await pool.run({ a: 1, b: 2 })
})

console.log('Startup Benchmark - Lower Better')
suite
  .run()
  .then(() => {
    console.log('Benchmark completed.')
  })
  .catch(err => {
    console.error('Benchmark failed:', err)
  })
