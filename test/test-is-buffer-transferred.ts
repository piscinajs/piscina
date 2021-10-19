import Piscina from '../dist/src';
import { test } from 'tap';
import { resolve } from 'path';

function wait() {
  return new Promise(res => setTimeout(res, 1250));
}

test('transferable objects must be transferred', async ({ not }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/send-buffer-then-get-length.js'),
    useAtomics: false
  });
  await pool.run({}, { name: 'send' });
  await wait();
  const { initial, after } = await pool.run({}, { name: 'get' });
  not(initial, after);
});

test('objects that implement transferable must be transferred', async ({ not }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/send-transferrable-then-get-length.js'),
    useAtomics: false
  });
  await pool.run({}, { name: 'send' });
  await wait();
  const { initial, after } = await pool.run({}, { name: 'get' });
  not(initial, after);
});
