import { MessagePortDuplex } from './stream.mjs';

export default function (port) {
  let res;
  const ret = new Promise((resolve) => {
    res = resolve;
  });
  const duplex = new MessagePortDuplex(port);
  duplex.setEncoding('utf8');
  duplex.on('data', (chunk) => duplex.write(chunk.toUpperCase()));
  duplex.on('end', () => {
    duplex.end();
    res();
  });
  return ret;
}
