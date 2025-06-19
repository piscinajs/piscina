import assert from 'node:assert';
import Piscina from '../..';

assert.strictEqual(Piscina.isWorkerThread, true);

export default function () { return 'done'; }
