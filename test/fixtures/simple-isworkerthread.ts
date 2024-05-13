import Piscina from '../..';
import assert from 'assert';

assert.strictEqual(Piscina.isWorkerThread, true);

export default function () { return 'done'; }
