import type { MessagePort } from 'worker_threads';

export interface StartupMessage {
  filename : string | null;
  port : MessagePort;
  sharedBuffer : Int32Array;
  useAtomics : boolean;
}

export interface RequestMessage {
  taskId : number;
  task : any;
  filename: string;
}

export interface ResponseMessage {
  taskId : number;
  result : any;
  error: Error | null;
}

export const commonState = {
  isWorkerThread: false,
  workerData: undefined
};

export const kRequestCountField = 0;
export const kResponseCountField = 1;
export const kFieldCount = 2;
