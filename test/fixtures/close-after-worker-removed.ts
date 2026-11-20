import { resolve } from 'node:path';
import Piscina from '../..';

const pool = new Piscina({
  filename: resolve(__dirname, 'eval.js'),
  minThreads: 2,
  maxThreads: 2,
  closeTimeout: 2000
});
pool.on('error', (err) => console.log(`error: ${err.message}`));

const ee = new AbortController();
pool.run('new Promise(resolve => setTimeout(resolve, 500))', { signal: ee.signal }).catch(() => {});
pool.run('new Promise(resolve => setTimeout(resolve, 100))');
// More than the remaining worker can take at once.
const queued = [1, 2, 3].map((n) => pool.run(`${n}`));

pool.close().then(async () => {
  console.log(`closed ${JSON.stringify(await Promise.all(queued))}`);
});
// Removes a worker while close() is waiting.
setTimeout(() => ee.abort(), 20);
