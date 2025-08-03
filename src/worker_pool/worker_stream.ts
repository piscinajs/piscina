import assert from 'node:assert';
import { Readable } from 'node:stream';

import { RING_BUFFER_INDEXES, RING_BUFFER_STATUSES } from '../common';

type WorkerStreamSharedBuffers = {
  state: SharedArrayBuffer;
  data: SharedArrayBuffer;
};

const RING_BUFFER_CONSTANTS = {
  headerOffset: 4,
};

class WorkerStreamBuffer {
  #buffer: Buffer | ArrayBuffer;
  #type: 0 | 1 = 0; // 0 = Buffer, 1 = ArrayBuffer
  constructor(chunk: Buffer | ArrayBuffer | string) {
    if (ArrayBuffer.isView(chunk)) {
      this.#buffer = chunk;
      this.#type = 1;
    } else if (typeof chunk === 'string') {
      this.#buffer = Buffer.from(chunk);
    } else {
      this.#buffer = chunk;
    }
  }

  parse(): Buffer {
    switch (this.#type) {
      case 1:
        return Buffer.from(this.#buffer as ArrayBuffer);
      default:
        return this.#buffer as Buffer;
        break;
    }
  }

  get byteLength(): number {
    return this.#buffer.byteLength;
  }

  get length(): number {
    // @ts-expect-error
    return this.#buffer.length;
  }
}

export class WorkerStreamWriter {
  #state: Int32Array;
  #data: Buffer;
  #view: DataView;
  #readIdx: number = 0;
  #writeIdx: number = 0;
  #status: number = 0;
  #firstChunk: boolean = false;
  #ended: boolean = false;
  #needsFlush: boolean = false;
  #paused: boolean = false;

  constructor(state: SharedArrayBuffer, data: SharedArrayBuffer) {
    this.#state = new Int32Array(state);
    this.#data = Buffer.from(data);
    this.#view = new DataView(data);
  }

  prepare(): void {
    this.#firstChunk = true;
    queueMicrotask(() =>
      Atomics.store(this.#state, RING_BUFFER_INDEXES.STATUS_INDEX, this.#status)
    );
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
        '(Async)Iterators should only return string, buffer or typed arrays'
      );
    }

    // chunk = (
    //   Buffer.isBuffer(chunk) || ArrayBuffer.isView(chunk)
    //     ? chunk
    //     : Buffer.from(chunk)
    // ) as Buffer;

    return this.#write(new WorkerStreamBuffer(chunk));
  }

  #write(chunk: WorkerStreamBuffer): boolean {
    // process._rawDebug('>>> thread - before copy - data length', this.#data.byteLength)
    // process._rawDebug('>>> thread - before copy - data', this.#data)
    // process._rawDebug('>>> thread - before copy - write index', this.#writeIdx)
    // // @ts-expect-error
    // process._rawDebug('>>> thread - before copy - chunk length', chunk.length)
    // process._rawDebug(
    // '>>> thread - before copy - chunk byteLength',
    // chunk.byteLength
    // );

    // Chunk header with the size of the chunk
    // this.#data[this.#writeIdx] = chunk.byteLength;
    // this.#data.writeInt32LE(chunk.byteLength, this.#writeIdx)
    this.#view.setUint32(this.#writeIdx, chunk.byteLength, true);
    this.#writeIdx += RING_BUFFER_CONSTANTS.headerOffset;
    // this.#data[++this.#writeIdx] = chunk;
    // (chunk as Buffer).copy(this.#data, this.#writeIdx);
    this.#data.set(chunk.parse(), this.#writeIdx);

    this.#writeIdx += chunk.length;
    // process._rawDebug('>>> thread - after copy - write index', this.#writeIdx)
    // process._rawDebug('>>> thread - after copy - data', this.#data)

