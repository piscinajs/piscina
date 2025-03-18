# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [4.9.2](https://github.com/piscinajs/piscina/compare/v4.9.1...v4.9.2) (2025-03-18)

### [4.9.1](https://github.com/piscinajs/piscina/compare/v4.8.0...v4.9.1) (2025-03-18)


### Features

* Allow long-running threads ([#757](https://github.com/piscinajs/piscina/issues/757)) ([#758](https://github.com/piscinajs/piscina/issues/758)) ([e572c7d](https://github.com/piscinajs/piscina/commit/e572c7dedf5e701bcdfeff9b8d52b8522f0dd44d))


### Bug Fixes

* bundle size ([cd532b3](https://github.com/piscinajs/piscina/commit/cd532b30d83bb24e0c851314d4018ddfa897b2e8))

## [4.9.0](https://github.com/piscinajs/piscina/compare/v4.8.0...v4.9.0) (2025-03-16)


### Features

* Allow long-running threads ([#757](https://github.com/piscinajs/piscina/issues/757)) ([#758](https://github.com/piscinajs/piscina/issues/758)) ([e572c7d](https://github.com/piscinajs/piscina/commit/e572c7dedf5e701bcdfeff9b8d52b8522f0dd44d))

## [4.8.0](https://github.com/piscinajs/piscina/compare/v4.7.0...v4.8.0) (2024-12-04)

## [4.7.0](https://github.com/piscinajs/piscina/compare/v4.6.1...v4.7.0) (2024-09-18)


### Features

* **backport:** use @napi-rs/nice to support Windows ([#655](https://github.com/piscinajs/piscina/issues/655)) ([#660](https://github.com/piscinajs/piscina/issues/660)) ([541295d](https://github.com/piscinajs/piscina/commit/541295dad21c4c3f43bc133d78d82871fa86c864))


### Bug Fixes

* adjust docusaurus ([5c3d2c9](https://github.com/piscinajs/piscina/commit/5c3d2c90ff0a00f338d194b20efdc6772d8e01e3))

### [4.6.1](https://github.com/piscinajs/piscina/compare/v4.6.0...v4.6.1) (2024-06-26)

## [4.6.0](https://github.com/piscinajs/piscina/compare/v4.5.2...v4.6.0) (2024-06-18)


### Features

* expose task interface ([#565](https://github.com/piscinajs/piscina/issues/565)) ([285aa82](https://github.com/piscinajs/piscina/commit/285aa82b45cfb1f33210812c441c83a44c78ed34))


### Bug Fixes

* close pool with minThreads=0 ([#584](https://github.com/piscinajs/piscina/issues/584)) ([776bacb](https://github.com/piscinajs/piscina/commit/776bacbebbc7f3adcde767a7dfada574da58bfe6))

### [4.5.1](https://github.com/piscinajs/piscina/compare/v4.5.0...v4.5.1) (2024-05-22)


### Bug Fixes

* support nodejs v16.x again ([#572](https://github.com/piscinajs/piscina/issues/572)) ([d50391f](https://github.com/piscinajs/piscina/commit/d50391fe93a6319c2a554f34d39cce0c946564ec))

## [4.5.0](https://github.com/piscinajs/piscina/compare/v4.4.0...v4.5.0) (2024-05-20)


### Features

* allow generic when creating Piscina ([#569](https://github.com/piscinajs/piscina/issues/569)) ([108440c](https://github.com/piscinajs/piscina/commit/108440c5586bad0be376c65a56836875fce5bef9))
* Use fixed queue ([#555](https://github.com/piscinajs/piscina/issues/555)) ([8afa70f](https://github.com/piscinajs/piscina/commit/8afa70faaefeb7ed87516af06aad5924a4dbe7f0))
* use os.availableConcurrency ([#556](https://github.com/piscinajs/piscina/issues/556)) ([d1fbba2](https://github.com/piscinajs/piscina/commit/d1fbba2cae4c189b822672bb63f50b7381cbb6ab))

## [4.4.0](https://github.com/piscinajs/piscina/compare/v4.3.2...v4.4.0) (2024-02-28)


### Features

* add option to disable run/wait time recording ([#518](https://github.com/piscinajs/piscina/issues/518)) ([4a94cee](https://github.com/piscinajs/piscina/commit/4a94cee847395a0395cce68743332009214243f2))
* allow named import usage ([#517](https://github.com/piscinajs/piscina/issues/517)) ([6a7c6e1](https://github.com/piscinajs/piscina/commit/6a7c6e170b19d1c6285c0230ad02f1a259fc69a3))

### [4.3.2](https://github.com/piscinajs/piscina/compare/v4.3.1...v4.3.2) (2024-02-16)


### Bug Fixes

* **#513:** forward errors correctly to Piscina ([#514](https://github.com/piscinajs/piscina/issues/514)) ([6945d21](https://github.com/piscinajs/piscina/commit/6945d21d47b72dfa801e0309948fea9fbf708c91)), closes [#513](https://github.com/piscinajs/piscina/issues/513)

### [4.3.1](https://github.com/piscinajs/piscina/compare/v4.3.0...v4.3.1) (2024-01-30)


### Bug Fixes

* **#491:** out of bounds histogram value ([#496](https://github.com/piscinajs/piscina/issues/496)) ([0b4eada](https://github.com/piscinajs/piscina/commit/0b4eada2485a0f722f5b6d39d657fd51975df0f3)), closes [#491](https://github.com/piscinajs/piscina/issues/491)

## [4.3.0](https://github.com/piscinajs/piscina/compare/v4.2.1...v4.3.0) (2024-01-16)


### Features

* use native Node.js histogram support ([#482](https://github.com/piscinajs/piscina/issues/482)) ([aa5b140](https://github.com/piscinajs/piscina/commit/aa5b1408e33420e7c29725381d7824b0b40d26e8))

### [4.2.1](https://github.com/piscinajs/piscina/compare/v4.2.0...v4.2.1) (2023-12-13)


### Bug Fixes

* default minThreads with odd CPU count ([#457](https://github.com/piscinajs/piscina/issues/457)) ([f4edf87](https://github.com/piscinajs/piscina/commit/f4edf87c8c4883e06ab70e99a8a5050eded89c5d))

## [4.2.0](https://github.com/piscinajs/piscina/compare/v4.1.0...v4.2.0) (2023-11-19)


### Features

* Add `Piscina#close` API ([#396](https://github.com/piscinajs/piscina/issues/396)) ([5378e4c](https://github.com/piscinajs/piscina/commit/5378e4cf9143587d9457d3cef6b88aa9653749bd))


### Bug Fixes

* add signal reason support ([#403](https://github.com/piscinajs/piscina/issues/403)) ([66809f9](https://github.com/piscinajs/piscina/commit/66809f94868b4b4597401e10252e1285fabc63c2))
* do not re-create threads when calling `.destory()` ([#430](https://github.com/piscinajs/piscina/issues/430)) ([ec21ff2](https://github.com/piscinajs/piscina/commit/ec21ff28f90a4d5e001ba694fe3dcd6abec3f553))
* migrate to EventEmitterAsyncResource from core ([#433](https://github.com/piscinajs/piscina/issues/433)) ([0a539e2](https://github.com/piscinajs/piscina/commit/0a539e23e7c413cc33631f1adb32ab28b468297b))
