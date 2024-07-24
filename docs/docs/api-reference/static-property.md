---
id: Static Properties and Methods
sidebar_position: 6
---

## Static property: `isWorkerThread` (readonly)

Is `true` if this code runs inside a `Piscina` threadpool as a Worker.

## Static property: `version` (readonly)

Provides the current version of this library as a semver string.

## Static method: `move(value)`

By default, any value returned by a worker function will be cloned when
returned back to the Piscina pool, even if that object is capable of
being transfered. The `Piscina.move()` method can be used to wrap and
mark transferable values such that they will by transfered rather than
cloned.

The `value` may be any object supported by Node.js to be transferable
(e.g. `ArrayBuffer`, any `TypedArray`, or `MessagePort`), or any object
implementing the `Transferable` interface.

```js
const { move } = require('piscina');

module.exports = () => {
  return move(new ArrayBuffer(10));
}
```

The `move()` method will throw if the `value` is not transferable.

The object returned by the `move()` method should not be set as a
nested value in an object. If it is used, the `move()` object itself
will be cloned as opposed to transfering the object it wraps.