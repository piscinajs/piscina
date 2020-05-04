'use strict';

const { Duplex } = require('stream');

class PortDuplex extends Duplex {
  #port = undefined;
  #transfer = false;

  constructor (port, options) {
    const {
      readable = true,
      writable = true,
      transfer = false
    } = { ...options };
    if (typeof readable !== 'boolean') {
      throw new TypeError('readable must be a boolean');
    }
    if (typeof writable !== 'boolean') {
      throw new TypeError('writable must be a boolean');
    }
    if (typeof transfer !== 'boolean') {
      throw new TypeError('transfer must be a boolean');
    }
    super({ autoDestroy: true, readable, writable });
    this.#port = port;
    this.#transfer = transfer;
    this.#port.onmessage = PortDuplex.#onmessage.bind(this);
  }

  _write (chunk, encoding, callback) {
    if (typeof chunk === 'string') {
      chunk = Buffer.from(chunk, encoding);
    }
    const transferList = this.#transfer ? [chunk.buffer] : undefined;
    this.#port.postMessage(chunk, transferList);
    callback();
  }

  _read () {
    // Do nothing here. A more complete example would
    // implement proper read/pause behavior.
  }

  _destroy (err, callback) {
    if (err) {
      // TODO(@jasnell): A more complete example would
      // handle this error more appropriately.
      this.#port.close();
      console.error(err);
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
