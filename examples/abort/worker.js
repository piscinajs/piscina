const { promisify } = require('util');
const sleep = promisify(setTimeout);

module.exports = async ({ a, b }) => {
  await sleep(10000);
  return a + b;
};
