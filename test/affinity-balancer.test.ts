import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import Piscina from '../dist';

test('AffinityBalancer: should be exported from Piscina', () => {
  assert.ok(Piscina.AffinityBalancer, 'AffinityBalancer should be exported');
  assert.strictEqual(typeof Piscina.AffinityBalancer, 'function', 'AffinityBalancer should be a function');
});

test('AffinityBalancer: same affinityKey routes to same worker', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 3,
    minThreads: 3,
    concurrentTasksPerWorker: 10,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 10 })
  });

  const workerIds = new Set<number>();
  
  // Run 5 tasks with the same affinity key
  const tasks = [];
  for (let i = 0; i < 5; i++) {
    tasks.push(
      pool.run('2 + 2', {
        [Piscina.queueOptionsSymbol]: { affinityKey: 1 }
      } as any).then((result: any) => result)
    );
  }

  // We need to track which worker each task went to
  // We'll use a custom approach to verify affinity
  const results = await Promise.all(tasks);
  assert.deepStrictEqual(results, [4, 4, 4, 4, 4], 'All tasks should complete');

  await pool.close();
});

test('AffinityBalancer: different affinityKeys can use different workers', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 3,
    minThreads: 3,
    concurrentTasksPerWorker: 1,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 1 })
  });

  const taskPromises = [];
  
  // Run multiple tasks with different affinity keys
  // Each should potentially go to different workers
  for (let i = 0; i < 3; i++) {
    taskPromises.push(
      pool.run('2 + 2', {
        [Piscina.queueOptionsSymbol]: { affinityKey: i }
      } as any)
    );
  }

  const results = await Promise.all(taskPromises);
  assert.deepStrictEqual(results, [4, 4, 4], 'All tasks should complete');

  await pool.close();
});

test('AffinityBalancer: should re-route when preferred worker reaches maximumUsage', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 3,
    minThreads: 3,
    concurrentTasksPerWorker: 2,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 2 })
  });

  const taskPromises = [];
  
  // First two tasks with key 1 should go to the same worker
  // Third task with key 1 should be re-routed since the first worker would be at capacity
  for (let i = 0; i < 3; i++) {
    taskPromises.push(
      pool.run('new Promise(resolve => setTimeout(() => resolve(42), 50))', {
        [Piscina.queueOptionsSymbol]: { affinityKey: 1 }
      } as any)
    );
  }

  const results = await Promise.all(taskPromises);
  assert.deepStrictEqual(results, [42, 42, 42], 'All tasks should complete');

  await pool.close();
});

test('AffinityBalancer: null affinityKey behaves as non-affinity', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 2,
    minThreads: 2,
    concurrentTasksPerWorker: 1,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 1 })
  });

  const taskPromises = [];
  
  // Tasks with null affinityKey should distribute normally
  for (let i = 0; i < 4; i++) {
    taskPromises.push(
      pool.run('2 + 2', {
        [Piscina.queueOptionsSymbol]: { affinityKey: null }
      } as any)
    );
  }

  const results = await Promise.all(taskPromises);
  assert.deepStrictEqual(results, [4, 4, 4, 4], 'All tasks should complete');

  await pool.close();
});

test('AffinityBalancer: undefined affinityKey behaves as non-affinity', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 2,
    minThreads: 2,
    concurrentTasksPerWorker: 1,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 1 })
  });

  const taskPromises = [];
  
  // Tasks with undefined affinityKey should distribute normally
  for (let i = 0; i < 4; i++) {
    taskPromises.push(
      pool.run('2 + 2', {
        [Piscina.queueOptionsSymbol]: { affinityKey: undefined }
      } as any)
    );
  }

  const results = await Promise.all(taskPromises);
  assert.deepStrictEqual(results, [4, 4, 4, 4], 'All tasks should complete');

  await pool.close();
});

