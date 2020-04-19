'use strict';
import Piscina from '..';
import { test } from 'tap';

test('fileName cannot be non-null/non-string', async ({ throws }) => {
  throws(() => new Piscina(({
    fileName: 12
  }) as any), /options.fileName must be a string or null/);
});

test('minThreads must be non-negative integer', async ({ throws }) => {
  throws(() => new Piscina(({
    minThreads: -1
  }) as any), /options.minThreads must be a non-negative integer/);

  throws(() => new Piscina(({
    minThreads: 'string'
  }) as any), /options.minThreads must be a non-negative integer/);
});

test('maxThreads must be positive integer', async ({ throws }) => {
  throws(() => new Piscina(({
    maxThreads: -1
  }) as any), /options.maxThreads must be a positive integer/);

  throws(() => new Piscina(({
    maxThreads: 0
  }) as any), /options.maxThreads must be a positive integer/);

  throws(() => new Piscina(({
    maxThreads: 'string'
  }) as any), /options.maxThreads must be a positive integer/);
});

test('concurrentTasksPerWorker must be positive integer', async ({ throws }) => {
  throws(() => new Piscina(({
    concurrentTasksPerWorker: -1
  }) as any), /options.concurrentTasksPerWorker must be a positive integer/);

  throws(() => new Piscina(({
    concurrentTasksPerWorker: 0
  }) as any), /options.concurrentTasksPerWorker must be a positive integer/);

  throws(() => new Piscina(({
    concurrentTasksPerWorker: 'string'
  }) as any), /options.concurrentTasksPerWorker must be a positive integer/);
});

test('idleTimeout must be non-negative integer', async ({ throws }) => {
  throws(() => new Piscina(({
    idleTimeout: -1
  }) as any), /options.idleTimeout must be a non-negative integer/);

  throws(() => new Piscina(({
    idleTimeout: 'string'
  }) as any), /options.idleTimeout must be a non-negative integer/);
});

test('maxQueue must be non-negative integer', async ({ throws }) => {
  throws(() => new Piscina(({
    maxQueue: -1
  }) as any), /options.maxQueue must be a non-negative integer/);

  throws(() => new Piscina(({
    maxQueue: 'string'
  }) as any), /options.maxQueue must be a non-negative integer/);
});
