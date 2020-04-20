import type { MessagePort } from 'worker_threads';

export interface WarmupMessage {
  fileName : string | null;
  port : MessagePort;
  sharedBuffer : Int32Array;
  useAtomics : boolean;
}

export interface RequestMessage {
  taskId : number;
  task : any;
  fileName: string;
}

export interface ResponseMessage {
  taskId : number;
  result : any;
  error: Error | null;
}

export const commonState = { isWorkerThread: false };

export const kRequestCountField = 0;
export const kResponseCountField = 1;
export const kFieldCount = 2;
