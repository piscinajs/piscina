import { Readable } from 'node:stream';
import { resolve } from 'node:path';

import { test } from 'tap';

import Piscina from '..';


test('should handle iterator throw', { only: true }, (t) => {
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
    // atomics: 'async'
  });

  t.plan(1);
  pool.run({ length: 10 }).then((red: Readable) => {
    const chunks: Buffer[] = [];
    red.on('data', (chunk) => {
      chunks.push(chunk.toString('utf-8'));
      console.log(chunks)
    });

    red.on('end', () => {
      t.equal(Buffer.concat(chunks).toString('utf-8'), '0123456789');
    });
  });
});

test('should throw on invalid output (async)', (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures', 'bad-iterators.js'),
  });

  t.plan(7);
  pool.run('', { name: 'asyncIterator' }).then((red: Readable) => {
    const chunks: Buffer[] = [];
    red.on('data', (chunk) => {
      chunks.push(chunk);
    });

    red.on('error', (err) => {
      t.equal(
        err.message,
        'AsyncIterators should only return string, buffer or typed arrays'
      );
      t.equal(Buffer.concat(chunks).toString('utf-8'), '1');
    });
  });
  pool.run('', { name: 'asyncIterator2' }).then((red: Readable) => {
    const chunks: Buffer[] = [];
    red.on('data', (chunk) => {
      chunks.push(chunk);
    });

    red.on('error', (err) => {
      t.equal(
        err.message,
        'AsyncIterators should only return string, buffer or typed arrays'
      );
      t.equal(Buffer.concat(chunks).toString('utf-8'), '1');
    });
  });
  pool.run('', { name: 'asyncIterator3' }).then((red: Readable) => {
    const chunks: Buffer[] = [];
    red.on('data', (chunk) => {
      chunks.push(chunk);
    });

    red.on('error', (err) => {
      t.equal(
        err.message,
        'AsyncIterators should only return string, buffer or typed arrays'
      );
      t.equal(Buffer.concat(chunks).toString('utf-8'), '1');
    });
  });
  pool.run('', { name: 'asyncIterator4' }).then(
    () => {
      t.fail('should not succeed');
    },
    (err) => {
      t.equal(
        err.message,
        'AsyncIterators should only return string, buffer or typed arrays'
      );
    }
  );
});

test('should throw on invalid output', (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures', 'bad-iterators.js'),
  });

  t.plan(7);
  pool.run('', { name: 'syncIterator' }).then(
    () => {
      t.fail('should not succeed');
    },
    (err) => {
      t.equal(
        err.message,
        'AsyncIterators should only return string, buffer or typed arrays'
      );
    }
  );
  pool.run('', { name: 'syncIterator2' }).then((red: Readable) => {
    const chunks: Buffer[] = [];
    red.on('data', (chunk) => {
      chunks.push(chunk);
    });

    red.on('error', (err) => {
      t.equal(
        err.message,
        'AsyncIterators should only return string, buffer or typed arrays'
      );
      t.equal(Buffer.concat(chunks).toString('utf-8'), '1');
    });
  });
  pool.run('', { name: 'syncIterator3' }).then((red: Readable) => {
    const chunks: Buffer[] = [];
    red.on('data', (chunk) => {
      chunks.push(chunk);
    });

    red.on('error', (err) => {
      t.equal(
        err.message,
        'AsyncIterators should only return string, buffer or typed arrays'
      );
      t.equal(Buffer.concat(chunks).toString('utf-8'), '1');
    });
  });
  pool.run('', { name: 'syncIterator4' }).then((red: Readable) => {
    const chunks: Buffer[] = [];
    red.on('data', (chunk) => {
      chunks.push(chunk);
    });

    red.on('error', (err) => {
      t.equal(
        err.message,
        'AsyncIterators should only return string, buffer or typed arrays'
      );
      t.equal(Buffer.concat(chunks).toString('utf-8'), '1');
    });
  });
});
