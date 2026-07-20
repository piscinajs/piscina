// worker.js
const vm = require('node:vm');

module.exports = ({ payload, context }) => {
  const script = new vm.Script(payload);
  script.runInNewContext(context);
};
