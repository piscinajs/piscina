'use strict';
const { parentPort } = require('worker_threads')

module.exports = () => {
    parentPort.postMessage('hello from the worker pool');
};
