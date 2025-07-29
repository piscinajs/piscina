import { Worker, MessagePort, receiveMessageOnPort, WorkerOptions, Transferable } from 'node:worker_threads';
import { createHistogram, RecordableHistogram } from 'node:perf_hooks';
import assert from 'node:assert';

import { RequestMessage, ResponseMessage, StartupMessage } from '../types';
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

type WorkerInfoParams = {
  worker: {
    filename: string,
  } & WorkerOptions,
  port: MessagePort,
  enableHistogram: boolean,
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
      {
        worker,
        port,
        enableHistogram
      }: WorkerInfoParams,
      onMessage: ResponseCallback
    ) {
      super();
      const { filename, ...workerOpts } = worker;
      this.worker = new Worker(filename, workerOpts);
      this.port = port;
      this.onMessage = onMessage;
      this.port.on('message', this._handleResponse.bind(this));
      this.taskInfos = new Map();
      this.sharedBuffer = new Int32Array(
        new SharedArrayBuffer(kFieldCount * Int32Array.BYTES_PER_ELEMENT));
      this.histogram = enableHistogram ? createHistogram() : null;
    }

    get id (): number {
      return this.worker.threadId;
    }

    onWorkerMessage(handler: (msg: any) => void): void {
      this.worker.on('message', handler);
    }

    onWorkerError(handler: (err: Error) => void): void {
      this.worker.on('error', handler);
    }

    onWorkerExit(handler: (code: number) => void): void {
      this.worker.on('exit', handler);
    }

    onPortClose(handler: () => void): void {
      this.port.on('close', handler);
    }

    init(msg: StartupMessage, toTransfer: Transferable[]): WorkerInfo {
      this.worker.postMessage(msg, toTransfer);
      return this;
    }

    workerRef(): WorkerInfo {
      this.worker.ref();
      return this;
    }

    workerUnref(): WorkerInfo {
      this.worker.unref();
      return this;
    }

    destroy () : void {
      if (this.terminating || this.destroyed) return;

      this.terminating = true;
      this.clearIdleTimeout();
      this.worker.terminate();
      this.port.close();
      for (const taskInfo of this.taskInfos.values()) {
        taskInfo.done(Errors.ThreadTermination());
      }
      this.taskInfos.clear();

      this.terminating = false;
      this.destroyed = true;
      this.markAsDestroyed();
    }

    setIdleTimeout (handler: (_: void) => void, ms: number, ...args: any[]) : void {
      this.idleTimeout = setTimeout(handler, ms, ...args).unref();
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
      this.port.unref();
      return this;
    }

    _handleResponse (message : ResponseMessage) : void {
      // Both cannot be in different state if histogram enabled.
      this.histogram?.record(PiscinaHistogramHandler.toHistogramIntegerNano(message?.time!));

      this.onMessage(message);

      if (this.taskInfos.size === 0) {
        // No more tasks running on this Worker means it should not keep the
        // process running.
        this.unref();
      }
    }

    postTask (taskInfo : TaskInfo) {
      // Avoid duplicates
      assert(!this.taskInfos.has(taskInfo.taskId));
      // Avoid posting when pool is shutting down or worker already destroyed
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
        queueMicrotask(() => this.clearIdleTimeout())
        taskInfo.workerInfo = this;
        this.taskInfos.set(taskInfo.taskId, taskInfo);
        this.ref();

        // Inform the worker that there are new messages posted, and wake it up
        // if it is waiting for one.
        Atomics.add(this.sharedBuffer, kRequestCountField, 1);
        Atomics.notify(this.sharedBuffer, kRequestCountField, 1);
      } catch (err) {
        // This would mostly happen if e.g. message contains unserializable data
        // or transferList is invalid.
        taskInfo.done(<Error>err);
      }
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
        while ((entry = receiveMessageOnPort(this.port)) != null) {
          this._handleResponse(entry.message);
        }
      }
    }

    isRunningAbortableTask () : boolean {
      // If there are abortable tasks, we are running one at most per Worker.
      if (this.taskInfos.size !== 1) return false;
      const [[, task]] = this.taskInfos;
      return task.abortSignal != null;
    }

    currentUsage () : number {
      return this.isRunningAbortableTask() ? Infinity : this.taskInfos.size;
    }

    popTask (taskId: number) : TaskInfo | null {
      const task = this.taskInfos.get(taskId) ?? null;

      if (task != null) this.taskInfos.delete(taskId);

      return task;
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
