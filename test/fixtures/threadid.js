'use strict';
const { threadId } = require('worker_threads');

module.exports = function (input) {
  let res;
  const promise = new Promise((resolve) => {
    res = resolve;
  });

  setTimeout(() => {
    res({ input, threadId });
  }, 500);
  return promise;
};
