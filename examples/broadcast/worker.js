'use strict';
const { BroadcastChannel } = require('worker_threads');

module.exports = async (thread) => {
  const bc = new BroadcastChannel('my_channel');
  bc.onmessage = (event) => {
    console.log(thread + ' Received from:' + event.data);
  };
  await new Promise((resolve) => {
    setTimeout(resolve, 2000);
  });
};
