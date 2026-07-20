import { Piscina } from 'piscina';

const piscina = new Piscina({
  filename: new URL('./worker.mjs', import.meta.url).href
});

const result = await piscina.run({ a: 4, b: 6 });
console.log(result); // Prints 10
