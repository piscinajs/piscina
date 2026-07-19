const tasks = [];

module.exports = {
  run: task => {
    tasks.push(task);
  },
  getLog: () => tasks
};
