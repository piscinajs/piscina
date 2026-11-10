const noop = () => {};

export function onabort(
  abortSignal: AbortSignal,
  listener: () => void,
): () => void {

  if (abortSignal.aborted) {
    listener();
    return noop;
  }

  abortSignal.addEventListener("abort", listener, { once: true });
  return () => abortSignal.removeEventListener("abort", listener);
}
