import { Piscina } from 'piscina';

const piscina = new Piscina({
  filename: new URL('./worker.mjs', import.meta.url).href
});

(async function() {
  const result = await piscina.runTask({ a: 4, b: 6 });
  console.log(result);  // Prints 10
})();
