import { Readable } from 'node:stream';
import { resolve } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import Piscina from '..';

test('should handle iterator throw', (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures', 'iterator.js'),
  });

  t.plan(1);
  pool.run({ length: 5, throwNext: true }).then((stream: Readable) => {
    stream.on('error', (err) => {
      assert.equal(err.message, 'Thrown error');
    });
  });
});

test('should handle iterator throw (async)', (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures', 'async-iterator.js'),
  });

  t.plan(1);
  pool.run({ length: 5, throwNext: true }).then((stream: Readable) => {
    stream.on('error', (err) => {
      assert.equal(err.message, 'Thrown error');
    });
  });
});

test('should support iterator with custom buffer size', (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures', 'iterator.js'),
  });

  t.plan(1);
  pool.run({ length: 10 }, { bufferSize: 100 }).then((red: Readable) => {
    const chunks: Buffer[] = [];
    red.on('data', (chunk) => {
      chunks.push(chunk);
    });

    red.on('end', () => {
      assert.equal(Buffer.concat(chunks).toString('utf-8'), '0123456789');
    });
  });
});

test('should throw with custom buffer size not valid', (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures', 'iterator.js'),
  });

  t.plan(5);
  assert.rejects(pool.run({}, { bufferSize: Infinity }));
  // @ts-expect-error
  assert.rejects(pool.run({}, { bufferSize: '1' }));
  assert.rejects(pool.run({}, { bufferSize: 0 }));
  assert.rejects(pool.run({}, { bufferSize: -1 }));
  assert.rejects(pool.run({}, { bufferSize: 0.1 }));
});

// Time to adjust and test
test('should support iterator', { only: true }, async (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures', 'iterator.js'),
  });

  t.plan(1);
  const redeable = (await pool.run({ length: 10 })).setEncoding('utf-8');

  let chunks = '';
  for await (const chunk of redeable) {
    chunks += chunk;
  }

  assert.equal(chunks, '0123456789')
});

test('should support async iterator', (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures', 'async-iterator.js'),
  });

  t.plan(1);
  pool.run({ length: 10 }).then((red: Readable) => {
    const chunks: Buffer[] = [];
    red.on('data', (chunk) => {
      chunks.push(chunk);
    });

    red.on('end', () => {
      assert.equal(Buffer.concat(chunks).toString('utf-8'), '0123456789');
    });
  });
});

test('should throw on invalid output (async)', (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures', 'bad-iterators.js'),
  });

  t.plan(5);
  pool.run('', { name: 'asyncIterator' }).then((red: Readable) => {
    red.on('error', (err) => {
      assert.equal(
        err.message,
        'AsyncIterators should only return string, buffer or typed arrays'
      );
    });
  });
  pool.run('', { name: 'asyncIterator2' }).then((red: Readable) => {
    red.on('error', (err) => {
      assert.equal(
        err.message,
        'AsyncIterators should only return string, buffer or typed arrays'
      );
    });
  });
  pool.run('', { name: 'asyncIterator3' }).then((red: Readable) => {
    red.on('error', (err) => {
      assert.equal(
        err.message,
        'AsyncIterators should only return string, buffer or typed arrays'
      );
    });
  });
  pool.run('', { name: 'asyncIterator4' }).then((stream: Readable) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => {
      chunks.push(chunk);
    });

    stream.on('error', (err) => {
      assert.equal(
        err.message,
        'AsyncIterators should only return string, buffer or typed arrays'
      );
      assert.equal(chunks.length, 0);
    });
  });
});

test('should throw on invalid output', (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures', 'bad-iterators.js'),
  });

  t.plan(4);
  pool.run('', { name: 'syncIterator' }).then((stream: Readable) => {
    stream.on('error', (err) => {
      assert.equal(
        err.message,
        'AsyncIterators should only return string, buffer or typed arrays'
      );
    });
  });
  pool.run('', { name: 'syncIterator2' }).then((red: Readable) => {
    red.on('error', (err) => {
      assert.equal(
        err.message,
        'AsyncIterators should only return string, buffer or typed arrays'
      );
    });
  });
  pool.run('', { name: 'syncIterator3' }).then((red: Readable) => {
    red.on('error', (err) => {
      assert.equal(
        err.message,
        'AsyncIterators should only return string, buffer or typed arrays'
      );
    });
  });
  pool.run('', { name: 'syncIterator4' }).then((red: Readable) => {
    red.on('error', (err) => {
      assert.equal(
        err.message,
        'AsyncIterators should only return string, buffer or typed arrays'
      );
    });
  });
});
