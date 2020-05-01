'use strict';

const { createReadStream } = require('fs');
const parse = require('csv-parse');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);
const Piscina = require('../../dist/src');
const { resolve } = require('path');

const { performance, PerformanceObserver } = require('perf_hooks')
const obs = new PerformanceObserver((entries) => {
  console.error(entries.getEntries()[0].duration)
});
obs.observe({ entryTypes: ['measure']});

const piscina = new Piscina({
  filename: resolve(__dirname, 'predict.js')
});

const input = createReadStream('./pitch_type_test_data.csv');

class Nil extends stream.Writable {
  _write(chunk, encoding, callback) { callback(); }
}

class T extends stream.Transform {
  constructor() {
    super({
      writableObjectMode: true,
      readableObjectMode: false
    })
  }

  _transform(chunk, encoding, callback) {
    const sample = chunk.slice(0, -1).map(parseFloat);
    piscina.runTask({ sample })
      .then((prediction) => {
        this.push(`${prediction}\n`);
        callback();
      }).catch((err) => callback(err))
  }
}

(async function go() {
  performance.mark('A');
  await pipeline(input, new parse({from_line:2}), new T(), new Nil());
  performance.mark('B');
  performance.measure('A to B', 'A', 'B');
})();

