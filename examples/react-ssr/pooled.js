'use strict';

const fastify = require('fastify')();
const { resolve } = require('path');

fastify.register(require('fastify-piscina'), {
  filename: resolve(__dirname, 'worker.js'),
  execArgv: [],
  minThreads: 6,
  maxThreads: 6
});

// Declare a route
fastify.get('/', async () => fastify.run({ name: 'James' }));

// Run the server!
const start = async () => {
  try {
    await fastify.listen(3000);
  } catch (err) {
    process.exit(1);
  }
};
start();

process.on('SIGINT', () => {
  const waitTime = fastify.piscina.waitTime;
  console.log('\nMax Queue Wait Time:', waitTime.max);
  console.log('Mean Queue Wait Time:', waitTime.mean);
  process.exit(0);
});
