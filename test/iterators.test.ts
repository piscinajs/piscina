import { Readable } from 'node:stream';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { once } from 'node:events';

import Piscina from '..';

test('should handle iterator throw', async (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures', 'iterator.js'),
  });

  t.plan(1);
  const [result] = await once(await pool.run({ length: 5, throwNext: true }), 'error');
  t.assert.equal(result.message, 'Thrown error');
});

test('should handle iterator throw (async)', async (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures', 'async-iterator.js'),
  });

  t.plan(1);
  const [result] = await once(await pool.run({ length: 5, throwNext: true }), 'error');
  t.assert.equal(result.message, 'Thrown error');
});

test('should support iterator with custom buffer size', (t, done) => {
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
      t.assert.equal(Buffer.concat(chunks).toString('utf-8'), '0123456789');
      done();
    });
  });
});

test('should throw with custom buffer size not valid', (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures', 'iterator.js'),
  });

  t.plan(5);
  t.assert.rejects(pool.run({}, { bufferSize: Infinity }));
  // @ts-expect-error
  t.assert.rejects(pool.run({}, { bufferSize: '1' }));
  t.assert.rejects(pool.run({}, { bufferSize: 0 }));
  t.assert.rejects(pool.run({}, { bufferSize: -1 }));
  t.assert.rejects(pool.run({}, { bufferSize: 0.1 }));
});

// Time to adjust and test
test('should support iterator', async (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures', 'iterator.js'),
  });

  t.after(pool.close.bind(pool));
  t.plan(1);
  const redeable = await pool.run({ length: 10 });

  let chunks = '';
  for await (const chunk of redeable) {
    chunks += chunk;
  }

  t.assert.equal(chunks, '0123456789');
});

test('should support async iterator', async (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures', 'async-iterator.js'),
  });

  t.plan(1);
  t.after(() => pool.close());
  const redeable = await pool.run({ length: 10 });
  let chunks = '';
  redeable.setEncoding('utf-8');

  for await (const chunk of redeable) {
    chunks += chunk;
  }

  t.assert.equal(chunks, '0123456789');
});

// TODO: flaky tests. Research and enable it later
test('should throw on invalid output (async)', { only: true }, async (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures', 'bad-iterators.js'),
  });

  t.plan(4);
  t.after(pool.close.bind(pool));

  await t.assert.rejects(async () => {
    const read = await pool.run('', { name: 'asyncIterator' });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _chunk of read) { /* empty */ }
  }, new TypeError('(Async)Iterators should only return string, buffer or typed arrays'));

  await t.assert.rejects(async () => {
    const read = await pool.run('', { name: 'asyncIterator2' });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _chunk of read) { /* empty */ }
  }, new TypeError('(Async)Iterators should only return string, buffer or typed arrays'));

  await t.assert.rejects(async () => {
    const read = await pool.run('', { name: 'asyncIterator3' });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _chunk of read) { /* empty */ }
  }, new TypeError('(Async)Iterators should only return string, buffer or typed arrays'));

  await t.assert.rejects(async () => {
    const read = await pool.run('', { name: 'asyncIterator4' });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _chunk of read) { /* empty */ }
  }, new TypeError('(Async)Iterators should only return string, buffer or typed arrays'));
});

// TODO: flaky tests. Research and enable it later
test('should throw on invalid output', { only: true }, async (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures', 'bad-iterators.js'),
    // concurrentTasksPerWorker: 4,
  });

  t.plan(4);
  await t.assert.rejects(async () => {
    const read = await pool.run('', { name: 'syncIterator' });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _chunk of read) { /* empty */ }
  }, new TypeError('(Async)Iterators should only return string, buffer or typed arrays'));

  await t.assert.rejects(async () => {
    const read = await pool.run('', { name: 'syncIterator2' });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _chunk of read) { /* empty */ }
  }, new TypeError('(Async)Iterators should only return string, buffer or typed arrays'));

  await t.assert.rejects(async () => {
    const read = await pool.run('', { name: 'syncIterator3' });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _chunk of read) { /* empty */ }
  }, new TypeError('(Async)Iterators should only return string, buffer or typed arrays'));

  await t.assert.rejects(async () => {
    const read = await pool.run('', { name: 'syncIterator4' });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _chunk of read) { /* empty */ }
  }, new TypeError('(Async)Iterators should only return string, buffer or typed arrays'));
});
