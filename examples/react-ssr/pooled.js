'use strict';

const fastify = require('fastify')();
const Piscina = require('../..');
const { resolve } = require('path');

const pool = new Piscina({
  filename: resolve(__dirname, 'worker.js'),
  execArgv: []
});

// Declare a route
fastify.get('/', async () => {
  const p = pool.runTask({ name: 'James' });
  return await p;
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
