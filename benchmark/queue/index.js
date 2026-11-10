'use strict'
const { resolve } = require('node:path')
const { Piscina, FixedQueue, ArrayTaskQueue } = require('../../dist')

module.exports = suite => {
  const pool = new Piscina({
    filename: resolve(__dirname, '..', 'fixtures/add.js'),
    taskQueue: new ArrayTaskQueue()
  })
  const pool2 = new Piscina({
    filename: resolve(__dirname, '..', 'fixtures/add.js'),
    taskQueue: new FixedQueue()
  })

  suite.add('queue/array', { maxTime: 1 }, async () => {
    await pool.run({ a: 1, b: 2 })
  })

  suite.add('queue/fixed', { maxTime: 1 }, async () => {
    await pool2.run({ a: 1, b: 2 })
  })

  return suite
}
