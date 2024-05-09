const { Bench } = require('tinybench');
const { Piscina, FixedQueue, ArrayTaskQueue } = require('..');
const { resolve } = require('node:path');

const QUEUE_SIZE = 100_000;

const bench = new Bench({ time: 100 });

bench
  .add('Piscina with ArrayTaskQueue', async () => {
    const queue = new ArrayTaskQueue();
    const pool = new Piscina({
      filename: resolve(__dirname, 'fixtures/add.js'),
      taskQueue: queue
    });
    const tasks = [];
    for (let i = 0; i < QUEUE_SIZE; i++) {
      tasks.push(pool.runTask({ a: 4, b: 6 }));
    }
    await Promise.all(tasks);
    await pool.destroy();
  })
  .add('Piscina with FixedQueue', async () => {
    const queue = new FixedQueue();
    const pool = new Piscina({
      filename: resolve(__dirname, 'fixtures/add.js'),
      taskQueue: queue
    });
    const tasks = [];
    for (let i = 0; i < QUEUE_SIZE; i++) {
      tasks.push(pool.runTask({ a: 4, b: 6 }));
    }
    await Promise.all(tasks);
    await pool.destroy();
  });

(async () => {
  await bench.warmup();
  await bench.run();

  console.table(bench.table());
})();
