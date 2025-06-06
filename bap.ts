import * as bt from "bun:test";

type ResolvesOrRejects = PromiseLike<unknown> | (() => PromiseLike<unknown>);

interface TapMatchers {
  test: typeof test;

  plan: (n: number, comment?: string) => void;
  equal: (a: any, b: any) => Promise<void>;
  ok: (a: any) => Promise<void>;
  resolves: (
    a: ResolvesOrRejects,
    expectMessage?: string | RegExp,
    asMessage?: string,
  ) => Promise<void>;
  rejects: (
    a: ResolvesOrRejects,
    expectMessage?: string | RegExp,
    asMessage?: string,
  ) => Promise<void>;
  fail: (message: string) => never;
  pass: (message: string) => void;
}

class TapInstantFailureError extends Error {}

interface TestPlan {
  expected: number;
  actual: number;
  comment?: string;
}

const testPlans = new Map<symbol, TestPlan>();

export function test(
  label: string,
  fn: (matchers: TapMatchers) => Promise<void> | void,
) {
  return bt.test(label, async () => {
    using matchers = createScopedMatchers(label);

    try {
      await fn(matchers.getMatchers());

      const plan = testPlans.get(matchers.key);

      if (plan && plan.actual !== plan.expected) {
        throw new Error(
          `Planned for ${plan.expected} tests but ran ${plan.actual} tests${
            plan.comment ? ` (${plan.comment})` : ""
          }`,
        );
      }
    } finally {
      testPlans.delete(matchers.key);
    }
  });
}

function createScopedMatchers(label: string) {
  const key = Symbol(label);

  function incrementTestCount() {
    const plan = testPlans.get(key);

    if (plan) {
      plan.actual++;

      if (plan.actual > plan.expected) {
        throw new Error(
          `Test count exceeds plan: expected ${plan.expected}, but running test #${plan.actual}${plan.comment ? ` (${plan.comment})` : ""}`,
        );
      }
    }
  }

  const matchers: TapMatchers = {
    test,

    plan: (n, comment) => {
      if (testPlans.has(key)) {
        throw new Error("Cannot set plan more than once");
      }

      if (n < 0) {
        throw new TypeError("plan must be a non-negative number");
      }

      testPlans.set(key, { expected: n, actual: 0, comment });

      if (n === 0) {
        if (comment) {
          console.log(`# SKIP ${comment}`);
        }
      }
    },

    equal: async (a, b) => {
      incrementTestCount();
      bt.expect(a).toBe(b);
    },

    ok: async (a) => {
      incrementTestCount();
      bt.expect(a).toBeTruthy();
    },

    rejects: async (a, message) => {
      incrementTestCount();
      bt.expect(a).rejects.toThrow(message);
    },

    resolves: async (a, message) => {
      incrementTestCount();
      bt.expect(a).resolves.toBe(message);
    },

    fail: (message) => {
      incrementTestCount();
      throw new TapInstantFailureError(message);
    },

    pass: (message) => {
      incrementTestCount();
      console.log(message);
    },
  };

  return Object.freeze({
    key,
    getMatchers: () => matchers,
    [Symbol.dispose]: () => {
      testPlans.delete(key);
    },
  });
}
