import { Worker, MessagePort, receiveMessageOnPort } from 'node:worker_threads';
import { createHistogram, RecordableHistogram } from 'node:perf_hooks';
import assert from 'node:assert';

import { RequestMessage, ResponseMessage } from '../types';
import { Errors } from '../errors';

import { TaskInfo } from '../task_queue';
import { kFieldCount, kRequestCountField, kResponseCountField, kWorkerData } from '../symbols';
import { PiscinaHistogramHandler, PiscinaHistogramSummary } from '../histogram';

import { AsynchronouslyCreatedResource, AsynchronouslyCreatedResourcePool } from './base';
export * from './balancer';

type ResponseCallback = (response : ResponseMessage) => void;

export type PiscinaWorker = {
  id: number;
  currentUsage: number;
  isRunningAbortableTask: boolean;
  histogram: PiscinaHistogramSummary | null;
  terminating: boolean;
  destroyed: boolean;
  [kWorkerData]: WorkerInfo;
}

export class WorkerInfo extends AsynchronouslyCreatedResource {
    worker : Worker;
    taskInfos : Map<number, TaskInfo>;
    idleTimeout : NodeJS.Timeout | null = null;
    port : MessagePort;
    sharedBuffer : Int32Array;
    lastSeenResponseCount : number = 0;
    onMessage : ResponseCallback;
    histogram: RecordableHistogram | null;
    terminating = false;
    destroyed = false;

    constructor (
      worker : Worker,
      port : MessagePort,
      onMessage : ResponseCallback,
      enableHistogram: boolean
    ) {
      super();
      this.worker = worker;
      this.port = port;
      this.port.on('message',
        (message : ResponseMessage) => this._handleResponse(message));
      this.onMessage = onMessage;
      this.taskInfos = new Map();
      this.sharedBuffer = new Int32Array(
        new SharedArrayBuffer(kFieldCount * Int32Array.BYTES_PER_ELEMENT));
      this.histogram = enableHistogram ? createHistogram() : null;
    }

    get id (): number {
      return this.worker.threadId;
    }

    destroy () : void {
      if (this.terminating || this.destroyed) return;

      this.terminating = true;
      this.worker.terminate();
      this.port.close();
      this.clearIdleTimeout();
      for (const taskInfo of this.taskInfos.values()) {
        taskInfo.done(Errors.ThreadTermination());
      }
      this.taskInfos.clear();

      this.terminating = false;
      this.destroyed = true;
      this.markAsDestroyed();
    }

    clearIdleTimeout () : void {
      if (this.idleTimeout != null) {
        clearTimeout(this.idleTimeout);
        this.idleTimeout = null;
      }
    }

    ref () : WorkerInfo {
      this.port.ref();
      return this;
    }

    unref () : WorkerInfo {
      // Note: Do not call ref()/unref() on the Worker itself since that may cause
      // a hard crash, see https://github.com/nodejs/node/pull/33394.
      this.port.unref();
      return this;
    }

    _handleResponse (message : ResponseMessage) : void {
      if (message.time != null) {
        this.histogram?.record(PiscinaHistogramHandler.toHistogramIntegerNano(message.time));
      }

      this.onMessage(message);

      if (this.taskInfos.size === 0) {
        // No more tasks running on this Worker means it should not keep the
        // process running.
        this.unref();
      }
    }

    postTask (taskInfo : TaskInfo) {
      assert(!this.taskInfos.has(taskInfo.taskId));
      assert(!this.terminating && !this.destroyed);

      const message : RequestMessage = {
        task: taskInfo.releaseTask(),
        taskId: taskInfo.taskId,
        filename: taskInfo.filename,
        name: taskInfo.name,
        histogramEnabled: this.histogram != null ? 1 : 0
      };

      try {
        this.port.postMessage(message, taskInfo.transferList);
      } catch (err) {
        // This would mostly happen if e.g. message contains unserializable data
        // or transferList is invalid.
        taskInfo.done(<Error>err);
        return;
      }

      taskInfo.workerInfo = this;
      this.taskInfos.set(taskInfo.taskId, taskInfo);
      this.ref();
      this.clearIdleTimeout();

      // Inform the worker that there are new messages posted, and wake it up
      // if it is waiting for one.
      Atomics.add(this.sharedBuffer, kRequestCountField, 1);
      Atomics.notify(this.sharedBuffer, kRequestCountField, 1);
    }

    processPendingMessages () {
      if (this.destroyed) return;
      // If we *know* that there are more messages than we have received using
      // 'message' events yet, then try to load and handle them synchronously,
      // without the need to wait for more expensive events on the event loop.
      // This would usually break async tracking, but in our case, we already have
      // the extra TaskInfo/AsyncResource layer that rectifies that situation.
      const actualResponseCount =
        Atomics.load(this.sharedBuffer, kResponseCountField);
      if (actualResponseCount !== this.lastSeenResponseCount) {
        this.lastSeenResponseCount = actualResponseCount;

        let entry;
        while ((entry = receiveMessageOnPort(this.port)) !== undefined) {
          this._handleResponse(entry.message);
        }
      }
    }

    isRunningAbortableTask () : boolean {
      // If there are abortable tasks, we are running one at most per Worker.
      if (this.taskInfos.size !== 1) return false;
      const [[, task]] = this.taskInfos;
      return task.abortSignal !== null;
    }

    currentUsage () : number {
      if (this.isRunningAbortableTask()) return Infinity;
      return this.taskInfos.size;
    }

    get interface (): PiscinaWorker {
      const worker = this;
      return {
        get id () {
          return worker.worker.threadId;
        },
        get currentUsage () {
          return worker.currentUsage();
        },
        get isRunningAbortableTask () {
          return worker.isRunningAbortableTask();
        },
        get histogram () {
          return worker.histogram != null ? PiscinaHistogramHandler.createHistogramSummary(worker.histogram) : null;
        },
        get terminating () {
          return worker.terminating;
        },
        get destroyed () {
          return worker.destroyed;
        },
        [kWorkerData]: worker
      };
    }
}

export { AsynchronouslyCreatedResourcePool };
