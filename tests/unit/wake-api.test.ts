import { vi } from "vitest";

const store = new Map<string, string>();
const sessionStorage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value) };

async function fresh() {
  vi.resetModules();
  vi.stubGlobal("window", { sessionStorage });
  return import("@/lib/api/wake");
}
const answer = (ok: boolean, body: unknown = { ok: true }) => ({ ok, json: async () => body }) as Response;

describe("waking the API that sleeps when idle", () => {
  beforeEach(() => {
    store.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps asking until the API answers, and remembers that it did", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("starting")).mockResolvedValueOnce(answer(false)).mockResolvedValueOnce(answer(true));
    vi.stubGlobal("fetch", fetchMock);
    const { wakeApi } = await fresh();
    const done = wakeApi();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await done).toBe("ready");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/health");
    expect(store.get("fr_api_ready")).toBeTruthy();
  });

  it("asks once however many things want to know, and not at all again for a few minutes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(answer(true));
    vi.stubGlobal("fetch", fetchMock);
    const { wakeApi } = await fresh();
    const [a, b] = await Promise.all([wakeApi(), wakeApi()]);
    expect([a, b]).toEqual(["ready", "ready"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await wakeApi()).toBe("ready");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not trust an answer that is not the API's own", async () => {
    // A proxy's error page can come back 200: only { ok: true } from the health door counts.
    const fetchMock = vi.fn().mockResolvedValueOnce(answer(true, { ok: false })).mockResolvedValueOnce(answer(true));
    vi.stubGlobal("fetch", fetchMock);
    const { wakeApi } = await fresh();
    const done = wakeApi();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(await done).toBe("ready");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after a while and says it could not reach the API, without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const { wakeApi } = await fresh();
    const done = wakeApi();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await done).toBe("unreachable");
    expect(store.get("fr_api_ready")).toBeUndefined();
  });
});
