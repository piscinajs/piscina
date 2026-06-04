// Error Abstractions

const kPiscinaError = Symbol.for('Piscina.Error.Base');
class PiscinaError extends Error {
  code: string;
  
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PiscinaError';
    this.code = 'PISCINA_ERR'
  }

  static [Symbol.hasInstance](instance: any) {
    return instance != null && instance[kPiscinaError] === true;
  }

  get [kPiscinaError]() {
    return true;
  }
}

class AbortError extends PiscinaError {
  constructor (reason?: AbortSignal['reason']) {
    super('The task has been aborted', { cause: reason });
    this.name = 'AbortError';
    this.code = 'PISCINA_ERR_ABORT';
  }
}

class TaskQueueLimitError extends PiscinaError {
  constructor() {
    super('Task queue is at limit');
    this.name = 'TaskQueueLimitError';
    this.code = 'PISCINA_ERR_TASK_QUEUE_LIMIT';
  }
}

class ThreadTerminationError extends PiscinaError {
  constructor() {
    super('Terminating worker thread');
    this.name = 'ThreadTerminationError';
    this.code = 'PISCINA_ERR_THREAD_TERMINATION';
  }
}

class ValidationError extends PiscinaError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'PISCINA_ERR_VALIDATION';
  }
}

class NoTaskQueueAvailableError extends PiscinaError {
  constructor() {
    super('No task queue available and all Workers are busy');
    this.name = 'NoTaskQueueAvailableError';
    this.code = 'PISCINA_ERR_NO_TASK_QUEUE_AVAILABLE';
  }
}

class CloseTimeoutError extends PiscinaError {
  constructor() {
    super('Close operation timed out');
    this.name = 'CloseTimeoutError';
    this.code = 'PISCINA_ERR_CLOSE_TIMEOUT';
  }
}

class TaskTerminatingWorkerError extends PiscinaError {
  constructor() {
    super('Terminating the Worker thread');
    this.name = 'TaskTerminatingWorkerError';
    this.code = 'PISCINA_ERR_TASK_TERMINATING_WORKER';
  }
}

// Dictionary
export const Errors = {
  ThreadTermination: () => new ThreadTerminationError(),
  TaskQueueAtLimit: () => new TaskQueueLimitError(),
  NoTaskQueueAvailable: () =>
    new NoTaskQueueAvailableError(),
  TaskTerminatingWorker: () => new TaskTerminatingWorkerError(),
  CloseTimeout: () => new CloseTimeoutError(),
  ValidationError: (msg: string) => new ValidationError(msg),
  AbortError: (reason?: any) => new AbortError(reason)
};
