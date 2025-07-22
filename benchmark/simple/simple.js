'use strict'
const { resolve } = require('node:path')

const { Piscina } = require('../../dist')

const { tasksPerWorker, minThreads } = require('./utils')

module.exports = suite => {
  const pool = new Piscina({
    filename: resolve(__dirname, '..', 'fixtures/add.js')
  })
  const pool2 = new Piscina({
    filename: resolve(__dirname, '..', 'fixtures/add.js'),
    concurrentTasksPerWorker: tasksPerWorker,
    minThreads
  })

  suite.add('simple/default', { maxTime: 1 }, async () => {
    await pool.run({ a: 1, b: 2 })
  })

  suite.add('simple/customized', { maxTime: 1 }, async () => {
    await pool2.run({ a: 1, b: 2 })
  })

  return suite
}
