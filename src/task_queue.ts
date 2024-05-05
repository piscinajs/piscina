import assert from 'node:assert';

import type { Task } from './types';

export interface TaskQueue {
  readonly size: number;
  shift(): Task | null;
  remove(task: Task): void;
  push(task: Task): void;
}

export class ArrayTaskQueue implements TaskQueue {
  tasks: Task[] = [];

  get size () {
    return this.tasks.length;
  }

  shift (): Task | null {
    return this.tasks.shift() as Task;
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

/**
 * Verifies if a given TaskQueue is valid
 *
 * @export
 * @param {*} value
 * @return {*}  {boolean}
 */
export function isTaskQueue (value: TaskQueue): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'size' in value &&
    typeof value.shift === 'function' &&
    typeof value.remove === 'function' &&
    typeof value.push === 'function'
  );
}
