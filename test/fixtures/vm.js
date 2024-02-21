// worker.js
const vm = require('vm');

module.exports = ({ payload, context }) => {
  const script = new vm.Script(payload);
  script.runInNewContext(context);
};
