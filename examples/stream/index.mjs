import Piscina from 'piscina';
import { MessagePortDuplex } from './stream.mjs';
import { createReadStream } from 'fs';
import { pipeline } from 'stream';

const pool = new Piscina({
  filename: new URL('./worker.mjs', import.meta.url).href
});

const { port1, port2 } = new MessageChannel();

pool.run(port2, { transferList: [port2] });

const duplex = new MessagePortDuplex(port1);
pipeline(
  createReadStream(new URL('./index.mjs', import.meta.url).pathname),
  duplex,
  process.stdout,
  (err) => { if (err) throw err; });
