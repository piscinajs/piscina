const AsyncSimpleBench = require('./async')
const SimpleBench = require('./simple')

module.exports = (suite, scope = 'simple') => {
  switch (scope) {
    case 'async':
      return AsyncSimpleBench(suite)
    case 'simple':
      return SimpleBench(suite)
    default:
      return SimpleBench(AsyncSimpleBench(suite))
  }
}
