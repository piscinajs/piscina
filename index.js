'use strict'

const { version } = require('./package.json')
const { isMainThread } = require('worker_threads')
const EventEmitter = require('events')

// TODO(@jasnell): Currently uses Symbols for "private" fields.
// This can be moved to private fields once the minimal Node.js
// LTS version is known to support private fields
const kMaxConcurrency = Symbol('piscina.kMaxConcurrency')
const kMaxWorkers = Symbol('piscina.kMaxWorkers')
const kMinWorkers = Symbol('piscina.kMinWorkers')
const kPool = Symbol('piscina.kPool')
const kSpec = Symbol('piscina.kSpec')

const kMaxMultiplier = 4
const kDefaultOptions = {
  concurrency: 1,
  min: 1,
  max: 4
}

// The other name I considered for this as a very strong
// runner up was WadeWilson ... aka threadpool
class Piscina extends EventEmitter {
  constructor (spec, options = kDefaultOptions) {
    super()

    // TODO(@jasnell): Input validation
    const {
      concurrency = 1,
      min,
      max = min * kMaxMultiplier,
    } = { ...options }

    this[kSpec] = spec
    this[kMaxConcurrency] = concurrency
    this[kMaxWorkers] = max
    this[kMinWorkers] = min
    this[kPool] = new Set()
  }

  get minWorkers () { return this[kMinWorkers] }
  get maxWorkers () { return this[kMaxWorkers] }
  get concurrency () { return this[kMaxConcurrency] }
}

Piscina.version = version
Piscina.isMainThread = isMainThread

module.exports = Piscina
