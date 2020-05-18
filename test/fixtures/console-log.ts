import Piscina from '../..';
import { resolve } from 'path';

const pool = new Piscina({
  filename: resolve(__dirname, 'eval.js'),
  maxThreads: 1
});

pool.runTask('console.log("A"); console.log("B");');
