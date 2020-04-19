export interface WarmupMessage {
  warmup: true;
  fileName: string;
}

export interface RequestMessage {
  warmup: false;
  taskId: number;
  task : any;
  fileName: string;
}

export interface ResponseMessage {
  taskId: number;
  result : any;
  error: Error | null;
}

export const commonState = { isWorkerThread: false };
