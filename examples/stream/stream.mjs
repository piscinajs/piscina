import {
  Writable,
  Readable,
  Duplex
} from 'stream';

const kPort = Symbol('kPort');

export class MessagePortWritable extends Writable {
  constructor (port, options) {
    super(options);
    this[kPort] = port;
  }

  _write (buf, _, cb) {
    this[kPort].postMessage(buf, [buf.buffer]);
    cb();
  }

  _writev (data, cb) {
    const chunks = new Array(data.length);
    const transfers = new Array(data.length);
    for (let n = 0; n < data.length; n++) {
      chunks[n] = data[n].chunk;
      transfers[n] = data[n].chunk.buffs;
    }
    this[kPort].postMessage(chunks, transfers);
    cb();
  }

  _final (cb) {
    this[kPort].postMessage(null);
    cb();
  }

  _destroy (err, cb) {
    this[kPort].close(() => cb(err));
  }

  unref () { this[kPort].unref(); return this; }
  ref () { this[kPort].ref(); return this; }
}

export class MessagePortReadable extends Readable {
  constructor (port, options) {
    super(options);
    this[kPort] = port;
    port.onmessage = ({ data }) => this.push(data);
  }

  _read () {
    this[kPort].start();
  }

  _destroy (err, cb) {
    this[kPort].close(() => {
      this[kPort].onmessage = undefined;
      cb(err);
    });
  }

  unref () { this[kPort].unref(); return this; }
  ref () { this[kPort].ref(); return this; }
}

export class MessagePortDuplex extends Duplex {
  constructor (port, options) {
    super(options);
    this[kPort] = port;
    port.onmessage = ({ data }) => this.push(data);
  }

  _read () {
    this[kPort].start();
  }

  _write (buf, _, cb) {
    this[kPort].postMessage(buf, [buf.buffer]);
    cb();
  }

  _writev (data, cb) {
    const chunks = new Array(data.length);
    const transfers = new Array(data.length);
    for (let n = 0; n < data.length; n++) {
      chunks[n] = data[n].chunk;
      transfers[n] = data[n].chunk.buffs;
    }
    this[kPort].postMessage(chunks, transfers);
    cb();
  }

  _final (cb) {
    this[kPort].postMessage(null);
    cb();
  }

  _destroy (err, cb) {
    this[kPort].close(() => {
      this[kPort].onmessage = undefined;
      cb(err);
    });
  }

  unref () { this[kPort].unref(); return this; }
  ref () { this[kPort].ref(); return this; }
}
