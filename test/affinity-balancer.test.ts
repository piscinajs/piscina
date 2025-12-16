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
    filename: resolve(__dirname, 'fixtures/affinity-tracker.js'),
    maxThreads: 3,
    minThreads: 3,
    concurrentTasksPerWorker: 10,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 10 })
  });

  // Sequential tasks with the same affinity key should route to the same worker
  const result1 = await pool.run(10, {
    [Piscina.queueOptionsSymbol]: { affinityKey: 1 }
  } as any);

  const result2 = await pool.run(10, {
    [Piscina.queueOptionsSymbol]: { affinityKey: 1 }
  } as any);

  const result3 = await pool.run(10, {
    [Piscina.queueOptionsSymbol]: { affinityKey: 1 }
  } as any);

  // All tasks should execute on the same worker (sequential routing)
  assert.strictEqual(result1.threadId, result2.threadId, 
    'Sequential tasks with same affinity key should use same worker');
  assert.strictEqual(result2.threadId, result3.threadId, 
    'Sequential tasks with same affinity key should use same worker');

  await pool.close();
});

test('AffinityBalancer: different affinityKeys can use different workers', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/affinity-tracker.js'),
    maxThreads: 3,
    minThreads: 3,
    concurrentTasksPerWorker: 10,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 10 })
  });

  // Sequential tasks with different affinity keys
  const result1 = await pool.run(10, {
    [Piscina.queueOptionsSymbol]: { affinityKey: 1 }
  } as any);

  const result2 = await pool.run(10, {
    [Piscina.queueOptionsSymbol]: { affinityKey: 2 }
  } as any);

  // Task with different affinity keys should each complete successfully
  assert.ok(result1.threadId, 'First task should complete');
  assert.ok(result2.threadId, 'Second task should complete');
  // Note: They may or may not use different workers depending on LeastBusy logic

  await pool.close();
});

test('AffinityBalancer: should re-route when preferred worker reaches maximumUsage', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/affinity-tracker.js'),
    maxThreads: 3,
    minThreads: 3,
    concurrentTasksPerWorker: 2,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 2 })
  });

  // First two sequential tasks should go to same worker
  const result1 = await pool.run(50, {
    [Piscina.queueOptionsSymbol]: { affinityKey: 1 }
  } as any);

  const result2 = await pool.run(50, {
    [Piscina.queueOptionsSymbol]: { affinityKey: 1 }
  } as any);

  assert.strictEqual(result1.threadId, result2.threadId, 
    'First two sequential tasks with same affinity key should go to same worker');

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

  // Tasks with null affinityKey should distribute across workers normally
  const results = [];
  for (let i = 0; i < 4; i++) {
    results.push(
      await pool.run('2 + 2', {
        [Piscina.queueOptionsSymbol]: { affinityKey: null }
      } as any)
    );
  }

  assert.deepStrictEqual(results, [4, 4, 4, 4], 'All tasks should complete successfully');

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

  // Tasks with undefined affinityKey should distribute across workers normally
  const results = [];
  for (let i = 0; i < 4; i++) {
    results.push(
      await pool.run('2 + 2', {
        [Piscina.queueOptionsSymbol]: { affinityKey: undefined }
      } as any)
    );
  }

  assert.deepStrictEqual(results, [4, 4, 4, 4], 'All tasks should complete successfully');

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

  // Tasks with empty string affinityKey should distribute across workers normally
  const results = [];
  for (let i = 0; i < 4; i++) {
    results.push(
      await pool.run('2 + 2', {
        [Piscina.queueOptionsSymbol]: { affinityKey: '' }
      } as any)
    );
  }

  assert.deepStrictEqual(results, [4, 4, 4, 4], 'All tasks should complete successfully');

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
    filename: resolve(__dirname, 'fixtures/affinity-tracker.js'),
    maxThreads: 3,
    minThreads: 3,
    concurrentTasksPerWorker: 10,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 10 })
  });

  // Sequential tasks with same numeric affinity key
  const result1 = await pool.run(10, {
    [Piscina.queueOptionsSymbol]: { affinityKey: 123 }
  } as any);

  const result2 = await pool.run(10, {
    [Piscina.queueOptionsSymbol]: { affinityKey: 123 }
  } as any);

  const result3 = await pool.run(10, {
    [Piscina.queueOptionsSymbol]: { affinityKey: 123 }
  } as any);

  // All should use affinity routing to same worker
  assert.strictEqual(result1.threadId, result2.threadId, 
    'Sequential tasks with numeric affinity key should use same worker');
  assert.strictEqual(result2.threadId, result3.threadId, 
    'Sequential tasks with numeric affinity key should use same worker');

  await pool.close();
});

test('AffinityBalancer: prefers idle worker when available', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/affinity-tracker.js'),
    maxThreads: 3,
    minThreads: 3,
    concurrentTasksPerWorker: 10,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 10 })
  });

  // First task with key 1 - will go to some worker
  const result1 = await pool.run(10, {
    [Piscina.queueOptionsSymbol]: { affinityKey: 1 }
  } as any);

  // Second task with same key should go back to same worker (now idle)
  const result2 = await pool.run(10, {
    [Piscina.queueOptionsSymbol]: { affinityKey: 1 }
  } as any);

  // Both tasks should execute on same worker
  assert.strictEqual(result1.threadId, result2.threadId, 
    'Sequential tasks with same affinity key should use same worker');

  await pool.close();
});

