'use strict'

// As node 20 test runner does not support glob patterns in input
// and considering that we could have multiple OS we manually
// resolve the test files and pass them to the test runner

const { spawnSync } = require('node:child_process')
const { parseArgs } = require('node:util')
const { availableParallelism } = require('node:os')
const { globSync } = require('glob')

function logger (verbose) {
  if (verbose === true) return console.log.bind(console)
  return () => {}
}

const options = {
  pattern: {
    type: 'string',
    short: 'p',
    description: 'Glob pattern to match test files',
    default: 'test/**/*test.ts'
  },
  coverage: {
    type: 'boolean',
    short: 'c',
    description: 'Run tests with coverage',
    default: false
  },
  only: {
    type: 'boolean',
    short: 'o',
    description: 'Run only tests marked with { only: true }',
    default: false
  },
  concurrency: {
    type: 'string',
    short: 'j',
    description: 'Number of concurrent test workers to run',
    default: Math.max(1, availableParallelism() - 1).toString()
  },
  verbose: {
    type: 'boolean',
    description: 'Enable verbose output',
    default: false
  }
}

const { values } = parseArgs({ args: process.argv.slice(2), options })

const pattern = values.pattern
const isCoverage = values.coverage
const runOnly = values.only
const concurrency = Number(values.concurrency)
const verbose = values.verbose
const log = logger(verbose)

log('Running tests with options:', {
  pattern,
  isCoverage,
  runOnly,
  concurrency,
  verbose
})

const testFiles = globSync(pattern, { absolute: true })

log(`Found ${testFiles.length} test files to run:`)
const args = [
  '--enable-source-maps',
  '--import=tsx',
  runOnly ? '--test-only' : '--test',
  isNaN(concurrency) === false && concurrency > 0
    ? `--test-concurrency=${concurrency}`
    : '',
  ...testFiles
]

let result

// we skip coverage for node 20
// because this issuse happen https://github.com/nodejs/node/pull/53315
if (isCoverage && !process.version.startsWith('v20.')) {
  log('Running tests with coverage')
  result = spawnSync(
    'node',
    [
      '--experimental-test-coverage',
      '--test-reporter=lcov',
      '--test-reporter-destination=lcov.info',
      '--test-reporter=spec',
      '--test-reporter-destination=stdout',
      ...args
    ],
    { stdio: 'inherit' }
  )
} else {
  log('Running tests without coverage')
  result = spawnSync('node', args, { stdio: 'inherit' })
}

log('Tests finished with status code:', result.status)
process.exit(result.status)
