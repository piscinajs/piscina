import assert from 'node:assert';
import { isWorkerThread } from '../..';

assert.strictEqual(isWorkerThread, true);

export default function () { return 'done'; }
