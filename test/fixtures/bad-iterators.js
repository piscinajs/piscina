// eslint-disable-next-line no-eval
module.exports = {
  asyncIterator: async function* () {
    yield Buffer.from('1');
    yield 2;
  },
  asyncIterator2: async function* () {
    yield new Int8Array([0x31]);
    yield new Int8Array([0x31]);
    yield new Int8Array([0x31]);
    yield new Int8Array([0x31]);
    yield {}
  },
  asyncIterator3: async function* () {
    yield '1';
    yield []
  },
  asyncIterator4: async function* () {
    yield new Set();
  },
  syncIterator: function* () {
    yield {};
  },
  syncIterator2: async function* () {
    yield new Int8Array([0x31]);
    yield {}
  },
  syncIterator3: async function* () {
    yield '1';
    yield []
  },
  syncIterator4: async function* () {
    yield Buffer.from('1');
    yield 2;
  },
};
