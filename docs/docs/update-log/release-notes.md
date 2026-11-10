---
id: Release Notes
sidebar_position: 1
---

### 4.1.0

#### Features

* add `needsDrain` property ([#368](https://github.com/piscinajs/piscina/issues/368)) ([2d49b63](https://github.com/piscinajs/piscina/commit/2d49b63368116c172a52e2019648049b4d280162))
* correctly handle process.exit calls outside of a task ([#361](https://github.com/piscinajs/piscina/issues/361)) ([8e6d16e](https://github.com/piscinajs/piscina/commit/8e6d16e1dc23f8bb39772ed954f6689852ad435f))


#### Bug Fixes

* Fix types for TypeScript 4.7 ([#239](https://github.com/piscinajs/piscina/issues/239)) ([a38fb29](https://github.com/piscinajs/piscina/commit/a38fb292e8fcc45cc20abab8668f82d908a24dc0))
* use CJS imports ([#374](https://github.com/piscinajs/piscina/issues/374)) ([edf8dc4](https://github.com/piscinajs/piscina/commit/edf8dc4f1a19e9b49e266109cdb70d9acc86f3ca))

### 4.0.0

* Drop Node.js 14.x support
* Add Node.js 20.x to CI

### 3.2.0

* Adds a new `PISCINA_DISABLE_ATOMICS` environment variable as an alternative way of
  disabling Piscina's internal use of the `Atomics` API. (https://github.com/piscinajs/piscina/pull/163)
* Fixes a bug with transferable objects. (https://github.com/piscinajs/piscina/pull/155)
* Fixes CI issues with TypeScript. (https://github.com/piscinajs/piscina/pull/161)

### 3.1.0

* Deprecates `piscina.runTask()`; adds `piscina.run()` as an alternative.
  https://github.com/piscinajs/piscina/commit/d7fa24d7515789001f7237ad6ae9ad42d582fc75
* Allows multiple exported handler functions from a single file.
  https://github.com/piscinajs/piscina/commit/d7fa24d7515789001f7237ad6ae9ad42d582fc75

### 3.0.0

* Drops Node.js 10.x support
* Updates minimum TypeScript target to ES2019

### 2.1.0

* Adds name property to indicate `AbortError` when tasks are
  canceled using an `AbortController` (or similar)
* More examples

### 2.0.0

* Added unmanaged file descriptor tracking
* Updated dependencies

### 1.6.1

* Bug fix: Reject if AbortSignal is already aborted
* Bug Fix: Use once listener for abort event

### 1.6.0

* Add the `niceIncrement` configuration parameter.

### 1.5.1

* Bug fixes around abortable task selection.

### 1.5.0

* Added `Piscina.move()`
* Added Custom Task Queues
* Added utilization metric
* Wait for workers to be ready before considering them as candidates
* Additional examples

### 1.4.0

* Added `maxQueue = 'auto'` to autocalculate the maximum queue size.
* Added more examples, including an example of implementing a worker
  as a Node.js native addon.

### 1.3.0

* Added the `'drain'` event

### 1.2.0

* Added support for ESM and file:// URLs
* Added `env`, `argv`, `execArgv`, and `workerData` options
* More examples

### 1.1.0

* Added support for Worker Thread `resourceLimits`

### 1.0.0

* Initial release!
