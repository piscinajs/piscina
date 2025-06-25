import assert from 'node:assert';
import { test } from 'node:test';
import { types } from 'node:util';
import { MessageChannel, MessagePort } from 'node:worker_threads';
import { resolve } from 'node:path';
import Piscina from '..';
import {
  isMovable,
  markMovable,
  isTransferable
} from '../dist/common';

const {
  transferableSymbol,
  valueSymbol
} = Piscina;

test('Marking an object as movable works as expected', () => {
  const obj : any = {
    get [transferableSymbol] () : object { return {}; },
    get [valueSymbol] () : object { return {}; }
  };
  assert.ok(isTransferable(obj));
  assert.ok(!isMovable(obj)); // It's not movable initially
  markMovable(obj);
  assert.ok(isMovable(obj)); // It is movable now
});

test('Marking primitives and null works as expected', () => {
  assert.strictEqual(Piscina.move(null), null);
  assert.strictEqual(Piscina.move(1 as any), 1);
  assert.strictEqual(Piscina.move(false as any), false);
  assert.strictEqual(Piscina.move('test' as any), 'test');
});

test('Using Piscina.move() returns a movable object', () => {
  const obj : any = {
    get [transferableSymbol] () : object { return {}; },
    get [valueSymbol] () : object { return {}; }
  };
  assert.ok(!isMovable(obj)); // It's not movable initially
  const movable = Piscina.move(obj);
  assert.ok(isMovable(movable)); // It is movable now
});

test('Using ArrayBuffer works as expected', () => {
  const ab = new ArrayBuffer(5);
  const movable = Piscina.move(ab);
  assert.ok(isMovable(movable));
  assert.ok(types.isAnyArrayBuffer(movable[valueSymbol]));
  assert.ok(types.isAnyArrayBuffer(movable[transferableSymbol]));
  assert.strictEqual(movable[transferableSymbol], ab);
});

test('Using TypedArray works as expected', () => {
  const ab = new Uint8Array(5);
  const movable = Piscina.move(ab);
  assert.ok(isMovable(movable));
  assert.ok((types as any).isArrayBufferView(movable[valueSymbol]));
  assert.ok(types.isAnyArrayBuffer(movable[transferableSymbol]));
  assert.strictEqual(movable[transferableSymbol], ab.buffer);
});

test('Using MessagePort works as expected', () => {
  const mc = new MessageChannel();
  const movable = Piscina.move(mc.port1);
  assert.ok(isMovable(movable));
  assert.ok(movable[valueSymbol] instanceof MessagePort);
  assert.ok(movable[transferableSymbol] instanceof MessagePort);
  assert.strictEqual(movable[transferableSymbol], mc.port1);
});

test('Moving works', async () => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/move.ts')
  });

  {
    // Test with empty transferList
    const ab = new ArrayBuffer(10);
    const ret = await pool.run(Piscina.move(ab));
    assert.strictEqual(ab.byteLength, 0); // It was moved
    assert.ok(types.isAnyArrayBuffer(ret));
  }

  {
    // Test with empty transferList
    const ab = new ArrayBuffer(10);
    const ret = await pool.run(Piscina.move(ab), { transferList: [] });
    assert.strictEqual(ab.byteLength, 0); // It was moved
    assert.ok(types.isAnyArrayBuffer(ret));
  }
});
