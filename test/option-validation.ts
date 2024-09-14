import Piscina from '..';
import { test } from 'tap';

test('filename cannot be non-null/non-string', async ({ throws }) => {
  throws(() => new Piscina(({
    filename: 12
  }) as any), /options.filename must be a string or null/);
});

test('name cannot be non-null/non-string', async ({ throws }) => {
  throws(() => new Piscina(({
    name: 12
  }) as any), /options.name must be a string or null/);
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

test('maxQueue must be non-negative integer', async ({ throws, equal }) => {
  throws(() => new Piscina(({
    maxQueue: -1
  }) as any), /options.maxQueue must be a non-negative integer/);

  throws(() => new Piscina(({
    maxQueue: 'string'
  }) as any), /options.maxQueue must be a non-negative integer/);

  const p = new Piscina({ maxQueue: 'auto', maxThreads: 2 });
  equal(p.options.maxQueue, 4);
});

test('useAtomics must be a boolean', async ({ throws }) => {
  throws(() => new Piscina(({
    useAtomics: -1
  }) as any), /options.useAtomics must be a boolean/);

  throws(() => new Piscina(({
    useAtomics: 'string'
  }) as any), /options.useAtomics must be a boolean/);
});

test('resourceLimits must be an object', async ({ throws }) => {
  throws(() => new Piscina(({
    resourceLimits: 0
  }) as any), /options.resourceLimits must be an object/);
});

test('taskQueue must be a TaskQueue object', async ({ throws }) => {
  throws(() => new Piscina(({
    taskQueue: 0
  }) as any), /options.taskQueue must be a TaskQueue object/);
  throws(() => new Piscina(({
    taskQueue: 'test'
  }) as any), /options.taskQueue must be a TaskQueue object/);
  throws(() => new Piscina(({
    taskQueue: null
  }) as any), /options.taskQueue must be a TaskQueue object/);
  throws(() => new Piscina(({
    taskQueue: new Date()
  }) as any), /options.taskQueue must be a TaskQueue object/);
  throws(() => new Piscina(({
    taskQueue: { } as any
  }) as any), /options.taskQueue must be a TaskQueue object/);
});

test('niceIncrement must be non-negative integer on Unix', {
  skip: process.platform === 'win32' ? 'Unix options validate' : false
}, async ({ throws }) => {
  throws(() => new Piscina(({
    niceIncrement: -1
  }) as any), /options.niceIncrement must be a non-negative integer/);

  throws(() => new Piscina(({
    niceIncrement: 'string'
  }) as any), /options.niceIncrement must be a non-negative integer/);
});

test('trackUnmanagedFds must be a boolean', async ({ throws }) => {
  throws(() => new Piscina(({
    trackUnmanagedFds: -1
  }) as any), /options.trackUnmanagedFds must be a boolean/);

  throws(() => new Piscina(({
    trackUnmanagedFds: 'string'
  }) as any), /options.trackUnmanagedFds must be a boolean/);
});
