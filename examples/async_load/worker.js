'use strict';

const { promisify } = require('util');
const sleep = promisify(setTimeout);

module.exports = (async () => {
  await sleep(500);
  return () => console.log('hello from an async loaded CommonJS worker');
})();
