import "server-only";

/**
 * A small in-process cache for what a server render keeps asking the API for and that changes rarely: who someone is allowed to be, who a
 * teacher is, what school they are in. It lives in the web server's memory for seconds, not minutes.
 *
 *  - Concurrent askers share one request (the first one's promise), so a layout and a page rendering together make one call, not two.
 *  - Only a success is kept. A failure is never cached, so a hiccup cannot outlast itself.
 *  - The key always carries who is asking (school and user), so one person's answer is never another's.
 *
 * It is never the authority: the API still checks permissions on every call it serves. This only decides how often a page asks the same
 * question about the same person while they click around. `FR_NO_SERVER_CACHE=1` switches it off.
 */
type Entry<T> = { value?: T; expires: number; pending?: Promise<T> };

const MAX_ENTRIES = 2000;
const store = new Map<string, Entry<unknown>>();
let hits = 0;
let misses = 0;

const disabled = () => process.env.FR_NO_SERVER_CACHE === "1";

export async function ttlCached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  if (disabled()) return load();
  const now = Date.now();
  const found = store.get(key) as Entry<T> | undefined;
  if (found) {
    if (found.pending) {
      hits += 1;
      return found.pending;
    }
    if (found.expires > now && found.value !== undefined) {
      hits += 1;
      return found.value;
    }
  }
  misses += 1;
  const pending = load().then(
    (value) => {
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    },
    (error) => {
      store.delete(key);
      throw error;
    },
  );
  store.set(key, { expires: now + ttlMs, pending });
  if (store.size > MAX_ENTRIES) {
    for (const [oldKey, entry] of store) {
      if (!entry.pending && entry.expires <= now) store.delete(oldKey);
      if (store.size <= MAX_ENTRIES * 0.8) break;
    }
    // Still over: drop the oldest, which a Map keeps first.
    while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string);
  }
  return pending;
}

/** Forget what is held for one person — after something that changes who they are (signing out, being given another role). */
export function forgetFor(prefix: string) {
  for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
}

export const cacheStats = () => ({ hits, misses, size: store.size });