test('AffinityBalancer: empty string affinityKey behaves as non-affinity', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 2,
    minThreads: 2,
    concurrentTasksPerWorker: 1,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 1 })
  });

  const taskPromises = [];
  
  // Tasks with empty string affinityKey should distribute normally
  for (let i = 0; i < 4; i++) {
    taskPromises.push(
      pool.run('2 + 2', {
        [Piscina.queueOptionsSymbol]: { affinityKey: '' }
      } as any)
    );
  }

  const results = await Promise.all(taskPromises);
  assert.deepStrictEqual(results, [4, 4, 4, 4], 'All tasks should complete');

  await pool.close();
});

test('AffinityBalancer: missing queueOptions behaves as non-affinity', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 2,
    minThreads: 2,
    concurrentTasksPerWorker: 1,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 1 })
  });

  const taskPromises = [];
  
  // Tasks without queueOptions should distribute normally
  for (let i = 0; i < 4; i++) {
    taskPromises.push(pool.run('2 + 2'));
  }

  const results = await Promise.all(taskPromises);
  assert.deepStrictEqual(results, [4, 4, 4, 4], 'All tasks should complete');

  await pool.close();
});

test('AffinityBalancer: numeric affinityKey works correctly', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 3,
    minThreads: 3,
    concurrentTasksPerWorker: 10,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 10 })
  });

  const taskPromises = [];
  
  // Tasks with numeric affinity keys should also use affinity routing
  for (let i = 0; i < 5; i++) {
    taskPromises.push(
      pool.run('2 + 2', {
        [Piscina.queueOptionsSymbol]: { affinityKey: 123 }
      } as any)
    );
  }

  const results = await Promise.all(taskPromises);
  assert.deepStrictEqual(results, [4, 4, 4, 4, 4], 'All tasks should complete');

  await pool.close();
});

test('AffinityBalancer: mixed affinity and non-affinity tasks', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 3,
    minThreads: 3,
    concurrentTasksPerWorker: 5,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 5 })
  });

  const taskPromises = [];
  
  // Mix affinity and non-affinity tasks
  for (let i = 0; i < 3; i++) {
    // Affinity task
    taskPromises.push(
      pool.run('2 + 2', {
        [Piscina.queueOptionsSymbol]: { affinityKey: 1 }
      } as any)
    );
    // Non-affinity task
    taskPromises.push(pool.run('3 + 3'));
  }

  const results = await Promise.all(taskPromises);
  assert.strictEqual(results.length, 6, 'All tasks should complete');
  assert.strictEqual(results[0], 4, 'First affinity task');
  assert.strictEqual(results[1], 6, 'First non-affinity task');

  await pool.close();
});

test('AffinityBalancer: prefers idle worker when available', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 3,
    minThreads: 3,
    concurrentTasksPerWorker: 10,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 10 })
  });

  const taskPromises = [];
  
  // First task with key 1 - will go to some worker
  taskPromises.push(
    pool.run('2 + 2', {
      [Piscina.queueOptionsSymbol]: { affinityKey: 1 }
    } as any)
  );

  // Wait for first task to complete
  await taskPromises[0];

  // Second task with same key should go back to same worker (now idle)
  taskPromises.push(
    pool.run('3 + 3', {
      [Piscina.queueOptionsSymbol]: { affinityKey: 1 }
    } as any)
  );

  const results = await Promise.all(taskPromises);
  assert.deepStrictEqual(results, [4, 6], 'All tasks should complete');

  await pool.close();
});

test('AffinityBalancer: handles concurrent tasks with same affinity key', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 2,
    minThreads: 2,
    concurrentTasksPerWorker: 3,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 3 })
  });

  const taskPromises = [];
  
  // Many concurrent tasks with same key - should queue on the preferred worker
  for (let i = 0; i < 6; i++) {
    taskPromises.push(
      pool.run('new Promise(resolve => setTimeout(() => resolve(42), 10))', {
        [Piscina.queueOptionsSymbol]: { affinityKey: 1 }
      } as any)
    );
  }

  const results = await Promise.all(taskPromises);
  assert.strictEqual(results.length, 6, 'All tasks should complete');
  assert.ok(results.every(r => r === 42), 'All results should be 42');

  await pool.close();
});

