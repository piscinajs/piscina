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

## Property: `runTime` (readonly)

A histogram summary object summarizing the collected run times of completed
tasks. All values are expressed in milliseconds.

* `runTime.average` {`number`} The average run time of all tasks
* `runTime.mean` {`number`} The mean run time of all tasks
* `runTime.stddev` {`number`} The standard deviation of collected run times
* `runTime.min` {`number`} The fastest recorded run time
* `runTime.max` {`number`} The slowest recorded run time

All properties following the pattern `p{N}` where N is a number (e.g. `p1`, `p99`)
represent the percentile distributions of run time observations. For example,
`p99` is the 99th percentile indicating that 99% of the observed run times were
faster or equal to the given value.

```js
{
  average: 1880.25,
  mean: 1880.25,
  stddev: 1.93,
  min: 1877,
  max: 1882.0190887451172,
  p0_001: 1877,
  p0_01: 1877,
  p0_1: 1877,
  p1: 1877,
  p2_5: 1877,
  p10: 1877,
  p25: 1877,
  p50: 1881,
  p75: 1881,
  p90: 1882,
  p97_5: 1882,
  p99: 1882,
  p99_9: 1882,
  p99_99: 1882,
  p99_999: 1882
}
```

## Property: `threads` (readonly)

An Array of the `Worker` instances used by this pool.

## Property: `queueSize` (readonly)

The current number of tasks waiting to be assigned to a Worker thread.

## Property: `needsDrain` (readonly)

Boolean value that specifies whether the capacity of the pool has
been exceeded by the number of tasks submitted.

This property is helpful to make decisions towards creating backpressure
over the number of tasks submitted to the pool.

## Property: `utilization` (readonly)

A point-in-time ratio comparing the approximate total mean run time
of completed tasks to the total runtime capacity of the pool.

A pools runtime capacity is determined by multiplying the `duration`
by the `options.maxThread` count. This provides an absolute theoretical
maximum aggregate compute time that the pool would be capable of.

The approximate total mean run time is determined by multiplying the
mean run time of all completed tasks by the total number of completed
tasks. This number represents the approximate amount of time the
pool as been actively processing tasks.

The utilization is then calculated by dividing the approximate total
mean run time by the capacity, yielding a fraction between `0` and `1`.

## Property: `waitTime` (readonly)

A histogram summary object summarizing the collected times tasks spent
waiting in the queue. All values are expressed in milliseconds.

* `waitTime.average` {`number`} The average wait time of all tasks
* `waitTime.mean` {`number`} The mean wait time of all tasks
* `waitTime.stddev` {`number`} The standard deviation of collected wait times
* `waitTime.min` {`number`} The fastest recorded wait time
* `waitTime.max` {`number`} The longest recorded wait time

All properties following the pattern `p{N}` where N is a number (e.g. `p1`, `p99`)
represent the percentile distributions of wait time observations. For example,
`p99` is the 99th percentile indicating that 99% of the observed wait times were
faster or equal to the given value.

```js
{
  average: 1880.25,
  mean: 1880.25,
  stddev: 1.93,
  min: 1877,
  max: 1882.0190887451172,
  p0_001: 1877,
  p0_01: 1877,
  p0_1: 1877,
  p1: 1877,
  p2_5: 1877,
  p10: 1877,
  p25: 1877,
  p50: 1881,
  p75: 1881,
  p90: 1882,
  p97_5: 1882,
  p99: 1882,
  p99_9: 1882,
  p99_99: 1882,
  p99_999: 1882
}
```