module.exports = function(i32array) {
  Atomics.wait(i32array, 0, 0);
}
