'use strict';

const { dispatcher } = require('./helper');

module.exports = dispatcher({
  add (a, b) { return a + b; },
  sub (a, b) { return a - b; }
});
