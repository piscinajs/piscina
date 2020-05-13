'use strict';

const fastify = require('fastify')();

const React = require('react');
const ReactDOMServer =  require('react-dom/server');
const { Greeting, Lorem } = require('./components');

// Declare a route
fastify.get('/', async () => {
  const name = "James";
  return `
  <!doctype html>
    <html>
    <body>
    <div id="root">${
      ReactDOMServer.renderToString(React.createElement(Greeting, { name }))
    }</div>
    ${
      ReactDOMServer.renderToString(React.createElement(Lorem))
    }
    <script src="/static/home.js"></script>
  </body>
  </html>`;
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
