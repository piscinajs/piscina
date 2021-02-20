function makeTask (op, ...args) {
  return { op, args };
}

function dispatcher (obj) {
  return async ({ op, args }) => {
    return await obj[op](...args);
  };
}

module.exports = {
  dispatcher,
  makeTask
};