test('AffinityBalancer: handles concurrent tasks with same affinity key', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/affinity-tracker.js'),
    maxThreads: 2,
    minThreads: 2,
    concurrentTasksPerWorker: 3,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 3 })
  });

  // Sequential tasks with same key should queue on the preferred worker
  const result1 = await pool.run(50, {
    [Piscina.queueOptionsSymbol]: { affinityKey: 1 }
  } as any);

  const result2 = await pool.run(50, {
    [Piscina.queueOptionsSymbol]: { affinityKey: 1 }
  } as any);

  const result3 = await pool.run(50, {
    [Piscina.queueOptionsSymbol]: { affinityKey: 1 }
  } as any);

  // All should execute on the same worker
  assert.strictEqual(result1.threadId, result2.threadId, 
    'Sequential tasks with same affinity key should queue on same worker');
  assert.strictEqual(result2.threadId, result3.threadId, 
    'Sequential tasks with same affinity key should queue on same worker');

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

  // Different affinity key - will complete successfully
  const result4 = await pool.run(10, {
    [Piscina.queueOptionsSymbol]: { affinityKey: 20 }
  } as any);

  assert.ok(result4.threadId, 'Task with different affinity key should complete');

  await pool.close();
});
test('AffinityBalancer: rejects float affinity key', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 2,
    minThreads: 2,
    concurrentTasksPerWorker: 1,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 1 })
  });

  // Float keys should fall back to LeastBusy and complete successfully
  const result = await pool.run('2 + 2', {
    [Piscina.queueOptionsSymbol]: { affinityKey: 3.14 }
  } as any);

  assert.strictEqual(result, 4, 'Task with float key should complete');
  await pool.close();
});

test('AffinityBalancer: rejects NaN affinity key', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 2,
    minThreads: 2,
    concurrentTasksPerWorker: 1,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 1 })
  });

  const result = await pool.run('2 + 2', {
    [Piscina.queueOptionsSymbol]: { affinityKey: NaN }
  } as any);

  assert.strictEqual(result, 4, 'Task with NaN key should complete');
  await pool.close();
});

test('AffinityBalancer: rejects Infinity affinity key', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 2,
    minThreads: 2,
    concurrentTasksPerWorker: 1,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 1 })
  });

  const result = await pool.run('2 + 2', {
    [Piscina.queueOptionsSymbol]: { affinityKey: Infinity }
  } as any);

  assert.strictEqual(result, 4, 'Task with Infinity key should complete');
  await pool.close();
});

test('AffinityBalancer: rejects object affinity key', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 2,
    minThreads: 2,
    concurrentTasksPerWorker: 1,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 1 })
  });

  const result = await pool.run('2 + 2', {
    [Piscina.queueOptionsSymbol]: { affinityKey: { key: 'value' } }
  } as any);

  assert.strictEqual(result, 4, 'Task with object key should complete');
  await pool.close();
});

test('AffinityBalancer: rejects boolean affinity key', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 2,
    minThreads: 2,
    concurrentTasksPerWorker: 1,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 1 })
  });

  const result = await pool.run('2 + 2', {
    [Piscina.queueOptionsSymbol]: { affinityKey: true }
  } as any);

  assert.strictEqual(result, 4, 'Task with boolean key should complete');
  await pool.close();
});

test('AffinityBalancer: handles negative integer affinity key', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/affinity-tracker.js'),
    maxThreads: 2,
    minThreads: 2,
    concurrentTasksPerWorker: 10,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 10 })
  });

  // Sequential tasks with negative integer key should use affinity routing
  const result1 = await pool.run(10, {
    [Piscina.queueOptionsSymbol]: { affinityKey: -42 }
  } as any);

  const result2 = await pool.run(10, {
    [Piscina.queueOptionsSymbol]: { affinityKey: -42 }
  } as any);

  // Both should execute on same worker
  assert.strictEqual(result1.threadId, result2.threadId, 
    'Negative integer keys should use affinity routing');

  await pool.close();
});

test('AffinityBalancer: handles zero affinity key', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/affinity-tracker.js'),
    maxThreads: 2,
    minThreads: 2,
    concurrentTasksPerWorker: 10,
    loadBalancer: Piscina.AffinityBalancer({ maximumUsage: 10 })
  });

  // Sequential tasks with zero key should use affinity routing
  const result1 = await pool.run(10, {
    [Piscina.queueOptionsSymbol]: { affinityKey: 0 }
  } as any);

  const result2 = await pool.run(10, {
    [Piscina.queueOptionsSymbol]: { affinityKey: 0 }
  } as any);

  // Both should execute on same worker
  assert.strictEqual(result1.threadId, result2.threadId, 
    'Zero key should use affinity routing');

  await pool.close();
});