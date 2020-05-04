// Require the framework and instantiate it
const fastify = require('fastify')();
const { promisify } = require('util');
const sleep = promisify(setTimeout);

// Declare a route
fastify.get('/', async () => {
  await sleep(100);
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
