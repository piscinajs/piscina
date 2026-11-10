const { move } = require('../..');

module.exports = () => {
  // Using move causes the Uint8Array to be
  // transferred rather than cloned.
  return move(new Uint8Array(10));
};
