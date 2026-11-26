import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

/**
 * The real public/sw.js, run in a sandbox with a fake cache and a fake network, so the rules that keep a register or a score sheet
 * available with no connection — and that keep everything else private — are tested as written, not described.
 */
type Listener = (event: unknown) => void;

async function boot() {
  const listeners: Record<string, Listener> = {};
  const store = new Map<string, Map<string, Response>>();
  let wiped = 0;
  const cacheFor = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    const entries = store.get(name)!;
    return {
      put: async (key: Request, response: Response) => void entries.set(key.url, response),
      match: async (key: Request | string) => entries.get(typeof key === "string" ? new URL(key, "http://school.test").toString() : key.url)?.clone(),
      add: async (url: string) => void entries.set(new URL(url, "http://school.test").toString(), new Response("offline page")),
      keys: async () => [...entries.keys()].map((url) => new Request(url)),
    };
  };
  const caches = {
    open: async (name: string) => cacheFor(name),
    match: async (key: string) => {
      for (const entries of store.values()) {
        const hit = entries.get(new URL(key, "http://school.test").toString());
        if (hit) return hit.clone();
      }
      return undefined;
    },
    delete: async (name: string) => { if (store.delete(name)) wiped += 1; return true; },
    keys: async () => [...store.keys()],
  };
  const world = { online: true, reply: () => page("<html>register</html>") as Response };
  const context = {
    self: { location: { origin: "http://school.test" }, addEventListener: (type: string, fn: Listener) => { listeners[type] = fn; }, skipWaiting: () => undefined, clients: { claim: () => undefined } },
    caches,
    fetch: async () => { if (!world.online) throw new TypeError("offline"); return world.reply(); },
    Request, Response, Headers, URL, Date, Number, Promise,
  };
  runInNewContext(readFileSync("public/sw.js", "utf8"), context);
  // The worker's own install step stores the plain offline page, exactly as a browser would run it.
  const installing: Promise<unknown>[] = [];
  listeners.install!({ waitUntil: (value: Promise<unknown>) => installing.push(value) });
  await Promise.all(installing);

  /** What the worker answers for a request, or null when it leaves the request to the browser. */
  async function ask(request: { url: string; method?: string; mode?: string; headers?: Record<string, string> }) {
    let answer: Promise<Response> | null = null;
    const waits: Promise<unknown>[] = [];
    listeners.fetch!({ request: { method: "GET", mode: "cors", ...request, headers: new Headers(request.headers) }, respondWith: (value: Promise<Response>) => { answer = value; }, waitUntil: (value: Promise<unknown>) => waits.push(value) });
    await Promise.all(waits);
    return answer ? await (answer as Promise<Response>).then((response) => response, () => "network error" as const) : null;
  }
  return { ask, world, store, wipes: () => wiped };
}

/** A response the way the browser hands one to a worker: a real page from this site. */
function page(html: string, opts: { redirected?: boolean; type?: string; ok?: boolean } = {}) {
  const response = new Response(html, { status: opts.ok === false ? 500 : 200, headers: { "content-type": "text/html; charset=utf-8" } });
  Object.defineProperty(response, "type", { value: opts.type ?? "basic" });
  Object.defineProperty(response, "redirected", { value: opts.redirected ?? false });
  return response;
}

const REGISTER = "http://school.test/attendance/mark/class-1";
const SHEET = "http://school.test/score-entry-results/enter/class-1/maths";

describe("the service worker", () => {
  it("opens a register with no connection once it has been opened online", async () => {
    const sw = await boot();
    const online = (await sw.ask({ url: REGISTER, mode: "navigate" })) as Response;
    expect(await online.text()).toContain("register");
    sw.world.online = false;
    const offline = (await sw.ask({ url: REGISTER, mode: "navigate" })) as Response;
    expect(offline.status).toBe(200);
    expect(await offline.text()).toContain("register");
  });

  it("keeps a page asked for by the app itself, so a page reached by tapping through opens offline too", async () => {
    const sw = await boot();
    await sw.ask({ url: SHEET, headers: { "x-fr-keep": "1" } });
    sw.world.online = false;
    const offline = (await sw.ask({ url: SHEET, mode: "navigate" })) as Response;
    expect(await offline.text()).toContain("register");
  });

  it("shows the plain offline page for a kept page that was never opened here", async () => {
    const sw = await boot();
    sw.world.online = false;
    const answer = (await sw.ask({ url: REGISTER, mode: "navigate" })) as Response;
    expect(await answer.text()).toBe("offline page");
  });

  it("does not store any other signed-in page, so offline it shows the plain offline page instead", async () => {
    const sw = await boot();
    const others = ["http://school.test/student-records/registry", "http://school.test/fee-management/collections", "http://school.test/attendance/register"];
    for (const url of others) await sw.ask({ url, mode: "navigate" });
    expect(sw.store.get("fr-pages-v2")?.size ?? 0).toBe(0);
    sw.world.online = false;
    for (const url of others) expect(await (((await sw.ask({ url, mode: "navigate" })) as Response).text())).toBe("offline page");
  });

  it("never touches the API", async () => {
    const sw = await boot();
    expect(await sw.ask({ url: "http://school.test/api/v1/attendance-management/mark/class-1" })).toBeNull();
    expect(await sw.ask({ url: "http://school.test/api/v1/auth/me", headers: { "x-fr-keep": "1" } })).toBeNull();
  });

  it("does not store a redirect to sign-in, an error page, or something that is not a page", async () => {
    for (const reply of [page("<html>sign in</html>", { redirected: true }), page("<html>error</html>", { ok: false }), page("<html>other origin</html>", { type: "cors" })]) {
      const sw = await boot();
      sw.world.reply = () => reply;
      await sw.ask({ url: REGISTER, mode: "navigate" });
      expect(sw.store.get("fr-pages-v2")?.size ?? 0).toBe(0);
    }
  });

  it("wipes what it kept at every sign-in and sign-out, so a shared phone never shows the last person's children", async () => {
    for (const path of ["/api/v1/auth/logout", "/api/v1/auth/login"]) {
      const sw = await boot();
      await sw.ask({ url: REGISTER, mode: "navigate" });
      expect(sw.store.get("fr-pages-v2")?.size).toBe(1);
      await sw.ask({ url: `http://school.test${path}`, method: "POST" });
      expect(sw.store.has("fr-pages-v2")).toBe(false);
      sw.world.online = false;
      expect(await (((await sw.ask({ url: REGISTER, mode: "navigate" })) as Response).text())).toBe("offline page");
    }
  });

  it("does not show a kept page that is more than twelve hours old", async () => {
    const sw = await boot();
    await sw.ask({ url: REGISTER, mode: "navigate" });
    const key = [...sw.store.get("fr-pages-v2")!.keys()][0]!;
    const stored = sw.store.get("fr-pages-v2")!.get(key)!;
    const headers = new Headers(stored.headers);
    headers.set("x-fr-kept-at", String(Date.now() - 13 * 60 * 60 * 1000));
    sw.store.get("fr-pages-v2")!.set(key, new Response(await stored.clone().text(), { status: 200, headers }));
    sw.world.online = false;
    expect(await (((await sw.ask({ url: REGISTER, mode: "navigate" })) as Response).text())).toBe("offline page");
  });

  it("always prefers the school's own copy when there is a connection", async () => {
    const sw = await boot();
    await sw.ask({ url: REGISTER, mode: "navigate" });
    sw.world.reply = () => page("<html>fresh from the school</html>");
    const online = (await sw.ask({ url: REGISTER, mode: "navigate" })) as Response;
    expect(await online.text()).toContain("fresh from the school");
  });
});
