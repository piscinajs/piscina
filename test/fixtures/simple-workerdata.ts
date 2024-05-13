import Piscina from '../..';
import assert from 'assert';

assert.strictEqual(Piscina.workerData, 'ABC');

export default function () { return 'done'; }
