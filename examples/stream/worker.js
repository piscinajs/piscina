'use strict';

const PortDuplex = require('./port_duplex');
const { createReadStream } = require('fs');
const { pipeline } = require('stream');
const { createGzip } = require('zlib');

module.exports = ({ port }) => {
  return new Promise((resolve, reject) => {
    const input = createReadStream(__filename);
    const stream = new PortDuplex(port, { readable: false });
    pipeline(input, createGzip(), stream, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
};
