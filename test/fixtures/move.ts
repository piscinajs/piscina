import * as assert from 'node:assert/strict';
import { types } from 'node:util';
import Piscina from '../..';

export default function (moved) {
  if (moved !== undefined) {
    assert.ok(types.isAnyArrayBuffer(moved));
  }
  return Piscina.move(new ArrayBuffer(10));
}
