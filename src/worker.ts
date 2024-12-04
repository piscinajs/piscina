import { parentPort, MessagePort, receiveMessageOnPort, workerData } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

import type {
  ReadyMessage,
  RequestMessage,
  ResponseMessage,
  StartupMessage
} from './types';
import {
  kResponseCountField,
  kRequestCountField,
  kTransferable,
  kValue
} from './symbols';
import {
  READY,
  commonState,
  isMovable
} from './common';

commonState.isWorkerThread = true;
commonState.workerData = workerData;

function noop (): void {}

const handlerCache : Map<string, Function> = new Map();
let useAtomics : boolean = process.env.PISCINA_DISABLE_ATOMICS !== '1';
let useAsyncAtomics : boolean = process.env.PISCINA_ENABLE_ASYNC_ATOMICS === '1';

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
  if (handler != null) {
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
parentPort!.on('message', async (message: StartupMessage) => {
  const { port, sharedBuffer, filename, name, niceIncrement } = message;

  if (niceIncrement !== 0) {
    (await import('@napi-rs/nice').catch(noop))?.nice(niceIncrement);
  }

  try {
    if (filename != null) {
      await getHandler(filename, name);
    }

    const readyMessage : ReadyMessage = { [READY]: true };
    useAtomics = useAtomics !== false && message.atomics !== 'disabled';
    useAsyncAtomics = useAtomics !== false && (useAsyncAtomics || message.atomics === 'async');
    parentPort!.postMessage(readyMessage);

    port.on('message', onMessage.bind(null, port, sharedBuffer));
    if (useAtomics) {
      const res = atomicsWaitLoop(port, sharedBuffer);

      if (res?.then != null) await res;
    }
  } catch (error) {
    throwInNextTick(error as Error);
  }
});

let currentTasks : number = 0;
let lastSeenRequestCount : number = 0;

function atomicsWaitLoop (port : MessagePort, sharedBuffer : Int32Array) {
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

  if (useAsyncAtomics === true) {
    // @ts-expect-error - for some reason not supported by TS
    const { async, value } = Atomics.waitAsync(sharedBuffer, kRequestCountField, lastSeenRequestCount);

    // We do not check for result
    return async === true && value.then(() => {
      lastSeenRequestCount = Atomics.load(sharedBuffer, kRequestCountField);

      // We have to read messages *after* updating lastSeenRequestCount in order
      // to avoid race conditions.
      let entry;
      while ((entry = receiveMessageOnPort(port)) !== undefined) {
        onMessage(port, sharedBuffer, entry.message);
      }
    });
  }

  while (currentTasks === 0) {
    // Check whether there are new messages by testing whether the current
    // number of requests posted by the parent thread matches the number of
    // requests received.
    // We do not check for result
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

async function onMessage (
  port : MessagePort,
  sharedBuffer : Int32Array,
  message : RequestMessage) {
  currentTasks++;
  const { taskId, task, filename, name } = message;
  let response : ResponseMessage;
  let transferList : any[] = [];
  const start = message.histogramEnabled === 1 ? performance.now() : null;

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
      result,
      error: null,
      time: start == null ? null : Math.round(performance.now() - start)
    };

    if (useAtomics && !useAsyncAtomics) {
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
    }
  } catch (error) {
    response = {
      taskId,
      result: null,
      // It may be worth taking a look at the error cloning algorithm we
      // use in Node.js core here, it's quite a bit more flexible
      error: <Error>error,
      time: start == null ? null : Math.round(performance.now() - start)
    };
  }
  currentTasks--;

  try {
    // Post the response to the parent thread, and let it know that we have
    // an additional message available. If possible, use Atomics.wait()
    // to wait for the next message.
    port.postMessage(response, transferList);
    Atomics.add(sharedBuffer, kResponseCountField, 1);
    if (useAtomics) {
      const res = atomicsWaitLoop(port, sharedBuffer);

      if (res?.then != null) await res;
    }
  } catch (error) {
    throwInNextTick(error as Error);
  }
}

function throwInNextTick (error : Error) {
  process.nextTick((e: Error) => { throw e; }, error);
}
