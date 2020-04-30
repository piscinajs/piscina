'use strict';

const { scryptSync, randomFillSync } = require('crypto');

const salt = Buffer.allocUnsafe(16);

module.exports = function ({
  input,
  keylen,
  N = 16384,
  r = 8,
  p = 1,
  maxmem = 32 * 1024 * 1024 }) {
    return scryptSync(input, randomFillSync(salt), keylen).toString('hex');
};
