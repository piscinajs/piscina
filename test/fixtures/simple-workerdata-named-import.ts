import { workerData } from '../..';
import assert from 'assert';

assert.strictEqual(workerData, 'ABC');

export default function () { return 'done'; }
