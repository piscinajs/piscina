import util from 'util';
const sleep = util.promisify(setTimeout);

async function load () {
  await sleep(500);
  return () => console.log('hello from an async loaded ESM worker');
}

export default load();
