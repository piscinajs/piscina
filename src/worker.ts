import { parentPort, MessagePort } from 'worker_threads';
import { commonState, RequestMessage, ResponseMessage, WarmupMessage } from './common';
commonState.isWorkerThread = true;

const port = parentPort as MessagePort;
port.on('message', (message : RequestMessage | WarmupMessage) => {
  if (message.warmup) {
    import(message.fileName).catch(throwInNextTick);
    return;
  }

  const { taskId, task, fileName } = message;

  (async function () {
    let response : ResponseMessage;
    try {
      let handler = await import(fileName);
      if (typeof handler !== 'function') {
        handler = handler.default;
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
