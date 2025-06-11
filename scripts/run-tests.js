'use strict';

// As node 20 test runner does not support glob patterns in input
// and considering that we could have multiple OS we manually
// resolve the test files and pass them to the test runner

const { spawnSync } = require('child_process');
const { globSync } = require('glob');

const testFiles = globSync('test/**/*test.ts', { absolute: true });
const isCoverage = process.argv.includes('--coverage');

const args = [
  '--import=tsx',
  '--test-concurrency=2',
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
