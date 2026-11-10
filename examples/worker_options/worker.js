'use strict';

const Piscina = require('../..');
const { format } = require('util');

module.exports = ({ a, b }) => {
  console.log(`
process.argv: ${process.argv.slice(2)}
process.execArgv: ${process.execArgv}
process.env: ${format({ ...process.env })}
workerData: ${Piscina.workerData}`);
  return a + b;
};
