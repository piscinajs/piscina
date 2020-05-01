'use strict';

module.exports = () => {
  const array = [];
  while (true) {
    for (let i = 0; i < 100; i++) {
      array.push([array]);
    }
  }
};
