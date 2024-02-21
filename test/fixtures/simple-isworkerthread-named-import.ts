import { isWorkerThread } from '../..';
import assert from 'assert';

assert.strictEqual(isWorkerThread, true);

export default function () { return 'done'; }
