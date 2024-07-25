import type { MessagePort } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import { AsyncResource } from 'node:async_hooks';

import type { WorkerInfo } from '../worker_pool';
import type { AbortSignalAny, AbortSignalEventEmitter } from '../abort';
import { isMovable } from '../common';
import { kTransferable, kValue, kQueueOptions } from '../symbols';

import type { Task, TaskQueue, PiscinaTask } from './common';

export { ArrayTaskQueue } from './array_queue';
export { FixedQueue } from './fixed_queue';

export type TaskCallback = (err: Error, result: any) => void
// Grab the type of `transferList` off `MessagePort`. At the time of writing,
// only ArrayBuffer and MessagePort are valid, but let's avoid having to update
// our types here every time Node.js adds support for more objects.
export type TransferList = MessagePort extends {
  postMessage: (value: any, transferList: infer T) => any
}
  ? T
  : never
export type TransferListItem = TransferList extends Array<infer T> ? T : never

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

let taskIdCounter = 0;
// Extend AsyncResource so that async relations between posting a task and
// receiving its result are visible to diagnostic tools.
export class TaskInfo extends AsyncResource implements Task {
    callback : TaskCallback;
    task : any;
    transferList : TransferList;
    filename : string;
    name : string;
    taskId : number;
    abortSignal : AbortSignalAny | null;
    // abortListener : (() => void) | null = null;
    workerInfo : WorkerInfo | null = null;
    created : number;
    started : number;
    aborted = false;
    _abortListener: (() => void) | null = null;

    constructor (
      task : any,
      transferList : TransferList,
      filename : string,
      name : string,
      callback : TaskCallback,
      abortSignal : AbortSignalAny | null,
      triggerAsyncId : number) {
      super('Piscina.Task', { requireManualDestroy: true, triggerAsyncId });
      this.callback = callback;
      this.task = task;
      this.transferList = transferList;

      // If the task is a Transferable returned by
      // Piscina.move(), then add it to the transferList
      // automatically
      if (isMovable(task)) {
        // This condition should never be hit but typescript
        // complains if we dont do the check.
        /* istanbul ignore if */
        if (this.transferList == null) {
          this.transferList = [];
        }
        this.transferList =
          this.transferList.concat(task[kTransferable]);
        this.task = task[kValue];
      }

      this.filename = filename;
      this.name = name;
      // TODO: This should not be global
      this.taskId = taskIdCounter++;
      this.abortSignal = abortSignal;
      this.created = performance.now();
      this.started = 0;
    }

    // TODO: improve this handling - ideally should be extended
    set abortListener (value: (() => void)) {
      this._abortListener = () => {
        this.aborted = true;
        value();
      };
    }

    get abortListener (): (() => void) | null {
      return this._abortListener;
    }

    releaseTask () : any {
      const ret = this.task;
      this.task = null;
      return ret;
    }

    done (err : Error | null, result? : any) : void {
      this.runInAsyncScope(this.callback, null, err, result);
      this.emitDestroy(); // `TaskInfo`s are used only once.
      // If an abort signal was used, remove the listener from it when
      // done to make sure we do not accidentally leak.
      if (this.abortSignal && this.abortListener) {
        if ('removeEventListener' in this.abortSignal && this.abortListener) {
          this.abortSignal.removeEventListener('abort', this.abortListener);
        } else {
          (this.abortSignal as AbortSignalEventEmitter).off(
            'abort', this.abortListener);
        }
      }
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
