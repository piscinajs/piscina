'use strict';
const { EventEmitter } = require('events');

class Progress extends EventEmitter {
  #tasksSubmitted = 0;
  #tasksCompleted = 0;
  #tasksFailed = 0;
  #done = false;

  done () {
    this.#done = true;
  }

  incSubmitted () {
    this.#tasksSubmitted++;
  }

  incCompleted () {
    this.#tasksCompleted++;
    if (this.#done && this.completed === this.#tasksSubmitted) {
      process.nextTick(() => this.emit('finished'));
    }
  }

  incFailed () {
    this.#tasksFailed++;
  }

  get completed () {
    return this.#tasksCompleted + this.#tasksFailed;
  }

  get message () {
    return `${this.#tasksCompleted} of ${this.#tasksSubmitted} completed` +
      ` ${((this.#tasksCompleted / this.#tasksSubmitted) * 100).toFixed(2)}%` +
      ` [${this.#tasksFailed} failed]`;
  }
};

module.exports = Progress;
