import { Piscina } from 'piscina';

const pool = new Piscina({
  filename: new URL('./worker.mjs', import.meta.url).href
});

console.log(await Promise.all([
  pool.run({ a: 2, b: 3 }, { name: 'add' }),
  pool.run({ a: 2, b: 3 }, { name: 'multiply' })
]));
