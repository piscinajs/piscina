const { availableParallelism } = require('node:os')
const tasksPerWorker = Math.max(1, Math.floor(availableParallelism() / 2))

module.exports = {
  tasksPerWorker,
  minThreads: Math.min(tasksPerWorker, 2),
  maxThreads: availableParallelism() * 1.5
}
