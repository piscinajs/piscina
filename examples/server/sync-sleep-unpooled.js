// Require the framework and instantiate it
const fastify = require('fastify')();

const sab = new SharedArrayBuffer(4);
const lock = new Int32Array(sab);

// Declare a route
fastify.get('/', async () => {
  Atomics.wait(lock, 0, 0, 100);
  return { hello: 'world' };
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
