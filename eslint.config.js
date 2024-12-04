'use strict';

module.exports = require('neostandard')({
  semi: true,
  ts: true,
  noStyle: true,
  ignores: ['dist', 'node_modules', 'docs/build', 'docs/.docusaurus'],
  globals: {
    SharedArrayBuffer: true,
    Atomics: true,
    AbortController: true,
    MessageChannel: true,
  },
});
