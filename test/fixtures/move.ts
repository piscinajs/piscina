import assert from 'node:assert';
import { types } from 'node:util';
import Piscina from '../..';

export default function (moved) {
  if (moved !== undefined) {
    assert(types.isAnyArrayBuffer(moved));
  }
  return Piscina.move(new ArrayBuffer(10));
}
