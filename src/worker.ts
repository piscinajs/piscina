import { parentPort, MessagePort } from 'worker_threads'; // eslint-disable-line
import { commonState, RequestMessage, ResponseMessage, StartupMessage, kResponseCountField, kRequestCountField } from './common';
// TODO(addaleax): Undo when https://github.com/DefinitelyTyped/DefinitelyTyped/pull/44034 is released.
import wt from 'worker_threads'; // eslint-disable-line
const { receiveMessageOnPort, workerData } = wt as any;

commonState.isWorkerThread = true;
commonState.workerData = workerData;

const handlerCache : Map<string, Function> = new Map();
let useAtomics : boolean = true;

// Look up the handler function that we call when a task is posted.
// This is either going to be "the" export from a file, or the default export.
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

  // Limit the handler cache size. This should not usually be an issue and is
  // only provided for pathological cases.
  if (handlerCache.size > 1000) {
    const [[key]] = handlerCache;
    handlerCache.delete(key);
  }

  handlerCache.set(filename, handler);
  return handler;
}

// We should only receive this message once, when the Worker starts. It gives
// us the MessagePort used for receiving tasks, a SharedArrayBuffer for fast
// communication using Atomics, and the name of the default filename for tasks
// (so we can pre-load and cache the handler).
parentPort!.on('message', (message : StartupMessage) => {
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

  // This function is entered either after receiving the startup message, or
  // when we are done with a task. In those situations, the *only* thing we
  // expect to happen next is a 'message' on `port`.
  // That call would come with the overhead of a C++ → JS boundary crossing,
  // including async tracking. So, instead, if there is no task currently
  // running, we wait for a signal from the parent thread using Atomics.wait(),
  // and read the message from the port instead of generating an event,
  // in order to avoid that overhead.
  // The one catch is that this stops asynchronous operations that are still
  // running from proceeding. Generally, tasks should not spawn asynchronous
  // operations without waiting for them to finish, though.
  while (currentTasks === 0) {
    // Check whether there are new messages by testing whether the current
    // number of requests posted by the parent thread matches the number of
    // requests received.
    Atomics.wait(sharedBuffer, kRequestCountField, lastSeenRequestCount);
    lastSeenRequestCount = Atomics.load(sharedBuffer, kRequestCountField);

    // We have to read messages *after* updating lastSeenRequestCount in order
    // to avoid race conditions.
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

    // Post the response to the parent thread, and let it know that we have
    // an additional message available. If possible, use Atomics.wait()
    // to wait for the next message.
    port.postMessage(response);
    Atomics.add(sharedBuffer, kResponseCountField, 1);
    atomicsWaitLoop(port, sharedBuffer);
  })().catch(throwInNextTick);
}

function throwInNextTick (error : Error) {
  process.nextTick(() => { throw error; });
}
