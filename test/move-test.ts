import Piscina from '..';
import {
  isMovable,
  markMovable,
  isTransferable
} from '../dist/src/common';
import { test } from 'tap';
import { types } from 'util';
import { MessageChannel, MessagePort } from 'worker_threads';
import { resolve } from 'path';

const {
  transferableSymbol,
  valueSymbol
} = Piscina;

test('Marking an object as movable works as expected', async ({ ok }) => {
  const obj : any = {
    get [transferableSymbol] () : object { return {}; },
    get [valueSymbol] () : object { return {}; }
  };
  ok(isTransferable(obj));
  ok(!isMovable(obj)); // It's not movable initially
  markMovable(obj);
  ok(isMovable(obj)); // It is movable now
});

test('Marking primitives and null works as expected', async ({ is }) => {
  is(Piscina.move(null), null);
  is(Piscina.move(1 as any), 1);
  is(Piscina.move(false as any), false);
  is(Piscina.move('test' as any), 'test');
});

test('Using Piscina.move() returns a movable object', async ({ ok }) => {
  const obj : any = {
    get [transferableSymbol] () : object { return {}; },
    get [valueSymbol] () : object { return {}; }
  };
  ok(!isMovable(obj)); // It's not movable initially
  const movable = Piscina.move(obj);
  ok(isMovable(movable)); // It is movable now
});

test('Using ArrayBuffer works as expected', async ({ ok, is }) => {
  const ab = new ArrayBuffer(5);
  const movable = Piscina.move(ab);
  ok(isMovable(movable));
  ok(types.isAnyArrayBuffer(movable[valueSymbol]));
  ok(types.isAnyArrayBuffer(movable[transferableSymbol]));
  is(movable[transferableSymbol], ab);
});

test('Using TypedArray works as expected', async ({ ok, is }) => {
  const ab = new Uint8Array(5);
  const movable = Piscina.move(ab);
  ok(isMovable(movable));
  ok((types as any).isArrayBufferView(movable[valueSymbol]));
  ok(types.isAnyArrayBuffer(movable[transferableSymbol]));
  is(movable[transferableSymbol], ab.buffer);
});

test('Using MessagePort works as expected', async ({ ok, is }) => {
  const mc = new MessageChannel();
  const movable = Piscina.move(mc.port1);
  ok(isMovable(movable));
  ok(movable[valueSymbol] instanceof MessagePort);
  ok(movable[transferableSymbol] instanceof MessagePort);
  is(movable[transferableSymbol], mc.port1);
});

test('Moving works', async ({ is, ok }) => {
  const pool = new Piscina({
    filename: resolve(__dirname, 'fixtures/move.ts')
  });

  {
    const ab = new ArrayBuffer(10);
    const ret = await pool.runTask(Piscina.move(ab));
    is(ab.byteLength, 0); // It was moved
    ok(types.isAnyArrayBuffer(ret));
  }

  {
    // Test with empty transferList
    const ab = new ArrayBuffer(10);
    const ret = await pool.runTask(Piscina.move(ab), []);
    is(ab.byteLength, 0); // It was moved
    ok(types.isAnyArrayBuffer(ret));
  }
});
