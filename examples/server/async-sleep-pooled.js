'use strict';

const fastify = require('fastify')();
const { resolve } = require('path');
const Piscina = require('../..');

const concurrentTasksPerWorker = parseInt(process.argv[2] || 1);
const idleTimeout = parseInt(process.argv[3] || 0);

const pool = new Piscina({
  filename: resolve(__dirname, 'worker.js'),
  concurrentTasksPerWorker,
  idleTimeout
});

// Declare a route
fastify.get('/', async () => {
  return pool.runTask();
});

// Run the server!
const start = async () => {
  try {
    await fastify.listen(3000);
  } catch (err) {
    process.exit(1);
  }
};
start();
