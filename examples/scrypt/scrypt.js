// eslint-disable no-unused-vars
'use strict';

const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);
const randomFill = promisify(crypto.randomFill);

const salt = Buffer.allocUnsafe(16);

module.exports = async function ({
  input,
  keylen,
  N = 16384,
  r = 8,
  p = 1,
  maxmem = 32 * 1024 * 1024
}) {
  return (await scrypt(
    input,
    await randomFill(salt),
    keylen, { N, r, p, maxmem })).toString('hex');
};
