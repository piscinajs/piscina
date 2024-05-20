/*
 * Modified Fixed Queue Implementation based on the one from Node.js Project
 * License: MIT License
 * Source: https://github.com/nodejs/node/blob/de7b37880f5a541d5f874c1c2362a65a4be76cd0/lib/internal/fixed_queue.js
 */
import assert from 'node:assert';
import { TaskQueue } from './task_queue';
import { Task } from './types';
// Currently optimal queue size, tested on V8 6.0 - 6.6. Must be power of two.
const kSize = 2048;
const kMask = kSize - 1;

// The FixedQueue is implemented as a singly-linked list of fixed-size
// circular buffers. It looks something like this:
//
//  head                                                       tail
//    |                                                          |
//    v                                                          v
// +-----------+ <-----\       +-----------+ <------\         +-----------+
// |  [null]   |        \----- |   next    |         \------- |   next    |
// +-----------+               +-----------+                  +-----------+
// |   item    | <-- bottom    |   item    | <-- bottom       |  [empty]  |
// |   item    |               |   item    |                  |  [empty]  |
// |   item    |               |   item    |                  |  [empty]  |
// |   item    |               |   item    |                  |  [empty]  |
// |   item    |               |   item    |       bottom --> |   item    |
// |   item    |               |   item    |                  |   item    |
// |    ...    |               |    ...    |                  |    ...    |
// |   item    |               |   item    |                  |   item    |
// |   item    |               |   item    |                  |   item    |
// |  [empty]  | <-- top       |   item    |                  |   item    |
// |  [empty]  |               |   item    |                  |   item    |
// |  [empty]  |               |  [empty]  | <-- top  top --> |  [empty]  |
// +-----------+               +-----------+                  +-----------+
//
// Or, if there is only one circular buffer, it looks something
// like either of these:
//
//  head   tail                                 head   tail
//    |     |                                     |     |
//    v     v                                     v     v
// +-----------+                               +-----------+
// |  [null]   |                               |  [null]   |
// +-----------+                               +-----------+
// |  [empty]  |                               |   item    |
// |  [empty]  |                               |   item    |
// |   item    | <-- bottom            top --> |  [empty]  |
// |   item    |                               |  [empty]  |
// |  [empty]  | <-- top            bottom --> |   item    |
// |  [empty]  |                               |   item    |
// +-----------+                               +-----------+
//
// Adding a value means moving `top` forward by one, removing means
// moving `bottom` forward by one. After reaching the end, the queue
// wraps around.
//
// When `top === bottom` the current queue is empty and when
// `top + 1 === bottom` it's full. This wastes a single space of storage
// but allows much quicker checks.

class FixedCircularBuffer {
  bottom: number
  top: number
  list: Array<Task | undefined>
  next: FixedCircularBuffer | null
  _size: number

  constructor () {
    this.bottom = 0;
    this.top = 0;
    this.list = new Array(kSize);
    this.next = null;
    this._size = 0;
  }

  isEmpty () {
    return this.top === this.bottom && this._size === 0;
  }

  isFull () {
    return this.top === this.bottom && this._size === kSize;
  }

  push (data:Task) {
    this.list[this.top] = data;
    this.top = (this.top + 1) & kMask;
    this._size++;
  }

  shift () {
    const nextItem = this.list[this.bottom];
    if (nextItem === undefined) { return null; }
    this.list[this.bottom] = undefined;
    this.bottom = (this.bottom + 1) & kMask;
    this._size--;
    return nextItem;
  }

  remove (task: Task) {
    const indexToRemove = this.list.indexOf(task);

    assert.notStrictEqual(indexToRemove, -1);
    let curr = indexToRemove;
    while (true) {
      const next = (curr + 1) & kMask;
      this.list[curr] = this.list[next];
      if (this.list[curr] === undefined) {
        break;
      }
      if (next === indexToRemove) {
        this.list[curr] = undefined;
        break;
      }
      curr = next;
    }
    this.top = (this.top - 1) & kMask;
    this._size--;
  }
}

export default class FixedQueue implements TaskQueue {
  head: FixedCircularBuffer
  tail: FixedCircularBuffer
  _size: number = 0

  constructor () {
    this.head = this.tail = new FixedCircularBuffer();
  }

  isEmpty () {
    return this.head.isEmpty();
  }

  push (data:Task) {
    if (this.head.isFull()) {
      // Head is full: Creates a new queue, sets the old queue's `.next` to it,
      // and sets it as the new main queue.
      this.head = this.head.next = new FixedCircularBuffer();
    }
    this.head.push(data);
    this._size++;
  }

  shift (): Task | null {
    const tail = this.tail;
    const next = tail.shift();
    if (next !== null) this._size--;
    if (tail.isEmpty() && tail.next !== null) {
      // If there is another queue, it forms the new tail.
      this.tail = tail.next;
      tail.next = null;
    }
    return next;
  }

  remove (task: Task) {
    let prev: FixedCircularBuffer | null = null;
    let buffer = this.tail;
    while (true) {
      if (buffer.list.includes(task)) {
        buffer.remove(task);
        this._size--;
        break;
      }
      if (buffer.next === null) break;
      prev = buffer;
      buffer = buffer.next;
    }
    if (buffer.isEmpty()) {
      // removing tail
      if (prev === null) {
        // if tail is not the last buffer
        if (buffer.next !== null) this.tail = buffer.next;
      } else {
        // removing head
        if (buffer.next === null) {
          this.head = prev;
        } else {
          // removing buffer from middle
          prev.next = buffer.next;
        }
      }
    }
  }

  get size () {
    return this._size;
  }
};
