import Piscina from 'piscina';
import {
  ReadableStream,
  TransformStream,
  WritableStream
} from 'node:stream/web';

const pool = new Piscina({
  filename: new URL('./worker.mjs', import.meta.url).href
});

const readable = new ReadableStream({
  start () {
    this.chunks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
  },

  pull (controller) {
    const chunk = this.chunks.shift();
    controller.enqueue(chunk);
    if (this.chunks.length === 0) {
      controller.close();
    }
  }
});

const writable = new WritableStream({
  write (chunk) {
    console.log(chunk);
  }
});

const transform = new TransformStream({
  async transform (chunk, controller) {
    controller.enqueue(await pool.run(chunk));
  }
});

readable.pipeThrough(transform).pipeTo(writable);