    // Update write idx for consistency
    Atomics.store(this.#state, RING_BUFFER_INDEXES.WRITE_INDEX, this.#writeIdx);

    // If paused and init because first chunk, let's change state and move
    if (
      this.#firstChunk === true &&
      this.#status === RING_BUFFER_STATUSES.PAUSED
    ) {
      Atomics.store(
        this.#state,
        RING_BUFFER_INDEXES.STATUS_INDEX,
        (this.#status = RING_BUFFER_STATUSES.RESUME)
      );
      Atomics.notify(this.#state, RING_BUFFER_INDEXES.WRITE_INDEX);
      this.#firstChunk = false;
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
      this.#status = Atomics.load(
        this.#state,
        RING_BUFFER_INDEXES.STATUS_INDEX
      );
    }
  }

  destroy() {
    this.#ended = true;
    Atomics.store(this.#state, RING_BUFFER_INDEXES.STATUS_INDEX, 3); // errored
    Atomics.notify(this.#state, RING_BUFFER_INDEXES.STATUS_INDEX);
  }

  end(): void {
    this.#ended = true;
    Atomics.store(this.#state, RING_BUFFER_INDEXES.STATUS_INDEX, 2);
    Atomics.notify(this.#state, RING_BUFFER_INDEXES.STATUS_INDEX);
  }
}

class WorkerStream extends Readable {
  #shared: WorkerStreamSharedBuffers;
  #readIdx: number = 0;
  #writeIdx: number = 4;
  #status: number | null = null;
  #waiting: boolean = false;

  constructor(shared: WorkerStreamSharedBuffers) {
    super();

    assert.ok(shared.data);
    assert.ok(shared.state);
    this.#shared = shared;
  }

  _read() {
    const state = new Int32Array(this.#shared.state);
    const buffer = Buffer.from(this.#shared.data);
    // const view = new DataView(this.#shared.data);

    this.#status = Atomics.load(state, RING_BUFFER_INDEXES.STATUS_INDEX);
    // console.log('>>main: initial status', this.#status);
    // console.log('>>main: initial buffer status', buffer);

    // If thread has not yet buffered chunks
    // if paused on the other side, let's await
    if (this.#status === 0) {
      Atomics.wait(
        state,
        RING_BUFFER_INDEXES.STATUS_INDEX,
        RING_BUFFER_STATUSES.PAUSED
      );
      this.#status = Atomics.load(state, RING_BUFFER_INDEXES.STATUS_INDEX);
    }

    // If errored or waiting for more data, just stop
    if (this.#status === 3 || this.#waiting) {
      return;
    }

    // console.log('>>main: after status', this.#status);
    // console.log('>>main: after buffer status', buffer);

    while (true) {
      // console.log(
      // `main>>>: Status ${this.#status} - Header Index: ${
      // this.#readIdx
      // } - Chunk Index - ${this.#readIdx + RING_BUFFER_CONSTANTS.headerOffset}`
      // );

      // const header = buffer[this.#readIdx];
      const headersection = buffer.subarray(
        this.#readIdx,
        this.#readIdx + RING_BUFFER_CONSTANTS.headerOffset
      );
      // console.log('>>> main: header section', headersection);
      const header = headersection.readInt32LE();
      // const temp = buffer[this.#readIdx];
      // console.log('>>> main: header', header);
      this.#readIdx += RING_BUFFER_CONSTANTS.headerOffset;
      const temp = buffer.subarray(this.#readIdx, this.#readIdx + header);
      // TODO: test parsing a more complex payload.
      // TODO: support long payload on ringbuffer
      // TODO: support restarting indexes on ringbuffer
      // TODO: support customized buffer allocation
      // TODO: Benchmark
      // TODO: cleanup

      // console.log('main>>> chunk as string', temp);
      this.#readIdx += header;
      this.#writeIdx = Atomics.load(state, RING_BUFFER_INDEXES.WRITE_INDEX);
      // console.log('>>> main - readidx:', this.#readIdx, '- writeidx:', this.#writeIdx)
      if (!this.push(`${temp}`)) {
        // console.log('main>>> pausing');
        return;
      }

      this.#status = Atomics.load(state, RING_BUFFER_INDEXES.STATUS_INDEX);

      // console.log('>>> main - new status:', this.#status);
      if (this.#status !== 1) {
        switch (this.#status) {
          // Stream paused
          case 0: {
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
            break;
          }

          // Stream ended
          case 2: {
            if (this.#readIdx === this.#writeIdx) {
              this.push(null);
              return;
            }
            break;
          }

          // Stream failed
          case 3: {
            return;
          }
        }
        // if (this.#status === 2) {
        //   if (this.#readIdx === this.#writeIdx) {
        //     this.push(null);
        //     return;
        //   }
        //   // Means buffer needs to be drained
        // } else if (this.#status === 0) {
        //   // Update read cursor and wake up thread if awaiting for further
        //   // signal
        //   Atomics.store(state, RING_BUFFER_INDEXES.READ_INDEX, this.#readIdx);
        //   Atomics.notify(state, RING_BUFFER_INDEXES.READ_INDEX);

        //   // We have drained the buffer but thread hasn't yet
        //   // updated it
        //   if (this.#readIdx === this.#writeIdx) {
        //     Atomics.wait(
        //       state,
        //       RING_BUFFER_INDEXES.WRITE_INDEX,
        //       this.#writeIdx
        //     );
        //   }
        // }
      } else if (this.#readIdx === this.#writeIdx) {
        // We have drained the buffer but thread hasn't
        // added more data just yet
        // console.log(
        //   '>>> main - waiting for drain',
        //   this.#readIdx,
        //   this.#writeIdx
        // );
        this.#waiting = true;
        // @ts-expect-error
        const { async, value } = Atomics.waitAsync(
          state,
          RING_BUFFER_INDEXES.WRITE_INDEX,
          this.#writeIdx
        );
        if (async === true) {
          value.then(() => {
            this.#waiting = false;
          });
        } else {
          this.#waiting = false;
        }

        return;
      }
    }
  }
}

export { WorkerStream };