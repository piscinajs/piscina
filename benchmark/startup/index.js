'use strict'
const { resolve } = require('node:path')
const { Piscina } = require('../../dist')

module.exports = suite => {
  suite.add('startup/default', { maxTime: 1 }, async () => {
    const pool = new Piscina({
      filename: resolve(__dirname, '..', 'fixtures/add.js')
    })

    await pool.run({ a: 1, b: 2 })
  })

  return suite
}
