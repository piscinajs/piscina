module.exports = async function* ({ length = 5, throwNext = false } = {}) {
  const median = Math.floor(length / 2);
  for (let i = 0; i < length; i++) {
    if (throwNext && i === median) {
      throw new Error('Thrown error');
    }

    yield Buffer.from(`${i}`);
  }
};
