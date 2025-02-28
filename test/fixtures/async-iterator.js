const { createReadStream } = require('node:fs')
const { resolve } = require('node:path')

const stream = createReadStream(
  resolve(__dirname, '../fixtures/iterator.js')
)

// module.exports = async function* ({ length = 5, throwNext = false } = {}) {
//   for await (const chunk of stream) {
//     yield chunk
//     process._rawDebug('>> async-iterator.js - chunk: ', chunk)
//   }
// }

module.exports = async function* ({ length = 5, throwNext = false } = {}) {
  const median = Math.floor(length / 2);
  for (let i = 0; i < length; i++) {
    if (throwNext && i === median) {
      throw new Error('Thrown error');
    }

    yield Buffer.from(`${i}`);
    // yield `${i}`;
  }
};
