import { Readable } from 'node:stream';
import { resolve } from 'node:path';

import { test } from 'tap';

import Piscina from '..';

test('should support iterator', (t) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures', 'iterator.js'),
  });

  t.plan(1);
  pool.run(10).then((red: Readable) => {
    const chunks: Buffer[] = [];
    red.on('data', (chunk) => {
      chunks.push(chunk);
    });

    red.on('end', () => {
      t.equal(Buffer.concat(chunks).toString('utf-8'), '0123456789');
    });
  });
});
