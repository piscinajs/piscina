const { join } = require('path');
module.exports = require('node-gyp-build')(join(__dirname, '..'));
