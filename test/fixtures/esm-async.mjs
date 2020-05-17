import util from 'util';
const sleep = util.promisify(setTimeout);

// eslint-disable-next-line no-eval
function handler (code) { return eval(code); }

async function load () {
  await sleep(100);
  return handler;
}

export default load();
