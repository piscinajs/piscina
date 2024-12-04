import Piscina from '../../..';
import { isMainThread } from 'worker_threads';

interface Inputs {
  a: number;
  b: number;
}

if (isMainThread) {
  const piscina = new Piscina({ filename: __filename });

  (async function () {
    const task: Inputs = { a: 1, b: 2 };
    console.log(await piscina.run(task));
  })();
} else {
  module.exports = ({ a, b }: Inputs): number => {
    return a + b;
  };
}
