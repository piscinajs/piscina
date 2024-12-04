import Piscina from '../..';
import { resolve } from 'path';

const pool = new Piscina({
  filename: resolve(__dirname, 'eval.js'),
  maxThreads: 1,
  env: {
    PISCINA_ENABLE_ASYNC_ATOMICS: process.env.PISCINA_ENABLE_ASYNC_ATOMICS
  }
});

pool.run('console.log("A"); console.error("B");');
