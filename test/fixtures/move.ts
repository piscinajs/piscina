import Piscina from '../..';
import assert from 'assert';
import { types } from 'util';

export default function (moved) {
  if (moved !== undefined) {
    assert(types.isAnyArrayBuffer(moved));
  }
  return Piscina.move(new ArrayBuffer(10));
}
