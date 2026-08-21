# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [6.0.0-rc.4](https://github.com/piscinajs/piscina/compare/v6.0.0-rc.2...v6.0.0-rc.4) (2026-08-21)


### ⚠ BREAKING CHANGES

* enable stricter FIFO by default (#1114)
* baseline preparations (#1062) (#1108)

### Features

* add stricterFIFO option for queue fairness ([#1112](https://github.com/piscinajs/piscina/issues/1112)) ([f7f058e](https://github.com/piscinajs/piscina/commit/f7f058e0703605bb344c9f287e11befc815035b5))
* baseline preparations ([#1062](https://github.com/piscinajs/piscina/issues/1062)) ([#1108](https://github.com/piscinajs/piscina/issues/1108)) ([f290ec8](https://github.com/piscinajs/piscina/commit/f290ec8c4d93cb7341d7093ed857ecb4db1ffc58))
* enable stricter FIFO by default ([#1114](https://github.com/piscinajs/piscina/issues/1114)) ([af6bb3e](https://github.com/piscinajs/piscina/commit/af6bb3eb771fc990aef4d0d18740812108e13105))

## [6.0.0-rc.3](https://github.com/piscinajs/piscina/compare/v6.0.0-rc.2...v6.0.0-rc.3) (2026-07-19)


### ⚠ BREAKING CHANGES

* enable stricter FIFO by default (#1114)
* baseline preparations (#1062) (#1108)

### Features

* add stricterFIFO option for queue fairness ([#1112](https://github.com/piscinajs/piscina/issues/1112)) ([f7f058e](https://github.com/piscinajs/piscina/commit/f7f058e0703605bb344c9f287e11befc815035b5))
* baseline preparations ([#1062](https://github.com/piscinajs/piscina/issues/1062)) ([#1108](https://github.com/piscinajs/piscina/issues/1108)) ([f290ec8](https://github.com/piscinajs/piscina/commit/f290ec8c4d93cb7341d7093ed857ecb4db1ffc58))
* enable stricter FIFO by default ([#1114](https://github.com/piscinajs/piscina/issues/1114)) ([af6bb3e](https://github.com/piscinajs/piscina/commit/af6bb3eb771fc990aef4d0d18740812108e13105))

## [6.0.0-rc.2](https://github.com/piscinajs/piscina/compare/v6.0.0-rc.0...v6.0.0-rc.2) (2026-06-12)


### Features

* Add idleThreads getter ([#1059](https://github.com/piscinajs/piscina/issues/1059)) ([99db27b](https://github.com/piscinajs/piscina/commit/99db27be87b5c26031334d0ac2b3bc7a9fcb7fd5))


### Bug Fixes

* **#1012:** custom name worker functions ([#1047](https://github.com/piscinajs/piscina/issues/1047)) ([8904578](https://github.com/piscinajs/piscina/commit/8904578a79126171a71a8972ee7db3890f1ae387)), closes [#1012](https://github.com/piscinajs/piscina/issues/1012)

## [6.0.0-rc.1](https://github.com/piscinajs/piscina/compare/v6.0.0-rc.0...v6.0.0-rc.1) (2026-05-24)


### Bug Fixes

* **#1012:** custom name worker functions ([#1047](https://github.com/piscinajs/piscina/issues/1047)) ([8904578](https://github.com/piscinajs/piscina/commit/8904578a79126171a71a8972ee7db3890f1ae387)), closes [#1012](https://github.com/piscinajs/piscina/issues/1012)

## [6.0.0-rc.0](https://github.com/piscinajs/piscina/compare/v5.0.0...v6.0.0-rc.0) (2026-05-24)


### ⚠ BREAKING CHANGES

* prepare v6 (#1046)
* drain/needsDrain accounts for task queue (#872)
* make piscina entrypoint easier for typescript (#801)
* apply task id optimization (#858)

### Features

* add explicit resource management support ([#810](https://github.com/piscinajs/piscina/issues/810)) ([d625bba](https://github.com/piscinajs/piscina/commit/d625bbaf17536ba0a5654383206e4126b01db557))
* apply task id optimization ([#858](https://github.com/piscinajs/piscina/issues/858)) ([e3e2d39](https://github.com/piscinajs/piscina/commit/e3e2d39aaae0b57718e9f0bb8c96e981ac5c78fc))
* drain/needsDrain accounts for task queue ([#872](https://github.com/piscinajs/piscina/issues/872)) ([d081228](https://github.com/piscinajs/piscina/commit/d08122804123cbcf90296d9f720d4ca51a08701c))
* make piscina entrypoint easier for typescript ([#801](https://github.com/piscinajs/piscina/issues/801)) ([1a1dbed](https://github.com/piscinajs/piscina/commit/1a1dbed4bec550b7cd907aebde7eb4552a549d0c))
* offload drain events to microtask ([#809](https://github.com/piscinajs/piscina/issues/809)) ([2e6b02f](https://github.com/piscinajs/piscina/commit/2e6b02fd8a877503bc998cb36c4c256663c280c1))
* prepare v6 ([#1046](https://github.com/piscinajs/piscina/issues/1046)) ([302e6bc](https://github.com/piscinajs/piscina/commit/302e6bcf6c2d683414d9948c2fd2752796a222a1))


### Bug Fixes

* **#805:** Fix handling of aborted tasks ([#807](https://github.com/piscinajs/piscina/issues/807)) ([5608520](https://github.com/piscinajs/piscina/commit/5608520bd7d812b253a0373d50572005ab863195))
* add provenance ([#884](https://github.com/piscinajs/piscina/issues/884)) ([5204b9b](https://github.com/piscinajs/piscina/commit/5204b9b3f526a118c94803be7bb2c61a3cb590b1))
* eagerly spawn workers up to maxThreads on cold-pool burst ([#1041](https://github.com/piscinajs/piscina/issues/1041)) ([55fe37b](https://github.com/piscinajs/piscina/commit/55fe37b810665b2007c3bdca14c3fa6fbdd91b7b))
* fix taskDone duplicate listener ([#895](https://github.com/piscinajs/piscina/issues/895)) ([1775b91](https://github.com/piscinajs/piscina/commit/1775b91342b1aac8f0bc43549b42c14b1463e877))
* onWorkerMessage gets skipped in Jest environment  ([#963](https://github.com/piscinajs/piscina/issues/963)) ([2623722](https://github.com/piscinajs/piscina/commit/26237222ddd837dc37bbf0b29337a62618bb8802))
* prevent race condition in idle worker cleanup ([#818](https://github.com/piscinajs/piscina/issues/818)) ([5c24f4f](https://github.com/piscinajs/piscina/commit/5c24f4f675af8ab71944826ea897037aad2f2dd3))
* standardize normalize calculation of stddev ([#923](https://github.com/piscinajs/piscina/issues/923)) ([f4c9ee2](https://github.com/piscinajs/piscina/commit/f4c9ee22d6c4c226afe9f4178b0d24822df51ac6))

### [5.1.1](https://github.com/piscinajs/piscina/compare/v5.1.0...v5.1.1) (2025-06-19)


### Bug Fixes

* prevent race condition in idle worker cleanup ([#818](https://github.com/piscinajs/piscina/issues/818)) ([cafae5d](https://github.com/piscinajs/piscina/commit/cafae5d17340fa07e03bdb39a801fa4733dfb14f))

## [5.1.0](https://github.com/piscinajs/piscina/compare/v5.0.0...v5.1.0) (2025-06-15)


### Features

* add explicit resource management support ([#810](https://github.com/piscinajs/piscina/issues/810)) ([d625bba](https://github.com/piscinajs/piscina/commit/d625bbaf17536ba0a5654383206e4126b01db557))


### Bug Fixes

* **#805:** Fix handling of aborted tasks ([#807](https://github.com/piscinajs/piscina/issues/807)) ([5608520](https://github.com/piscinajs/piscina/commit/5608520bd7d812b253a0373d50572005ab863195))

## [5.0.0](https://github.com/piscinajs/piscina/compare/v5.0.0-alpha.2...v5.0.0) (2025-05-02)


### ⚠ BREAKING CHANGES

* drop v18 (#782)

* drop v18 ([#782](https://github.com/piscinajs/piscina/issues/782)) ([7a87d6b](https://github.com/piscinajs/piscina/commit/7a87d6b16844943ebb237de6bd8285baa81bba0b))

## [5.0.0-alpha.2](https://github.com/piscinajs/piscina/compare/v5.0.0-alpha.1...v5.0.0-alpha.2) (2025-03-16)


### Features

* Allow long-running threads ([#757](https://github.com/piscinajs/piscina/issues/757)) ([f0f4fd3](https://github.com/piscinajs/piscina/commit/f0f4fd39d50dac47b411a2a7aee1ac2d744f0e2f))

## [5.0.0-alpha.1](https://github.com/piscinajs/piscina/compare/v5.0.0-alpha.0...v5.0.0-alpha.1) (2025-01-10)


### ⚠ BREAKING CHANGES

* **#305:** Expose new `PiscinaHistogram` abstraction (#723)

### Features

* **#305:** Expose new `PiscinaHistogram` abstraction ([#723](https://github.com/piscinajs/piscina/issues/723)) ([86d736c](https://github.com/piscinajs/piscina/commit/86d736cf4c239d20e1a403d11a82b7ead0611aa8)), closes [#305](https://github.com/piscinajs/piscina/issues/305)

## [5.0.0-alpha.0](https://github.com/piscinajs/piscina/compare/v4.6.1...v5.0.0-alpha.0) (2024-12-04)


### Features

* Custom Balancer ([#590](https://github.com/piscinajs/piscina/issues/590)) ([5c42b28](https://github.com/piscinajs/piscina/commit/5c42b28942f39399ea4aad39dd1f4367959c1e8f))
* support Atomics.waitAsync ([#687](https://github.com/piscinajs/piscina/issues/687)) ([9c5a19e](https://github.com/piscinajs/piscina/commit/9c5a19ea491b159b82f23512811555a5c4aa2d3f))
* use @napi-rs/nice to support Windows ([#655](https://github.com/piscinajs/piscina/issues/655)) ([c567394](https://github.com/piscinajs/piscina/commit/c56739465000f455fcf7abc2f83501054cab22a4))


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
