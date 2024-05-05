import assert from 'node:assert';
import { TaskQueue, Task } from './common';
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
  #size: number = 0

  constructor () {
    this.bottom = 0;
    this.top = 0;
    this.list = new Array(kSize);
    this.next = null;
  }

  isEmpty () {
    return this.top === this.bottom;
  }

  isFull () {
    return ((this.top + 1) & kMask) === this.bottom;
  }

  push (data:Task) {
    this.list[this.top] = data;
    this.top = (this.top + 1) & kMask;
    this.#size++;
  }

  shift () {
    const nextItem = this.list[this.bottom];
    if (nextItem === undefined) { return null; }
    this.list[this.bottom] = undefined;
    this.bottom = (this.bottom + 1) & kMask;
    this.#size--;
    return nextItem;
  }

  remove (task: Task) {
    const indexToRemove = this.list.indexOf(task);

    assert.notStrictEqual(indexToRemove, -1);
    let curr = indexToRemove;
    while (true) {
      const next = (curr + 1) & kMask;
      this.list[curr] = this.list[next];
      if (this.list[curr] === undefined) break;
      if (curr === indexToRemove) break;
      curr = next;
    }
    this.#size--;
  }

  get size () {
    return this.#size;
  }

  get capacity () {
    return this.list.length;
  }
}

export default class FixedQueue implements TaskQueue {
  head: FixedCircularBuffer
  tail: FixedCircularBuffer

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
  }

  shift (): Task | null {
    const tail = this.tail;
    const next = tail.shift();
    if (tail.isEmpty() && tail.next !== null) {
      // If there is another queue, it forms the new tail.
      this.tail = tail.next;
      tail.next = null;
    }
    return next;
  }

  remove (task: Task) {
    let buffer = this.head;
    while (true) {
      if (buffer.list.includes(task)) {
        buffer.remove(task);
        break;
      }
      if (buffer.next === null) break;
      buffer = buffer.next;
    }
  }

  get size () {
    let total = 0;
    let buffer = this.head;
    while (true) {
      total += buffer.size;
      if (buffer.next === null) break;
      buffer = buffer.next;
    }
    return total;
  }
};
