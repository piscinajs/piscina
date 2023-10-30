import { parentPort, MessagePort, receiveMessageOnPort, workerData } from 'worker_threads';
import { pathToFileURL } from 'url';
import {
  READY,
  commonState,
  ReadyMessage,
  RequestMessage,
  ResponseMessage,
  StartupMessage,
  kResponseCountField,
  kRequestCountField,
  isMovable,
  kTransferable,
  kValue
} from './common';

commonState.isWorkerThread = true;
commonState.workerData = workerData;

const handlerCache : Map<string, Function> = new Map();
let useAtomics : boolean = process.env.PISCINA_DISABLE_ATOMICS !== '1';

// Get `import(x)` as a function that isn't transpiled to `require(x)` by
// TypeScript for dual ESM/CJS support.
// Load this lazily, so that there is no warning about the ESM loader being
// experimental (on Node v12.x) until we actually try to use it.
let importESMCached : (specifier : string) => Promise<any> | undefined;
function getImportESM () {
  if (importESMCached === undefined) {
    // eslint-disable-next-line no-new-func
    importESMCached = new Function('specifier', 'return import(specifier)') as typeof importESMCached;
  }
  return importESMCached;
}

// Look up the handler function that we call when a task is posted.
// This is either going to be "the" export from a file, or the default export.
async function getHandler (filename : string, name : string) : Promise<Function | null> {
  let handler = handlerCache.get(`${filename}/${name}`);
  if (handler !== undefined) {
    return handler;
  }

  try {
    // With our current set of TypeScript options, this is transpiled to
    // `require(filename)`.
    handler = await import(filename);
    if (typeof handler !== 'function') {
      handler = await ((handler as any)[name]);
    }
  } catch {}
  if (typeof handler !== 'function') {
    handler = await getImportESM()(pathToFileURL(filename).href);
    if (typeof handler !== 'function') {
      handler = await ((handler as any)[name]);
    }
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

  handlerCache.set(`${filename}/${name}`, handler);
  return handler;
}

// We should only receive this message once, when the Worker starts. It gives
// us the MessagePort used for receiving tasks, a SharedArrayBuffer for fast
// communication using Atomics, and the name of the default filename for tasks
// (so we can pre-load and cache the handler).
parentPort!.on('message', (message : StartupMessage) => {
  useAtomics = process.env.PISCINA_DISABLE_ATOMICS === '1' ? false : message.useAtomics;
  const { port, sharedBuffer, filename, name, niceIncrement } = message;
  (async function () {
    try {
      if (niceIncrement !== 0 && process.platform === 'linux') {
        // ts-ignore because the dependency is not installed on Windows.
        // @ts-ignore
        (await import('nice-napi')).default(niceIncrement);
      }
    } catch {}

    if (filename !== null) {
      await getHandler(filename, name);
    }

    const readyMessage : ReadyMessage = { [READY]: true };
    parentPort!.postMessage(readyMessage);

    port.on('message', onMessage.bind(null, port, sharedBuffer));
    atomicsWaitLoop(port, sharedBuffer);
  })().catch(throwInNextTick);
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
  const { taskId, task, filename, name } = message;

  (async function () {
    let response : ResponseMessage;
    let transferList : any[] = [];
    try {
      const handler = await getHandler(filename, name);
      if (handler === null) {
        throw new Error(`No handler function exported from ${filename}`);
      }
      let result = await handler(task);
      if (isMovable(result)) {
        transferList = transferList.concat(result[kTransferable]);
        result = result[kValue];
      }
      response = {
        taskId,
        result: result,
        error: null
      };

      // If the task used e.g. console.log(), wait for the stream to drain
      // before potentially entering the `Atomics.wait()` loop, and before
      // returning the result so that messages will always be printed even
      // if the process would otherwise be ready to exit.
      if (process.stdout.writableLength > 0) {
        await new Promise((resolve) => process.stdout.write('', resolve));
      }
      if (process.stderr.writableLength > 0) {
        await new Promise((resolve) => process.stderr.write('', resolve));
      }
    } catch (error) {
      response = {
        taskId,
        result: null,
        // It may be worth taking a look at the error cloning algorithm we
        // use in Node.js core here, it's quite a bit more flexible
        error: error instanceof Error ? error : null
      };
    }
    currentTasks--;

    // Post the response to the parent thread, and let it know that we have
    // an additional message available. If possible, use Atomics.wait()
    // to wait for the next message.
    port.postMessage(response, transferList);
    Atomics.add(sharedBuffer, kResponseCountField, 1);
    atomicsWaitLoop(port, sharedBuffer);
  })().catch(throwInNextTick);
}

function throwInNextTick (error : Error) {
  process.nextTick(() => { throw error; });
}
