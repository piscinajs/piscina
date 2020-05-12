# Piscina N-API (native addon) example

A Piscina worker can be implemented using a native addon, allowing
work to performed by native code. This provides a number of interesting
options including implementing workers using other languages such as
Rust.

To get started with this example, first install the dependencies:

```console
$ npm i
```

Then build the artifacts:

```console
$ npm run prebuild
```

The `prebuild` command will build the binary artifacts for the native
addon and will put them in the `prebuilds` folder. Because of how
prebuilds work, we need to use an intermediate JavaScript file to
load and export them. For this example native addon, you'll find
that in the `examples` folder.

The index.js illustrates how to load and use the native addon as the
worker implementation:

```js
const Piscina = require('piscina');
const { resolve } = require('path');

const pool = new Piscina({
  filename: resolve(__dirname, 'example')
});

(async () => {
  // Submit 5 concurrent tasks
  console.log(await Promise.all([
    pool.runTask(),
    pool.runTask(),
    pool.runTask(),
    pool.runTask(),
    pool.runTask()
  ]));
})();
```
