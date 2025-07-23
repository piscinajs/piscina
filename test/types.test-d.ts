import { resolve } from "node:path";
import { expectTypeOf } from "expect-type";

import { test } from "node:test";

import Piscina from "../dist";

test("types can be inferred from function", async (t) => {
  const pool = new Piscina<typeof import("./fixtures/worker-type.js")>({
    filename: resolve(__dirname, "fixtures/worker-type.js"),
    concurrentTasksPerWorker: 1,
  });

  expectTypeOf(pool.run).toExtend<(payload: { a: number; b: number }) => Promise<number>>();
  expectTypeOf(pool.run).toExtend<(payload: { a: number; b: number }, opts: { name: "default" }) => Promise<number>>();
  expectTypeOf(pool.run).toExtend<(payload: { name: string }, opts: { name: "greet" }) => Promise<string>>();
});

test("types can be manually specified", async (t) => {
  const pool = new Piscina<{
    default: (payload: { a: number; b: number }) => number;
    greet: (payload: { name: string }) => string;
  }>({
    filename: resolve(__dirname, "fixtures/worker-type.js"),
    concurrentTasksPerWorker: 1,
  });

  expectTypeOf(pool.run).toExtend<(payload: { a: number; b: number }) => Promise<number>>();
  expectTypeOf(pool.run).toExtend<(payload: { a: number; b: number }, opts: { name: "default" }) => Promise<number>>();
  expectTypeOf(pool.run).toExtend<(payload: { name: string }, opts: { name: "greet" }) => Promise<string>>();
});
