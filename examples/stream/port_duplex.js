'use strict';

const { Duplex } = require('stream');

class PortDuplex extends Duplex {
  #port = undefined;

  constructor (port, options) {
    const {
      readable = true,
      writable = true
    } = { ...options };
    if (typeof readable !== 'boolean') {
      throw new TypeError('readable must be a boolean');
    }
    if (typeof writable !== 'boolean') {
      throw new TypeError('writable must be a boolean');
    }
    super({ autoDestroy: true, readable, writable });
    this.#port = port;
    this.#port.onmessage = PortDuplex.#onmessage.bind(this);
  }

  _write (chunk, encoding, callback) {
    // Chunk should always be a buffer here
    const temp = new Uint8Array(chunk);
    // TODO(@jasnell): This will need backpressure implemented
    this.#port.postMessage(temp);
    callback();
  }

  _read () {
    // Do nothing here. A more complete example would
    // implement proper read/pause behavior.
  }

  _destroy (err, callback) {
    if (err) {
      this.#port.close();
      callback(err);
      return;
    }
    if (this.writableEnded) {
      this.#port.postMessage(null);
    }
    callback();
  }

  static #onmessage = function ({ data }) {
    if (data != null) {
      this.push(data);
    } else {
      this.push(null);
    }
  };
}

module.exports = PortDuplex;
