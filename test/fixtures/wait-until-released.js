'use strict';

// A worker whose readiness and task execution the main thread can release on
// demand, letting a test deterministically hold a worker in the pending state
// or keep one busy.
//
// The worker shares an Int32Array with the main thread (passed as workerData).
// Each slot is a gate: the worker blocks on Atomics.wait until the main thread
// stores a non-zero value into that slot and notifies.
//
// The readiness gate is awaited at module top level. A worker is only marked
// ready once its module finishes loading, so blocking here keeps it pending
// until the main thread lets it through. The task gate then holds a running
// task until released. The returned threadId lets a test see which worker ran
// a task.

const { threadId, workerData } = require('node:worker_threads');

const READY_GATE = 0;
const TASK_GATE = 1;

const gates = new Int32Array(workerData);

Atomics.wait(gates, READY_GATE, 0);

module.exports = ({ hold = false } = {}) => {
  if (hold) {
    Atomics.wait(gates, TASK_GATE, 0);
  }
  return threadId;
};
