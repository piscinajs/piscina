'use strict'
const { resolve } = require('node:path')

const { Piscina } = require('../../dist')

const { tasksPerWorker, minThreads } = require('./utils')

module.exports = suite => {
  const pool = new Piscina({
    filename: resolve(__dirname, '..', 'fixtures/add.js'),
    atomics: 'async'
  })
  const pool2 = new Piscina({
    minThreads,
    filename: resolve(__dirname, '..', 'fixtures/add.js'),
    concurrentTasksPerWorker: tasksPerWorker,
    atomics: 'async'
  })

  suite.add('simple/async/default', { maxTime: 1 }, async () => {
    await pool.run({ a: 1, b: 2 })
  })

  suite.add(`simple/async/customized`, { maxTime: 1 }, async () => {
    await pool2.run({ a: 1, b: 2 })
  })

  return suite
}
