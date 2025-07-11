'use strict'
const { resolve } = require('node:path')
const { Suite } = require('bench-node')
const { Piscina, FixedQueue, ArrayTaskQueue } = require('../dist')

const suite = new Suite({
  // useWorkers: true, // Does not supports async/await
  pretty: true
})

const pool = new Piscina({
  filename: resolve(__dirname, 'fixtures/add.js'),
  taskQueue: new ArrayTaskQueue()
})
const pool2 = new Piscina({
  filename: resolve(__dirname, 'fixtures/add.js'),
  taskQueue: new FixedQueue()
})

suite.add('Array Queue', { maxTime: 1 }, async () => {
  await pool.run({ a: 1, b: 2 })
})

suite.add('Fixed Queue', { maxTime: 1 }, async () => {
  await pool2.run({ a: 1, b: 2 })
})

console.log('Task Queue Benchmark - Greater Better')
suite
  .run()
  .then(() => {
    console.log('Benchmark completed.')
  })
  .catch(err => {
    console.error('Benchmark failed:', err)
  })
