import Piscina from '..';
import {
  isMovable,
  markMovable,
  isTransferable
} from '../dist/common';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { types } from 'util';
import { MessageChannel, MessagePort } from 'worker_threads';
import { resolve } from 'path';

const {
  transferableSymbol,
  valueSymbol
} = Piscina;

test('Marking an object as movable works as expected', async (t: TestContext) => {
  const obj : any = {
    get [transferableSymbol] () : object { return {}; },
    get [valueSymbol] () : object { return {}; }
  };
  t.assert.ok(isTransferable(obj));
  t.assert.ok(!isMovable(obj)); // It's not movable initially
  markMovable(obj);
  t.assert.ok(isMovable(obj)); // It is movable now
});

test('Marking primitives and null works as expected', async (t: TestContext) => {
  t.assert.strictEqual(Piscina.move(null), null);
  t.assert.strictEqual(Piscina.move(1 as any), 1);
  t.assert.strictEqual(Piscina.move(false as any), false);
  t.assert.strictEqual(Piscina.move('test' as any), 'test');
});

test('Using Piscina.move() returns a movable object', async (t: TestContext) => {
  const obj : any = {
    get [transferableSymbol] () : object { return {}; },
    get [valueSymbol] () : object { return {}; }
  };
  t.assert.ok(!isMovable(obj)); // It's not movable initially
  const movable = Piscina.move(obj);
  t.assert.ok(isMovable(movable)); // It is movable now
});

test('Using ArrayBuffer works as expected', async (t: TestContext) => {
  const ab = new ArrayBuffer(5);
  const movable = Piscina.move(ab);
  t.assert.ok(isMovable(movable));
  t.assert.ok(types.isAnyArrayBuffer(movable[valueSymbol]));
  t.assert.ok(types.isAnyArrayBuffer(movable[transferableSymbol]));
  t.assert.strictEqual(movable[transferableSymbol], ab);
});

test('Using TypedArray works as expected', async (t: TestContext) => {
  const ab = new Uint8Array(5);
  const movable = Piscina.move(ab);
  t.assert.ok(isMovable(movable));
  t.assert.ok((types as any).isArrayBufferView(movable[valueSymbol]));
  t.assert.ok(types.isAnyArrayBuffer(movable[transferableSymbol]));
  t.assert.strictEqual(movable[transferableSymbol], ab.buffer);
});

test('Using MessagePort works as expected', async (t: TestContext) => {
  const mc = new MessageChannel();
  const movable = Piscina.move(mc.port1);
  t.assert.ok(isMovable(movable));
  t.assert.ok(movable[valueSymbol] instanceof MessagePort);
  t.assert.ok(movable[transferableSymbol] instanceof MessagePort);
  t.assert.strictEqual(movable[transferableSymbol], mc.port1);
});

test('Moving works', async (t: TestContext) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/move.ts')
  });

  {
    // Test with empty transferList
    const ab = new ArrayBuffer(10);
    const ret = await pool.run(Piscina.move(ab));
    t.assert.strictEqual(ab.byteLength, 0); // It was moved
    t.assert.ok(types.isAnyArrayBuffer(ret));
  }

  {
    // Test with empty transferList
    const ab = new ArrayBuffer(10);
    const ret = await pool.run(Piscina.move(ab), { transferList: [] });
    t.assert.strictEqual(ab.byteLength, 0); // It was moved
    t.assert.ok(types.isAnyArrayBuffer(ret));
  }
});
