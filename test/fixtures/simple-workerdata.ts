import assert from 'node:assert';
import Piscina from '../..';

assert.strictEqual(Piscina.workerData, 'ABC');

export default function () { return 'done'; }
