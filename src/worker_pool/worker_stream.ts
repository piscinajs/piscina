import assert from 'node:assert';
import { Readable } from 'node:stream';

import { RING_BUFFER_INDEXES, RING_BUFFER_STATUSES } from '../common';

type WorkerStreamSharedBuffers = {
  state: SharedArrayBuffer;
  data: SharedArrayBuffer;
};

// TODO: test out
export class WorkerStreamWriter {
  #state: Int32Array;
  #data: Buffer;
  #readIdx: number = 0;
  #writeIdx: number = 0;
  #status: number = 0;
  #init: boolean = false;
  #ended: boolean = false;
  #needsFlush: boolean = false;
  #paused: boolean = false;

  constructor(state: SharedArrayBuffer, data: SharedArrayBuffer) {
    this.#state = new Int32Array(state);
    this.#data = Buffer.from(data);
  }

  signal(): void {
    Atomics.store(this.#state, RING_BUFFER_INDEXES.STATUS_INDEX, this.#status);
  }

  prepare(): void {
    this.#init = true;
    Atomics.store(this.#state, RING_BUFFER_INDEXES.READ_INDEX, this.#readIdx);
    Atomics.store(this.#state, RING_BUFFER_INDEXES.WRITE_INDEX, this.#writeIdx);
    Atomics.notify(this.#state, RING_BUFFER_INDEXES.READ_INDEX);
    Atomics.notify(this.#state, RING_BUFFER_INDEXES.WRITE_INDEX);
  }

  write(chunk: Buffer | ArrayBufferLike | string): boolean {
    assert(!this.#ended, 'writer already closed');
    if (
      typeof chunk !== 'string' &&
      Buffer.isBuffer(chunk) === false &&
      ArrayBuffer.isView(chunk) === false
    ) {
      throw new TypeError(
        'AsyncIterators should only return string, buffer or typed arrays'
      );
    }

    chunk = (
      Buffer.isBuffer(chunk) || ArrayBuffer.isView(chunk)
        ? chunk
        : Buffer.from(chunk)
    ) as Buffer;

    return this.#write(chunk);
  }

  #write(chunk: Buffer | ArrayBuffer): boolean {
    // Chunk header with the size of the chunk
    this.#data[this.#writeIdx] = chunk.byteLength;
    // Actual chunk data
    // @ts-expect-error - internally is parsed into a bytelength
    this.#data[++this.#writeIdx] = chunk;

    this.#writeIdx++;

    // Update write idx for consitency
    Atomics.store(this.#state, RING_BUFFER_INDEXES.WRITE_INDEX, this.#writeIdx);

    // If paused and init because first chunk, let's change state and move
    if (this.#init === true && this.#status === RING_BUFFER_STATUSES.PAUSED) {
      Atomics.store(
        this.#state,
        RING_BUFFER_INDEXES.STATUS_INDEX,
        (this.#status = RING_BUFFER_STATUSES.RESUME)
      );
      this.#init = false;
    } else {
      this.#status = Atomics.load(
        this.#state,
        RING_BUFFER_INDEXES.STATUS_INDEX
      );
    }

    if (this.#status === 0) {
      this.#paused = true;
      return false;
    }

    if (this.#writeIdx === this.#readIdx) {
      this.#needsFlush = true;
      return false;
    }

    return true;
  }

  async wait(): Promise<void> {
    if (this.#needsFlush) {
      // @ts-expect-error - to allow further tasks to flush
      await Atomics.waitAsync(
        this.#state,
        RING_BUFFER_INDEXES.READ_INDEX,
        this.#readIdx
      );
      this.#readIdx = Atomics.load(this.#state, RING_BUFFER_INDEXES.READ_INDEX);
    } else if (this.#paused) {
      // @ts-expect-error - to allow further tasks to flush
      await Atomics.waitAsync(
        this.#state,
        RING_BUFFER_INDEXES.STATUS_INDEX,
        RING_BUFFER_STATUSES.PAUSED
      ); // 0 - pause, 1 - resume, 2 - end, 3 - errored (?),
    }
  }

  end(): void {
    Atomics.store(this.#state, RING_BUFFER_INDEXES.STATUS_INDEX, 2);
    Atomics.notify(this.#state, RING_BUFFER_INDEXES.STATUS_INDEX);
    this.#ended = true;
  }
}

class WorkerStream extends Readable {
  #shared: WorkerStreamSharedBuffers;
  #readIdx: number = 0;
  #writeIdx: number = 4;
  #status: number | null = null;

  constructor(shared: WorkerStreamSharedBuffers) {
    super();

    assert.ok(shared.data);
    assert.ok(shared.state);
    this.#shared = shared;
  }

  _read() {
    const state = new Int32Array(this.#shared.state);
    const buffer = Buffer.from(this.#shared.data);

    this.#status = Atomics.load(state, RING_BUFFER_INDEXES.STATUS_INDEX);
    console.log('>>main: initial status', this.#status);
    console.log('>>main: initial buffer status', buffer);

    // If thread has not yet buffered chunks
    // let's pause and exit
    if (this.#status === 0) {
      this.pause();
      return;
    } else {
      // otherwise, resume and move
      this.resume();
    }

    while (true) {
      console.log(
        `main>>>: Status ${this.#status} - Header Index: ${
          this.#readIdx
        } - Chunk Index - ${this.#readIdx + 1}`
      );

      // @ts-expect-error
      const header = buffer[this.#readIdx++];
      const temp = buffer[this.#readIdx];
      // TODO: test parsing a more complex payload.
      // TODO: support long payload on ringbuffer
      // TODO: support restarting indexes on ringbuffer
      // TODO: support customized buffer allocation
      // TODO: Benchmark
      // TODO: cleanup

      console.log('main>>> chunk as string', temp);
      this.#readIdx++;
      if (!this.push(`${temp}`)) {
        console.log('main>>> pausing');
        return;
      }

      this.#status = Atomics.load(state, RING_BUFFER_INDEXES.STATUS_INDEX);
      this.#writeIdx = Atomics.load(state, RING_BUFFER_INDEXES.WRITE_INDEX);

      if (this.#status !== 1) {
        if (this.#status === 2) {
          if (this.#readIdx === this.#writeIdx) {
            this.push(null);
            return;
          }
          // Means buffer needs to be drained
        } else if (this.#status === 0) {
          // Update read cursor and wake up thread if awaiting for further
          // signal
          Atomics.store(state, RING_BUFFER_INDEXES.READ_INDEX, this.#readIdx);
          Atomics.notify(state, RING_BUFFER_INDEXES.READ_INDEX);

          // We have drained the buffer but thread hasn't yet
          // updated it
          if (this.#readIdx === this.#writeIdx) {
            Atomics.wait(
              state,
              RING_BUFFER_INDEXES.WRITE_INDEX,
              this.#writeIdx
            );
          }
        }
      } else if (this.#readIdx === this.#writeIdx) {
        // We have drained the buffer but thread hasn't yet
        // updated it
        // TODO: shall we pause and exit the method?
        Atomics.wait(state, RING_BUFFER_INDEXES.WRITE_INDEX, this.#writeIdx);
      }
    }
  }
}

export { WorkerStream };
