const { threadId } = require('node:worker_threads');

// This fixture receives a delay and returns worker execution details
module.exports = async function(delayMs) {
  // Simulate some work to ensure worker saturation in tests
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  await delay(delayMs);
  
  return {
    threadId,
    timestamp: Date.now()
  };
};
