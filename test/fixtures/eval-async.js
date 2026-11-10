'use strict';

const { promisify } = require('node:util');

const sleep = promisify(setTimeout);

// eslint-disable-next-line no-eval
function handler (code) { return eval(code); }

async function load () {
  await sleep(5);
  return handler;
}

module.exports = load();
