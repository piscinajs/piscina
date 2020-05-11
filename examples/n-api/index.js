const Piscina = require('piscina');
const { resolve } = require('path');

const pool = new Piscina({
  filename: resolve(__dirname, 'example')
});

(async () => {
  console.log(await Promise.all([
    pool.runTask(),
    pool.runTask(),
    pool.runTask(),
    pool.runTask(),
    pool.runTask()
  ]));
})();
