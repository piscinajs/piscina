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
    if (typeof chunk === 'string') {
      chunk = Buffer.from(chunk, encoding);
    }
    // Be sure to always copy the chunk here and never use a
    // transferList. There are several reasons:
    // a) Buffer instances are most often created off a pool
    //    and share the same underlying common ArrayBuffer,
    //    transferring those can break Node.js in many ways.
    // b) The Buffer instance may still be used by some
    //    other upstream component. Transferring it here
    //    will cause unexpected and undefined behavior that
    //    will likely crash the Node.js process.
    this.#port.postMessage(chunk);
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
