const { Bench } = require('tinybench');
const FixedQeueue = require('../dist/src/fixed-queue').default;
const { ArrayTaskQueue } = require('../dist/src/index');

const QUEUE_SIZE = 100_000;

const bench = new Bench({ time: 100 });

bench
  .add('ArrayTaskQueue full push + full shift', async () => {
    const queue = new ArrayTaskQueue();
    for (let i = 0; i < QUEUE_SIZE; i++) {
      queue.push(i);
    }
    for (let i = 0; i < QUEUE_SIZE; i++) {
      queue.shift();
    }
  })
  .add('FixedQueue full push + full shift', async () => {
    const queue = new FixedQeueue();
    for (let i = 0; i < QUEUE_SIZE; i++) {
      queue.push(i);
    }
    for (let i = 0; i < QUEUE_SIZE; i++) {
      queue.shift();
    }
  });

(async () => {
  await bench.warmup();
  await bench.run();

  console.table(bench.table());
})();
