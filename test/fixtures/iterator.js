// eslint-disable-next-line no-eval
module.exports = function* (length = 5) {
  for (let i = 0; i < length; i++) {
    yield `${i}`
  }
}
