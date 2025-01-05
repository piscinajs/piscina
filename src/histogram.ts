import { RecordableHistogram, createHistogram } from 'node:perf_hooks';

export type PiscinaHistogramSummary = {
  average: number;
  mean: number;
  stddev: number;
  min: number;
  max: number;
  p0_001: number;
  p0_01: number;
  p0_1: number;
  p1: number;
  p2_5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p97_5: number;
  p99: number;
  p99_9: number;
  p99_99: number;
  p99_999: number;
};

export type PiscinaHistogram = {
  runTime: PiscinaHistogramSummary;
  waitTime: PiscinaHistogramSummary;
  resetRunTime(): void;
  resetWaitTime(): void;
};

export class PiscinaHistogramHandler {
  #runTime: RecordableHistogram;
  #waitTime: RecordableHistogram;

  constructor() {
    this.#runTime = createHistogram();
    this.#waitTime = createHistogram();
  }

  get runTimeSummary(): PiscinaHistogramSummary {
    return PiscinaHistogramHandler.createHistogramSummary(this.#runTime);
  }

  get waitTimeSummary(): PiscinaHistogramSummary {
    return PiscinaHistogramHandler.createHistogramSummary(this.#waitTime);
  }

  get runTimeCount(): number {
    return this.#runTime.count;
  }

  get waitTimeCount(): number {
    return this.#waitTime.count;
  }

  recordRunTime(value: number) {
    this.#runTime.record(PiscinaHistogramHandler.toHistogramIntegerNano(value));
  }

  recordWaitTime(value: number) {
    this.#waitTime.record(
      PiscinaHistogramHandler.toHistogramIntegerNano(value)
    );
  }

  resetWaitTime(): void {
    this.#waitTime.reset();
  }

  resetRunTime(): void {
    this.#runTime.reset();
  }

  static createHistogramSummary(
    histogram: RecordableHistogram
  ): PiscinaHistogramSummary {
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
      p99_999: histogram.percentile(99.999) / 1000,
    };
  }

  static toHistogramIntegerNano(milliseconds: number): number {
    return Math.max(1, Math.trunc(milliseconds * 1000));
  }
}
