// A value that arrives in updates, made of plain promises so a Server Action
// can return it and the page can read each update as it comes. Each update
// carries the whole value so far, so a missed update never loses anything.

export type LiveChunk<T> = { value: T; next: Live<T> | null };

/** The first update; each one points to the next, and the last to null. */
export type Live<T> = Promise<LiveChunk<T>>;

/** Starts a live value. Send it with `live`, then call `update` and `done`. */
export function createLive<T>() {
  let resolve!: (chunk: LiveChunk<T>) => void;
  let reject!: (error: unknown) => void;
  const nextPromise = () =>
    new Promise<LiveChunk<T>>((res, rej) => {
      resolve = res;
      reject = rej;
    });
  const live = nextPromise();
  let finished = false;
  return {
    live,
    update(value: T) {
      if (finished) return;
      const send = resolve;
      const next = nextPromise();
      send({ value, next });
    },
    done(value: T) {
      if (finished) return;
      finished = true;
      resolve({ value, next: null });
    },
    error(error: unknown) {
      if (finished) return;
      finished = true;
      reject(error);
    },
  };
}

/** Reads every update of a live value, in order. */
export async function* readLive<T>(live: Live<T>): AsyncGenerator<T> {
  let current: Live<T> | null = live;
  while (current) {
    const { value, next }: LiveChunk<T> = await current;
    yield value;
    current = next;
  }
}

/** The final value of a live value. */
export async function finalValue<T>(live: Live<T>): Promise<T> {
  let last: T | undefined;
  for await (const value of readLive(live)) last = value;
  return last as T;
}
