---
id: Errors
sidebar_position: 8
---

## Errors

The following section aggregates all the error codes thrown from `Piscina` and an explanation of them

### Constructor

All errors thrown by `Piscina` follows are child of `PiscinaError` parent class.

- `name`: (`string`) Name of the error
- `code`: (`string`) Error code. Prefixed with `PISCINA_ERR_*`
- `message`: (`string | null`) Summary of the cause of the error
- `cause`: (`string | null`) Root cause of the error.

### Error Codes

| Code                                | Description                                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| PISCINA_ERR_ABORT                   | Indicates a task has been aborted. Seek for the `cause` property to find more about the root cause.                                   |
| PISCINA_ERR_TASK_QUEUE_LIMIT        | Task queue is at limit. No more tasks are being enqueued. Listen to the `drain` and `needsDrain` event to continue submitting tasks   |
| PISCINA_ERR_THREAD_TERMINATION      | Thread is being terminated.                                                                                                           |
| PISCINA_ERR_VALIDATION              | Validation for given values has failed. Review the `message` property for more information                                            |
| PISCINA_ERR_NO_TASK_QUEUE_AVAILABLE | Task queue has been disabled and workers are at full capacity. Listen to `drain` and `needsDrain` events to continue submitting tasks |
| PISCINA_ERR_CLOSE_TIMEOUT           | Pool has exceeded timeout for closing up. Pool will be destroyed immediately.                                                         |
