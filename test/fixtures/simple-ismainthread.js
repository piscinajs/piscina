'use strict'

const Piscina = require('../..')
const { isMainThread } = require('worker_threads')
const assert = require('assert')

assert.strictEqual(Piscina.isMainThread, isMainThread)
