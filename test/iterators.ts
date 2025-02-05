import { Readable } from 'node:stream';
import { resolve } from 'node:path';

import { test } from 'tap';

import Piscina from '..';

test('should support iterator', (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures', 'iterator.js'),
  });

  t.plan(1);
  pool.run({ length: 10 }).then((red: Readable) => {
    const chunks: Buffer[] = [];
    red.on('data', (chunk) => {
      chunks.push(chunk);
    });

    red.on('end', () => {
      t.equal(Buffer.concat(chunks).toString('utf-8'), '0123456789');
    });
  });
});

test('should handle iterator throw', (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures', 'iterator.js'),
  });

  t.plan(2);
  pool.run({ length: 5, throwNext: true }).then((red: Readable) => {
    const chunks: Buffer[] = [];
    red.on('data', (chunk) => {
      chunks.push(chunk);
    });
    
    red.on('error', (err) => {
      t.equal(err.message, 'Thrown error');
      t.equal(Buffer.concat(chunks).toString('utf-8'), '01');
    });
  });
});

test('should handle iterator throw (async)', (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures', 'async-iterator.js'),
  });

  t.plan(2);
  pool.run({ length: 5, throwNext: true }).then((red: Readable) => {
    const chunks: Buffer[] = [];
    red.on('data', (chunk) => {
      chunks.push(chunk);
    });
    
    red.on('error', (err) => {
      t.equal(err.message, 'Thrown error');
      t.equal(Buffer.concat(chunks).toString('utf-8'), '01');
    });
  });
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
      t.equal(Buffer.concat(chunks).toString('utf-8'), '0123456789');
    });
  });
});
