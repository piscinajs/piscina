'use strict';

module.exports = function (input) {
  let res;
  const promise = new Promise((resolve) => {
    res = resolve;
  });

  setTimeout(() => {
    res({ input, threadId: process.env.PISCINA_THREAD_ID });
  }, 500);
  return promise;
};
