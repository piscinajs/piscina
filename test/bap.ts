/// <reference path="../node_modules/bun-types/test.d.ts" />

/////////////////////////////////////////////////////////////////////////////////
// bap.ts is a `tap`-like test harness that actually just wraps bun:test. We've
// added this so we can run Piscina's test suite without any changes to the
// original test suite.
/////////////////////////////////////////////////////////////////////////////////

import assert from "node:assert";
import { join } from "node:path";

type ResolvesOrRejects = PromiseLike<unknown> | (() => PromiseLike<unknown>);

interface TapTestOptions {
  skip?: boolean | string;
  only?: boolean;
  timeout?: number;
}

type Typeofs =
  | "string"
  | "number"
  | "bigint"
  | "boolean"
  | "symbol"
  | "undefined"
  | "object"
  | "function";

interface TapMatchers {
  test: typeof test;

  plan: (n: number, comment?: string) => void;

  type: (a: unknown, b: Typeofs) => void;
  match: (a: unknown, b: object | string | null | RegExp | Error) => void;
  ok: (a: unknown) => void;
  notOk: (a: unknown) => void;
  same: (a: unknown, b: unknown) => void;
  not: (a: unknown, b: unknown) => void;
  strictNotSame: (a: unknown, b: unknown) => void;
  strictSame: (a: unknown, b: unknown) => void;
  equal: (a: unknown, b: unknown, message?: string) => void;
  deepEqual: (a: unknown, b: unknown) => void;

  throws: (a: () => unknown, expectMessage?: string | RegExp | Error) => void;

  resolves: (a: ResolvesOrRejects, message?: string) => Promise<void>;
  rejects: (
    a: ResolvesOrRejects,
    expectMessage?: string | RegExp | Error,
    asMessage?: string,
  ) => Promise<void>;

  fail: (message?: string) => void;
  pass: (message?: string) => void;
}

interface TestPlan {
  expected: number;
  actual: number;
  comment?: string;
}

type TapTestFn = (matchers: TapMatchers) => void | Promise<void>;

const testPlans = new Map<symbol, TestPlan>();

const seenLabelNames = new Map<string, number>();
function dedupeLabelName(label: string) {
  const count = seenLabelNames.get(label) ?? 0;
  if (count > 0) {
    seenLabelNames.set(label, count + 1);
    return dedupeLabelName(label + " (" + count + ")");
  } else {
    seenLabelNames.set(label, 1);
  }
  return label;
}

declare namespace Bun {
  function jest(sourceFile: string): typeof import("bun:test");
}

const getBunTestForFile = (() => {
  const cache = new Map<string, typeof import("bun:test")>();

  return (file: string) => {
    const mod = cache.get(file);
    if (mod) return mod;
    const next = Bun.jest(file);
    cache.set(file, next);
    return next;
  };
})();

function getCurrentFile() {
  const stack = new Error().stack;
  assert(stack, "No stack trace");

  const lines = stack.split("\n").map((line) => line.trim());

  const relevantLine = lines[4];
  assert(relevantLine, "No relevant line in stack trace");

  const fileNameWithLineNumberAtEnd = relevantLine.split(" ")[1];
  assert(fileNameWithLineNumberAtEnd, "No file name in stack trace");

  const fileName = fileNameWithLineNumberAtEnd.split(":")[0];
  assert(fileName, "No file name in stack trace");

  return join(process.cwd(), fileName);
}

function getBunTestForCurrentFile() {
  return getBunTestForFile(getCurrentFile());
}

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
  userLabel: string,
  ...args: [fn: TapTestFn] | [options: TapTestOptions, fn: TapTestFn]
) {
  const label = dedupeLabelName(userLabel);
  const fn = args.length === 2 ? args[1] : args[0];
  const options = args.length === 2 ? args[0] : {};

  const skip = options?.skip ?? false;
  const only = options?.only ?? false;

  assert(fn, "No test function provided");

  const bt = getBunTestForCurrentFile();

  const run = async () => {
    using scope = await createTestScope(label, bt);

    await fn(scope.getMatchers());

    const plan = scope.getPlan();

    if (plan && plan.actual !== plan.expected) {
      throw new Error(
        `Planned for ${plan.expected} tests but ran ${plan.actual} tests${
          plan.comment ? ` (${plan.comment})` : ""
        }`,
      );
    }
  };

  if (skip) {
    bt.test.skip(
      label,
      run,
      options.timeout !== undefined ? { timeout: options.timeout } : {},
    );
  } else if (only) {
    bt.test.only(
      label,
      run,
      options.timeout !== undefined ? { timeout: options.timeout } : {},
    );
  } else {
    bt.test(
      label,
      run,
      options.timeout !== undefined ? { timeout: options.timeout } : {},
    );
  }
}

class BapTestTestError extends Error {
  public readonly arguments: unknown[];

  constructor(message: string, args: unknown[]) {
    super(message);
    this.name = "BapTestTestError";
    this.arguments = args;
  }
}

function createTestScopeWaitTasks() {
  const tasks = new Set<PromiseLike<void>>();

  const disposable: AsyncDisposable = {
    [Symbol.asyncDispose]: async () => {
      await Promise.all(tasks);
    },
  };

  return {
    ...disposable,
    add: async (task: PromiseLike<void>) => {
      tasks.add(task);
      await task;
    },
  };
}

async function createTestScope(label: string, bt: typeof import("bun:test")) {
  const key = Symbol(label);
  await using scope = createTestScopeWaitTasks();

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
    test: () => {
      throw new BapTestTestError(
        "calling test.test() is not supported by bap yet",
        Array.from(arguments),
      );
    },

    type: (a, b) => {
      incrementTestCount();
      bt.expect(a).toBeTypeOf(b);
    },

    deepEqual: (a, b) => {
      incrementTestCount();
      bt.expect(a).toStrictEqual(b);
    },

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

    strictSame: (a, b) => {
      incrementTestCount();
      bt.expect(a).toBe(b);
    },

    same: (a, b) => {
      incrementTestCount();
      bt.expect(a).toStrictEqual(b);
    },

    not: (a, b) => {
      incrementTestCount();
      bt.expect(a).not.toBe(b);
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

    rejects: async (a, message) => {
      incrementTestCount();

      const promise = "then" in a ? a : a();

      const p = promise.then(
        () => {
          throw new Error("should have rejected");
        },
        (e) => {
          if (message instanceof Error) {
            bt.expect(e).toMatchObject(message);
          } else if (message) {
            bt.expect(e).toMatchObject({
              message: bt.expect.stringMatching(message),
            });
          } else {
            bt.expect(e).pass();
          }
        },
      );

      await scope.add(p);
    },

    resolves: async (a, message) => {
      incrementTestCount();

      const promise = "then" in a ? a : a();

      const p = promise.then(
        () => {
          if (message !== undefined) {
            bt.expect(a).pass(message);
          } else {
            bt.expect(a).pass();
          }
        },
        () => {
          throw new Error("should have resolved");
        },
      );

      await scope.add(p);
    },

    fail: (message) => {
      incrementTestCount();
      if (message) {
        bt.expect().fail(message);
      } else {
        bt.expect().fail();
      }
    },

    pass: (message) => {
      incrementTestCount();
      if (message) {
        bt.expect().pass(message);
      } else {
        bt.expect().pass();
      }
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
