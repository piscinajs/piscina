const Piscina = require('../..');
const { resolve } = require('path');

const pool = new Piscina({
  filename: resolve(__dirname, 'worker.js'),
  idleTimeout: 1000
});

(async () => {
  // The task will transfer an ArrayBuffer
  // back to the main thread rather than
  // cloning it.
  const u8 = await pool.runTask();
  console.log(u8.length);
})();
