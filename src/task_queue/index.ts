import type { MessagePort } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import { AsyncResource } from 'node:async_hooks';
import assert from 'node:assert';

import type { WorkerInfo } from '../worker_pool';
import type { Task, TaskQueue, PiscinaTask } from './common';

import { onabort, type AbortSignalAny } from '../abort';
import { isMovable } from '../common';
import { kTransferable, kValue, kQueueOptions } from '../symbols';
import { WorkerStream } from '../worker_pool/worker_stream';
import { ResponseMessage } from '../types';


export { ArrayTaskQueue } from './array_queue';
export { FixedQueue } from './fixed_queue';

export type TaskCallback = (err: Error, result: any) => void
export type TaskResponseCallback = (err: Error | null) => void
// Grab the type of `transferList` off `MessagePort`. At the time of writing,
// only ArrayBuffer and MessagePort are valid, but let's avoid having to update
// our types here every time Node.js adds support for more objects.
export type TransferList = MessagePort extends {
  postMessage: (value: any, transferList: infer T) => any
}
  ? T
  : never
export type TransferListItem = TransferList extends Array<infer T> ? T : never

type TaskInfoParameters = {
  task : any;
  transferList : TransferList;
  filename : string;
  name : string;
  abortSignal : AbortSignalAny | null;
  triggerAsyncId : number;
  bufferSize: number;
}

/**
 * Verifies if a given TaskQueue is valid
 *
 * @export
 * @param {*} value
 * @return {*}  {boolean}
 */
export function isTaskQueue (value: TaskQueue): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'size' in value &&
    typeof value.shift === 'function' &&
    typeof value.remove === 'function' &&
    typeof value.push === 'function'
  );
}


function taskIdFactory() {
  let taskIdCounter = 0;
  const maxint = 2147483647;
  return () => {
    taskIdCounter = (taskIdCounter + 1) & maxint;
    return taskIdCounter.toString(36);
  }
}

// Extend AsyncResource so that async relations between posting a task and
// receiving its result are visible to diagnostic tools.
export class TaskInfo extends AsyncResource implements Task {
    static getTaskId: () => string = taskIdFactory();
    callback : TaskCallback;
    onResponseCallback : TaskResponseCallback;
    task : any;
    transferList : TransferList;
    filename : string;
    name : string;
    taskId : string;
    abortSignal : AbortSignalAny | null;
    workerInfo : WorkerInfo | null = null;
    created : number;
    started : number;
    aborted = false;
    redeable: WorkerStream | null = null;
    bufferSize: number;
    _abortListener: (() => void) = () => { this.aborted = true; };
    _abortCleaner: (() => void) | null = null;

    constructor ({
      task,
      transferList,
      filename,
      name,
      abortSignal,
      triggerAsyncId,
      bufferSize
    }: TaskInfoParameters,
    callback: TaskCallback,
    onResponseCallback: TaskResponseCallback) {
      super('Piscina.Task', { requireManualDestroy: true, triggerAsyncId });
      this.callback = callback;
      this.onResponseCallback = onResponseCallback;
      this.task = task;
      this.transferList = transferList;

      // If the task is a Transferable returned by
      // Piscina.move(), then add it to the transferList
      // automatically
      if (isMovable(task)) {
        // This condition should never be hit but typescript
        // complains if we dont do the check.
        /* c8 ignore next */
        if (this.transferList == null) {
          this.transferList = [];
        }
        this.transferList = this.transferList.concat(task[kTransferable]);
        this.task = task[kValue];
      }

      this.filename = filename;
      this.name = name;
      this.taskId = TaskInfo.getTaskId();
      this.abortSignal = abortSignal;
      this.created = performance.now();
      this.started = 0;
      this.bufferSize = bufferSize;
    }

    onAbort (value: (() => void)) {
      this._abortListener = () => {
        this.aborted = true;
        value();
      };
    }

    setAbortListener(signal: AbortSignalAny) : void {
      this._abortCleaner = onabort(signal, this._abortListener);
    }

    releaseTask () : any {
      const ret = this.task;
      this.task = null;
      return ret;
    }

    // Until now, we only assume onResponse hints a streamed response
    handleResponse(result: ResponseMessage) : void {
      const { shared, error } = result;
      assert(shared != null);

      this.redeable = new WorkerStream(shared!);
      this.onResponseCallback(error);
    }

    done (err : Error | null, result? : any) : void {
      if (this.redeable != null && err != null) this.redeable?.destroy(err);

      this.runInAsyncScope(this.callback, null, err, result);
      this.emitDestroy(); // `TaskInfo`s are used only once.
      // If an abort signal was used, remove the listener from it when
      // done to make sure we do not accidentally leak.
      this._abortCleaner?.();
    }

    get [kQueueOptions] () : {} | null {
      return this.task?.[kQueueOptions] ?? null;
    }

    get interface (): PiscinaTask {
      return {
        taskId: this.taskId,
        filename: this.filename,
        name: this.name,
        created: this.created,
        isAbortable: this.abortSignal !== null,
        [kQueueOptions]: this[kQueueOptions]
      };
    }
}

export { Task, TaskQueue, PiscinaTask };
