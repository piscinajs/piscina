import * as bt from "bun:test";

type ResolvesOrRejects = PromiseLike<unknown> | (() => PromiseLike<unknown>);

interface TapTestOptions {
  skip?: boolean;
  only?: boolean;
}

interface TapMatchers {
  test: typeof test;

  plan: (n: number, comment?: string) => void;

  match: (a: unknown, b: object | string | null | RegExp | Error) => void;
  ok: (a: unknown) => void;
  notOk: (a: unknown) => void;
  same: (a: unknown, b: unknown) => void;
  strictNotSame: (a: unknown, b: unknown) => void;
  equal: (a: unknown, b: unknown) => void;

  throws: (a: () => unknown, expectMessage?: string | RegExp | Error) => void;

  resolves: (
    a: ResolvesOrRejects,
    expectMessage?: string | RegExp | Error,
    asMessage?: string,
  ) => void;
  rejects: (
    a: ResolvesOrRejects,
    expectMessage?: string | RegExp | Error,
    asMessage?: string,
  ) => void;

  fail: (message: string) => never;
  pass: (message: string) => void;
}

class TapInstantFailureError extends Error {}

interface TestPlan {
  expected: number;
  actual: number;
  comment?: string;
}

type TapTestFn = (matchers: TapMatchers) => void | Promise<void>;

const testPlans = new Map<symbol, TestPlan>();

/**
 * Run a test with options
 * @param label - The name of the test.
 * @param options - The options for the test.
 * @param fn - The test function.
 */
export function test(
  label: string,
  options: TapTestOptions,
  fn: TapTestFn,
): void;

/**
 * Run a test without options
 * @param label - The name of the test.
 * @param fn - The test function.
 */
export function test(label: string, fn: TapTestFn): void;

export function test(
  label: string,
  fnOrOptions: TapTestFn | TapTestOptions,
  fnReal?: TapTestFn,
) {
  const options = typeof fnOrOptions === "function" ? {} : fnOrOptions;
  const fn = typeof fnOrOptions === "function" ? fnOrOptions : fnReal;

  if (!fn) {
    throw new Error(
      "No test function provided. Got arguments: " +
        [...arguments].map((arg) => arg.constructor.name).join(", "),
    );
  }

  const skip = options?.skip ?? false;
  const only = options?.only ?? false;

  const run = async () => {
    using matchers = createScopedMatchers(label);

    await fn(matchers.getMatchers());

    const plan = matchers.getPlan();

    if (plan && plan.actual !== plan.expected) {
      throw new Error(
        `Planned for ${plan.expected} tests but ran ${plan.actual} tests${
          plan.comment ? ` (${plan.comment})` : ""
        }`,
      );
    }
  };

  if (skip) {
    bt.test.skip(label, run);
  } else if (only) {
    bt.test.only(label, run);
  } else {
    bt.test(label, run);
  }
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

    match: (a, b) => {
      if (typeof b === "string" || b instanceof RegExp) {
        bt.expect(a).toMatch(b);
      } else if (typeof b === "object" && b !== null) {
        bt.expect(a).toMatchObject(b);
      } else {
        bt.expect(a).toBe(b);
      }
    },

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

    same: (a, b) => {
      incrementTestCount();
      bt.expect(a).toStrictEqual(b);
    },

    strictNotSame: (a, b) => {
      incrementTestCount();
      bt.expect(a).not.toBe(b);
    },

    notOk: (a) => {
      incrementTestCount();
      bt.expect(a).toBeFalsy();
    },

    throws: (a, message) => {
      incrementTestCount();
      bt.expect(a).toThrow(message);
    },

    equal: (a, b) => {
      incrementTestCount();
      bt.expect(a).toBe(b);
    },

    ok: (a) => {
      incrementTestCount();
      bt.expect(a).toBeTruthy();
    },

    rejects: (a, message) => {
      incrementTestCount();
      bt.expect(a).rejects.toThrow(message);
    },

    resolves: (a, message) => {
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
    getPlan: () => testPlans.get(key),
    getMatchers: () => matchers,
    [Symbol.dispose]: () => {
      testPlans.delete(key);
    },
  });
}
