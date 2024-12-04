import assert from 'node:assert';

import type { TaskQueue, Task } from '.';

export class ArrayTaskQueue implements TaskQueue {
  tasks: Task[] = []

  get size () {
    return this.tasks.length;
  }

  shift (): Task | null {
    return this.tasks.shift() ?? null;
  }

  push (task: Task): void {
    this.tasks.push(task);
  }

  remove (task: Task): void {
    const index = this.tasks.indexOf(task);
    assert.notStrictEqual(index, -1);
    this.tasks.splice(index, 1);
  }
}
