module.exports = function(code) { return eval(code); }

// Sigh. Hack around https://github.com/evanw/node-source-map-support/pull/269
// by uninstalling the broken source-map-support shim.
delete process.emit;
