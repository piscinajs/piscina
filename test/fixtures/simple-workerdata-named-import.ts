import assert from 'node:assert';
import { workerData } from '../..';

assert.strictEqual(workerData, 'ABC');

export default function () { return 'done'; }
