const { parseArgs } = require('node:util')
const { Suite, jsonReport, prettyReport } = require('bench-node')

const SUPPORTED_SCOPES = [
  'simple',
  'simple:async',
  'simple:all',
  'queue',
  'startup',
  'all'
]
const SUPPORTED_MODES = ['ops', 'time']
const SUPPORTED_REPORTERS = ['pretty', 'json']

const opts = parseArgs({
  allowPositionals: false,
  options: {
    scope: {
      type: 'string',
      short: 's',
      default: 'simple'
    },
    mode: {
      type: 'string',
      short: 'm',
      default: 'ops'
    },
    reporter: {
      type: 'string',
      short: 'r',
      default: 'pretty'
    },
    verbose: {
      type: 'boolean',
      default: false
    }
  }
})

let { mode, reporter, scope, verbose } = opts.values
const print = verbose ? console.log : () => {}

if (scope?.length > 0 && !SUPPORTED_SCOPES.includes(scope)) {
  throw new Error(
    `Invalid scope: ${scope}. Supported scopes: ${SUPPORTED_SCOPES.join(', ')}`
  )
}
if (mode?.length > 0 && !SUPPORTED_MODES.includes(mode)) {
  throw new Error(
    `Invalid mode: ${mode}. Supported modes: ${SUPPORTED_MODES.join(', ')}`
  )
}
if (reporter?.length > 0 && !SUPPORTED_REPORTERS.includes(reporter)) {
  throw new Error(
    `Invalid reporter: ${reporter}. Supported reporters: ${SUPPORTED_REPORTERS.join(
      ', '
    )}`
  )
}

if (scope === 'startup') {
  print('[Note!] The startup benchmark is not supported with ops mode.')
  mode = 'time'
}

if (scope === 'all') {
  print('[Note!] The startup benchmark is not supported with ops mode.')
}

let nested
if (scope.includes(':')) {
  const [baseScope, subScope] = scope.split(':')

  if (subScope?.length > 0 && subScope !== 'async' && subScope !== 'all') {
    throw new Error(
      `Invalid sub-scope: ${subScope}. Supported sub-scopes: async, all`
    )
  }

  scope = baseScope
  nested = subScope?.length > 0 ? subScope : 'simple'
}

let suite = new Suite({
  name: 'Piscina Benchmark',
  benchmarkMode: mode,
  ...(reporter === 'json'
    ? { reporter: jsonReport }
    : { reporter: prettyReport })
})

switch (scope) {
  case 'simple':
    suite = require('./simple')(suite, nested)
    break
  case 'queue':
    suite = require('./queue')(suite)
    break
  case 'startup':
    suite = require('./startup')(suite)
    break
  case 'all':
    suite = require('./queue')(suite)
    suite = require('./simple')(suite, scope === 'all' ? 'all' : nested)
    break
  default:
    throw new Error(`Unsupported scope: ${scope}`)
}

suite.run({ async: true }).then(
  () => {
    print('Benchmark completed.')
  },
  err => {
    print('Benchmark failed:', err)
  }
)
