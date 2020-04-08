'use strict'

const Piscina = require('..')
const { test } = require('tap')
const { version } = require('../package.json')
const { Worker, isMainThread } = require('worker_threads')
const { resolve } = require('path')
const { once } = require('events')

test('Piscina is exposed on export', async ({ is }) => {
  is(Piscina.version, version)
})

test('Piscina.isMainThread has the correct value', async ({ is }) => {
  is(Piscina.isMainThread, isMainThread)
})

test('Piscina.isMainThread has the corect value (worker)', async ({ is }) => {
  const worker = new Worker(resolve(__dirname, 'fixtures/simple-ismainthread.js'))
  const [code] = await once(worker, 'exit')
  is(code, 0)
})

test('Piscina instance is an EventEmitter', async ({ ok }) => {
  const EventEmitter = require('events')
  const piscina = new Piscina()
  ok(piscina instanceof EventEmitter)
})

test('Piscina constructor options are correctly set', async ({ is }) => {
  const piscina = new Piscina('', {
    concurrency: 10,
    min: 10,
    max: 20
  })

  is(piscina.concurrency, 10)
  is(piscina.minWorkers, 10)
  is(piscina.maxWorkers, 20)
})
