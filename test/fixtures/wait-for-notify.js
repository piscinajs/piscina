module.exports = function (i32array) {
  Atomics.wait(i32array, 0, 0);
  Atomics.store(i32array, 0, -1);
  Atomics.notify(i32array, 0, Infinity);
};
