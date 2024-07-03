---
id: Interface
sidebar_position: 7
---

## Interface: `Transferable`

Objects may implement the `Transferable` interface to create their own
custom transferable objects. This is useful when an object being
passed into or from a worker contains a deeply nested transferable
object such as an `ArrayBuffer` or `MessagePort`.

`Transferable` objects expose two properties inspected by Piscina
to determine how to transfer the object. These properties are
named using the special static `Piscina.transferableSymbol` and
`Piscina.valueSymbol` properties:

* The `Piscina.transferableSymbol` property provides the object
  (or objects) that are to be included in the `transferList`.

* The `Piscina.valueSymbol` property provides a surrogate value
  to transmit in place of the `Transferable` itself.

Both properties are required.

For example:

```js
const {
  move,
  transferableSymbol,
  valueSymbol
} = require('piscina');

module.exports = () => {
  const obj = {
    a: { b: new Uint8Array(5); },
    c: { new Uint8Array(10); },

    get [transferableSymbol]() {
      // Transfer the two underlying ArrayBuffers
      return [this.a.b.buffer, this.c.buffer];
    }

    get [valueSymbol]() {
      return { a: { b: this.a.b }, c: this.c };
    }
  };
  return move(obj);
};
```