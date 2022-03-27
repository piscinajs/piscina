'use strict';

const Piscina = require('../../dist/src');
const { resolve } = require('path');

const piscina = new Piscina({
  filename: resolve(__dirname, 'worker.js')
});

(async function () {
  piscina.on('message', (event) => {
      console.log("Messsage received from worker: ", event);
  });

  await piscina.run();
})();
