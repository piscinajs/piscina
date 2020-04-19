import { parentPort, MessagePort } from 'worker_threads';
import { commonState, RequestMessage, ResponseMessage, WarmupMessage } from './common';
commonState.isWorkerThread = true;

const handlerCache : Map<string, Function> = new Map();

async function getHandler (fileName : string) : Promise<Function | null> {
  let handler = handlerCache.get(fileName);
  if (handler !== undefined) {
    return handler;
  }

  handler = await import(fileName);
  if (typeof handler !== 'function') {
    handler = (handler as any).default;
  }
  if (typeof handler !== 'function') {
    return null;
  }

  handlerCache.set(fileName, handler);
  return handler;
}

const port = parentPort as MessagePort;
port.on('message', (message : RequestMessage | WarmupMessage) => {
  if (message.warmup) {
    getHandler(message.fileName).catch(throwInNextTick);
    return;
  }

  const { taskId, task, fileName } = message;

  (async function () {
    let response : ResponseMessage;
    try {
      const handler = await getHandler(fileName);
      if (handler === null) {
        throw new Error(`No handler functionn exported from ${fileName}`);
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
        error
      };
    }
    port.postMessage(response);
  })().catch(throwInNextTick);
});

function throwInNextTick (error : Error) {
  process.nextTick(() => { throw error; });
}
