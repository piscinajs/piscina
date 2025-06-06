import * as bt from "bun:test";

interface TapMatchers {
  equal: (a: any, b: any) => Promise<void>;
  ok: (a: any) => Promise<void>;
  rejects: (a: any, message: string | RegExp) => Promise<void>;
  fail: (message: string) => never;
}

class TapInstantFailureError extends Error {}

const matchers: TapMatchers = {
  equal: async (a, b) => {
    bt.expect(a).toBe(b);
  },
  ok: async (a) => {
    bt.expect(a).toBeTruthy();
  },
  rejects: async (a, message) => {
    bt.expect(a).rejects.toThrow(message);
  },
  fail: (message) => {
    throw new TapInstantFailureError(message);
  },
};

export function test(
  label: string,
  fn: (matchers: TapMatchers) => Promise<void> | void
) {
  return bt.test(label, async () => {
    await fn(matchers);
  });
}
