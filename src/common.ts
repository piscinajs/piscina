import type { Histogram } from 'node:perf_hooks';
import { fileURLToPath, URL } from 'node:url';
import { availableParallelism, cpus } from 'node:os';

import type { HistogramSummary } from './types';
import { kMovable, kTransferable, kValue } from './symbols';

// States wether the worker is ready to receive tasks
export const READY = '_WORKER_READY';

/**
 * True if the object implements the Transferable interface
 *
 * @export
 * @param {unknown} value
 * @return {*}  {boolean}
 */
export function isTransferable (value: unknown): boolean {
  return (
    value != null &&
    typeof value === 'object' &&
    kTransferable in value &&
    kValue in value
  );
}

/**
 * True if object implements Transferable and has been returned
 * by the Piscina.move() function
 *
 * TODO: narrow down the type of value
 * @export
 * @param {(unknown & PiscinaMovable)} value
 * @return {*}  {boolean}
 */
export function isMovable (value: any): boolean {
  return isTransferable(value) && value[kMovable] === true;
}

export function markMovable (value: {}): void {
  Object.defineProperty(value, kMovable, {
    enumerable: false,
    configurable: true,
    writable: true,
    value: true
  });
}

// State of Piscina pool
export const commonState = {
  isWorkerThread: false,
  workerData: undefined
};

export function createHistogramSummary (histogram: Histogram): HistogramSummary {
  const { mean, stddev, min, max } = histogram;

  return {
    average: mean / 1000,
    mean: mean / 1000,
    stddev,
    min: min / 1000,
    max: max / 1000,
    p0_001: histogram.percentile(0.001) / 1000,
    p0_01: histogram.percentile(0.01) / 1000,
    p0_1: histogram.percentile(0.1) / 1000,
    p1: histogram.percentile(1) / 1000,
    p2_5: histogram.percentile(2.5) / 1000,
    p10: histogram.percentile(10) / 1000,
    p25: histogram.percentile(25) / 1000,
    p50: histogram.percentile(50) / 1000,
    p75: histogram.percentile(75) / 1000,
    p90: histogram.percentile(90) / 1000,
    p97_5: histogram.percentile(97.5) / 1000,
    p99: histogram.percentile(99) / 1000,
    p99_9: histogram.percentile(99.9) / 1000,
    p99_99: histogram.percentile(99.99) / 1000,
    p99_999: histogram.percentile(99.999) / 1000
  };
}

export function toHistogramIntegerNano (milliseconds: number): number {
  return Math.max(1, Math.trunc(milliseconds * 1000));
}

export function maybeFileURLToPath (filename : string) : string {
  return filename.startsWith('file:')
    ? fileURLToPath(new URL(filename))
    : filename;
}

// TODO: drop on v5
export function getAvailableParallelism () : number {
  if (typeof availableParallelism === 'function') {
    return availableParallelism();
  }

  try {
    return cpus().length;
  } catch {
    return 1;
  }
}
