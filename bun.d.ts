/// <reference path="./node_modules/bun-types/test.d.ts" />

declare global {
  interface PromiseConstructor {
    withResolvers<T>(): {
      promise: Promise<T>;
      resolve: (value?: T | PromiseLike<T>) => void;
      reject: (reason?: any) => void;
    };
  }
}

export { };
