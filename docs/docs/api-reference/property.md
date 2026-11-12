---
id: Properties
sidebar_position: 5
---

## Property: `completed` (readonly)

The current number of completed tasks.

## Property: `duration` (readonly)

The length of time (in milliseconds) since this `Piscina` instance was
created.

## Property: `options` (readonly)

A copy of the options that are currently being used by this instance. This
object has the same properties as the options object passed to the constructor.

## Property: `threads` (readonly)

An Array of the `Worker` instances used by this pool.

## Property: `idleThreads` (readonly)

The current number of ready (warmed up) Worker threads that are not running any
task.

## Property: `queueSize` (readonly)

The current number of tasks waiting to be assigned to a Worker thread.

## Property: `needsDrain` (readonly)

Boolean value that specifies whether the pool requires draining before processing new tasks.

This is `true` when there is not enough capacity to process more tasks
without exceeding the maximum queue size or within the maximum number of threads.

This is often calculated based on the number of threads (current and pending if number of threads is below `maxThreads` threshold),
the maximum queue size, and the current number of in-flight tasks.

This property is helpful to make decisions towards creating backpressure.

> **Note**: Piscina does not buffer tasks beyond the `maxQueue` threshold, so this property is not a guarantee that the pool will accept more tasks.

## Property: `utilization` (readonly)

A point-in-time ratio comparing the total run time of completed tasks
to the total runtime capacity of the pool.

A pools runtime capacity is determined by multiplying the `duration`
by the `options.maxThread` count. This provides an absolute theoretical
maximum aggregate compute time that the pool would be capable of.

The total run time is the sum of the run times of all completed tasks.
This number represents the amount of time the pool has been actively
processing tasks.

The utilization is then calculated by dividing the total run time by
the capacity, yielding a fraction between `0` and `1`.

For run and wait time distributions, subscribe to the
[`piscina:task:done`](./event.md#diagnostics-channels) diagnostics channel.