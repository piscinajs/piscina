import { parentPort, MessagePort, receiveMessageOnPort } from 'worker_threads';
import { commonState, RequestMessage, ResponseMessage, WarmupMessage, kResponseCountField, kRequestCountField } from './common';
commonState.isWorkerThread = true;

const handlerCache : Map<string, Function> = new Map();
let useAtomics : boolean = true;

async function getHandler (filename : string) : Promise<Function | null> {
  let handler = handlerCache.get(filename);
  if (handler !== undefined) {
    return handler;
  }

  handler = await import(filename);
  if (typeof handler !== 'function') {
    handler = (handler as any).default;
  }
  if (typeof handler !== 'function') {
    return null;
  }

  handlerCache.set(filename, handler);
  return handler;
}

parentPort!.on('message', (message : WarmupMessage) => {
  useAtomics = message.useAtomics;
  const { port, sharedBuffer, filename } = message;
  if (filename !== null) {
    getHandler(filename).catch(throwInNextTick);
  }

  port.on('message', onMessage.bind(null, port, sharedBuffer));
  atomicsWaitLoop(port, sharedBuffer);
});

let currentTasks : number = 0;
let lastSeenRequestCount : number = 0;
function atomicsWaitLoop (port : MessagePort, sharedBuffer : Int32Array) {
  if (!useAtomics) return;

  while (currentTasks === 0) {
    Atomics.wait(sharedBuffer, kRequestCountField, lastSeenRequestCount);
    lastSeenRequestCount = Atomics.load(sharedBuffer, kRequestCountField);

    let entry;
    while ((entry = receiveMessageOnPort(port)) !== undefined) {
      onMessage(port, sharedBuffer, entry.message);
    }
  }
}

function onMessage (
  port : MessagePort,
  sharedBuffer : Int32Array,
  message : RequestMessage) {
  currentTasks++;
  const { taskId, task, filename } = message;

  (async function () {
    let response : ResponseMessage;
    try {
      const handler = await getHandler(filename);
      if (handler === null) {
        throw new Error(`No handler function exported from ${filename}`);
      }
      const result = await handler(task);
      response = {
        taskId,
        result: result,
        error: null
      };
    } catch (error) {
      response = {
        taskId,
        result: null,
        // It may be worth taking a look at the error cloning algorithm we
        // use in Node.js core here, it's quite a bit more flexible
        error
      };
    }
    currentTasks--;
    port.postMessage(response);
    Atomics.add(sharedBuffer, kResponseCountField, 1);
    atomicsWaitLoop(port, sharedBuffer);
  })().catch(throwInNextTick);
}

function throwInNextTick (error : Error) {
  process.nextTick(() => { throw error; });
}
