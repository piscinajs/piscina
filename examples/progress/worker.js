const { setTimeout } = require('timers/promises');

module.exports = async ({ a, b, port }) => {
  for (let n = a; n < b; n++) {
    await setTimeout(10);
    port.postMessage(n);
  }
  port.close();
};
