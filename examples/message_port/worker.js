'use strict';

module.exports = ({ port }) => {
  port.postMessage('hello from the worker pool');
};
