import * as bt from "bun:test";

type ResolvesOrRejects = PromiseLike<unknown> | (() => PromiseLike<unknown>);

interface TapMatchers {
  test: typeof test;

  equal: (a: any, b: any) => Promise<void>;
  ok: (a: any) => Promise<void>;
  resolves: (
    a: ResolvesOrRejects,
    expectMessage?: string | RegExp,
    asMessage?: string
  ) => Promise<void>;
  rejects: (
    a: ResolvesOrRejects,
    expectMessage?: string | RegExp,
    asMessage?: string
  ) => Promise<void>;
  fail: (message: string) => never;
  pass: (message: string) => void;
}

class TapInstantFailureError extends Error {}

export function test(
  label: string,
  fn: (matchers: TapMatchers) => Promise<void> | void
) {
  return bt.test(label, async () => {
    await fn(matchers);
  });
}

const matchers: TapMatchers = {
  test,

  equal: async (a, b) => {
    bt.expect(a).toBe(b);
  },
  ok: async (a) => {
    bt.expect(a).toBeTruthy();
  },
  rejects: async (a, message) => {
    bt.expect(a).rejects.toThrow(message);
  },
  resolves: async (a, message) => {
    bt.expect(a).resolves.toBe(message);
  },
  fail: (message) => {
    throw new TapInstantFailureError(message);
  },
  pass: (message) => {
    console.log(message);
  },
};