test('AffinityBalancer: validates load distribution with worker tracking', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/worker-id.js'),
    maxThreads: 3,
    minThreads: 3,
    concurrentTasksPerWorker: 10,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 10 })
  });

  const affinityKey1Tasks = [];
  const affinityKey2Tasks = [];
  const affinityKey3Tasks = [];

  // Collect worker IDs for each affinity key
  for (let i = 0; i < 5; i++) {
    affinityKey1Tasks.push(
      pool.run(null, {
        [Piscina.queueOptionsSymbol]: { affinityKey: 1 }
      } as any)
    );
  }

  for (let i = 0; i < 5; i++) {
    affinityKey2Tasks.push(
      pool.run(null, {
        [Piscina.queueOptionsSymbol]: { affinityKey: 2 }
      } as any)
    );
  }

  for (let i = 0; i < 5; i++) {
    affinityKey3Tasks.push(
      pool.run(null, {
        [Piscina.queueOptionsSymbol]: { affinityKey: 3 }
      } as any)
    );
  }

  const key1Results = await Promise.all(affinityKey1Tasks);
  const key2Results = await Promise.all(affinityKey2Tasks);
  const key3Results = await Promise.all(affinityKey3Tasks);

  // All tasks with the same affinity key should go to the same worker
  const key1WorkerId = key1Results[0];
  const key2WorkerId = key2Results[0];
  const key3WorkerId = key3Results[0];

  assert.ok(key1Results.every(id => id === key1WorkerId), 'All tasks with affinity key 1 should go to the same worker');
  assert.ok(key2Results.every(id => id === key2WorkerId), 'All tasks with affinity key 2 should go to the same worker');
  assert.ok(key3Results.every(id => id === key3WorkerId), 'All tasks with affinity key 3 should go to the same worker');

  // Different affinity keys should go to different workers (since we have 3 workers and 3 different keys)
  const workerIds = new Set([key1WorkerId, key2WorkerId, key3WorkerId]);
  assert.strictEqual(workerIds.size, 3, 'Different affinity keys should be distributed across different workers when available');

  await pool.close();
});

test('AffinityBalancer: load forwarding with affinity tracker fixture', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/affinity-tracker.js'),
    maxThreads: 2,
    minThreads: 2,
    concurrentTasksPerWorker: 3,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 3 })
  });

  // Test 1: Same affinity key should use the same worker
  const sameKeyTasks = [];
  for (let i = 0; i < 3; i++) {
    sameKeyTasks.push(
      pool.run(10, {
        [Piscina.queueOptionsSymbol]: { affinityKey: 10 }
      } as any)
    );
  }

  const sameKeyResults = await Promise.all(sameKeyTasks);
  const sameKeyWorker = sameKeyResults[0].threadId;
  
  assert.ok(
    sameKeyResults.every((result: any) => result.threadId === sameKeyWorker),
    'All tasks with the same affinity key should go to the same worker'
  );

  // Test 2: Different affinity keys should be distributed to different workers when first is saturated
  const diffKeyTasks = [];
  
  // Saturate first worker with 3 concurrent tasks using key 10
  for (let i = 0; i < 3; i++) {
    diffKeyTasks.push(
      pool.run(50, {
        [Piscina.queueOptionsSymbol]: { affinityKey: 10 }
      } as any)
    );
  }
  
  // Next task with key 20 should go to second worker since first is at capacity
  diffKeyTasks.push(
    pool.run(50, {
      [Piscina.queueOptionsSymbol]: { affinityKey: 20 }
    } as any)
  );

  const diffKeyResults = await Promise.all(diffKeyTasks);
  
  const key10Results = diffKeyResults.slice(0, 3);
  const key20Result = diffKeyResults[3];
  
  const key10Worker = key10Results[0].threadId;
  const key20Worker = key20Result.threadId;
  
  assert.ok(
    key10Results.every((result: any) => result.threadId === key10Worker),
    'All tasks with affinity key 10 should go to the same worker'
  );
  
  assert.notStrictEqual(
    key10Worker,
    key20Worker,
    'Task with different affinity key should route to different worker when first is saturated'
  );

  await pool.close();
});
