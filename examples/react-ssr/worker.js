'use strict';

const React = require('react');
const ReactDOMServer = require('react-dom/server');

const { Greeting, Lorem } = require('./components');

module.exports = ({ name }) => {
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
};
