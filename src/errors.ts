export const Errors = {
  ThreadTermination: () => new Error('Terminating worker thread'),
  FilenameNotProvided: () =>
    new Error('filename must be provided to run() or in options object'),
  TaskQueueAtLimit: () => new Error('Task queue is at limit'),
  NoTaskQueueAvailable: () =>
    new Error('No task queue available and all Workers are busy'),
  CloseTimeout: () => new Error('Close operation timed out')
};
