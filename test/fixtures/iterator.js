// eslint-disable-next-line no-eval
module.exports = function* ({ length, throwNext }) {
  const median = Math.floor(length / 2);
  for (let i = 0; i < length; i++) {
    if (throwNext && i === median) {
      throw new Error('Thrown error');
    }

    yield `${i}`;
  }
};
