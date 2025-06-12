'use strict';

// As node 20 test runner does not support glob patterns in input
// and considering that we could have multiple OS we manually
// resolve the test files and pass them to the test runner

const { spawnSync } = require('child_process');
const { globSync } = require('glob');
const { parseArgs } = require('node:util');

const options = {
  pattern: {
    type: 'string',
    short: 'p',
    description: 'Glob pattern to match test files',
    default: 'test/**/*test.ts',
  },
  coverage: {
    type: 'boolean',
    short: 'c',
    description: 'Run tests with coverage',
    default: false,
  },
  concurrency: {
    type: 'string',
    short: 'n',
    description: 'Number of test files to run concurrently',
    default: '2',
  },
};

const {
  values,
} = parseArgs({ args: process.argv.slice(2), options });

const pattern = values.pattern;
const isCoverage = values.coverage;
const concurrency = Number(values.concurrency);

const testFiles = globSync(pattern, { absolute: true });

const args = [
  '--import=tsx',
  `--test-concurrency=${concurrency}`,
  '--test',
  ...testFiles
];

let result;
if (isCoverage) {
  result = spawnSync('c8', ['--reporter=lcov', 'node', ...args], { stdio: 'inherit' });
} else {
  result = spawnSync('c8', ['node', ...args], { stdio: 'inherit' });
}

process.exit(result.status);
