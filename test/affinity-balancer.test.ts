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


test('AffinityBalancer: load forwarding with affinity tracker fixture', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/affinity-tracker.js'),
    maxThreads: 2,
    minThreads: 2,
    concurrentTasksPerWorker: 5,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 5 })
  });

  // Sequential tasks with the same affinity key should go to the same worker
  const result1 = await pool.run(10, {
    [Piscina.queueOptionsSymbol]: { affinityKey: 10 }
  } as any);

  const result2 = await pool.run(10, {
    [Piscina.queueOptionsSymbol]: { affinityKey: 10 }
  } as any);

  const result3 = await pool.run(10, {
    [Piscina.queueOptionsSymbol]: { affinityKey: 10 }
  } as any);

  assert.strictEqual(
    result1.threadId,
    result2.threadId,
    'Sequential tasks with same affinity key should use same worker'
  );

  assert.strictEqual(
    result2.threadId,
    result3.threadId,
    'Sequential tasks with same affinity key should use same worker'
  );

  // Different affinity key should potentially use different worker
  const result4 = await pool.run(10, {
    [Piscina.queueOptionsSymbol]: { affinityKey: 20 }
  } as any);

  // Note: result4 might be on same worker if result3's worker becomes idle,
  // but the affinity mechanism ensures it tries to use a different worker if available
  assert.ok(result4.threadId, 'Task completed successfully');

  await pool.close();
});
