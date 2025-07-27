import type { EventEmitter } from 'node:events';

interface AbortSignalEventTargetAddOptions {
  once: boolean;
}

export interface AbortSignalEventTarget {
  addEventListener: (
    name: 'abort',
    listener: () => void,
    options?: AbortSignalEventTargetAddOptions
  ) => void;
  removeEventListener: (name: 'abort', listener: () => void) => void;
  aborted?: boolean;
  reason?: unknown;
}

export interface AbortSignalEventEmitter {
  off: (name: 'abort', listener: () => void) => void;
  once: (name: 'abort', listener: () => void) => void;
}

export type AbortSignalAny = AbortSignalEventTarget | AbortSignalEventEmitter;

export class AbortError extends Error {
  constructor (reason?: AbortSignalEventTarget['reason']) {
    // TS does not recognizes the cause clause
    // @ts-expect-error
    super('The task has been aborted', { cause: reason });
  }

  get name () {
    return 'AbortError';
  }
}

export function onabort (abortSignal: AbortSignalAny, listener: () => void): () => void {
  if ('addEventListener' in abortSignal) {
    abortSignal.addEventListener('abort', listener, { once: true });
    return () => abortSignal.removeEventListener('abort', listener);
  } else {
    abortSignal.once('abort', listener);
    return () => (abortSignal as EventEmitter).removeListener('abort', listener);
  }
}
