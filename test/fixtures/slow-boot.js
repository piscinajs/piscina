// Delays the Worker's READY message by ~300 ms.
const start = Date.now();
while (Date.now() - start < 300);

module.exports = require('./eval.js');
