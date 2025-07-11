'use strict'
const { resolve } = require('node:path')
const { availableParallelism } = require('node:os')
const { Suite } = require('bench-node')
const { Piscina } = require('../dist')

const suite = new Suite({
  // useWorkers: true, // Does not supports async/await
  pretty: true
})

const tasksPerWorker = Math.max(1, Math.floor(availableParallelism() / 2))
const minThreads = Math.min(tasksPerWorker, 2)
const pool = new Piscina({
  filename: resolve(__dirname, 'fixtures/add.js'),
  atomics: 'async'
})
const pool2 = new Piscina({
  filename: resolve(__dirname, 'fixtures/add.js'),
  concurrentTasksPerWorker: tasksPerWorker,
  minThreads: Math.max(tasksPerWorker, 1),
  atomics: 'async'
})

suite.add('Default', { maxTime: 1 }, async () => {
  await pool.run({ a: 1, b: 2 })
})

suite.add(
  `Customized (minThreads: ${minThreads}, maxThreads: ${
    availableParallelism() * 1.5
  }, Tasks: ${tasksPerWorker})`,
  { maxTime: 1 },
  async () => {
    await pool2.run({ a: 1, b: 2 })
  }
)

console.log('Load Balancing Benchmark (Atomics Async) - Greater Better')
suite
  .run()
  .then(() => {
    console.log('Benchmark completed.')
  })
  .catch(err => {
    console.error('Benchmark failed:', err)
  })
