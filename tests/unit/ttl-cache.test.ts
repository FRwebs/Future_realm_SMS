import { vi } from "vitest";

vi.mock("server-only", () => ({}));

import { cacheStats, forgetFor, noteCtx, ttlCached } from "@/lib/cache/ttl";

describe("the short memory a page keeps of who someone is", () => {
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.FR_NO_SERVER_CACHE;
    forgetFor("");
  });

  it("answers a second ask from memory and a concurrent ask from the first one's call", async () => {
    const load = vi.fn(async () => ({ role: "TEACHER" }));
    const [a, b] = await Promise.all([ttlCached("t:one", 1000, load), ttlCached("t:one", 1000, load)]);
    expect(a).toBe(b);
    await ttlCached("t:one", 1000, load);
    expect(load).toHaveBeenCalledTimes(1);
    expect(cacheStats().hits).toBeGreaterThanOrEqual(2);
  });

  it("asks again once its time is up", async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => 1);
    await ttlCached("t:two", 1000, load);
    vi.advanceTimersByTime(1500);
    await ttlCached("t:two", 1000, load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("never keeps a failure, so a hiccup cannot outlast itself", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("api down")).mockResolvedValueOnce("ok");
    await expect(ttlCached("t:three", 1000, load)).rejects.toThrow("api down");
    await expect(ttlCached("t:three", 1000, load)).resolves.toBe("ok");
  });

  it("keeps one person's answer apart from another's", async () => {
    const a = await ttlCached("perm:s:alice", 1000, async () => ["view"]);
    const b = await ttlCached("perm:s:bob", 1000, async () => ["view", "edit"]);
    expect(a).toEqual(["view"]);
    expect(b).toEqual(["view", "edit"]);
  });

  it("can be switched off, and forgets one person on request", async () => {
    const load = vi.fn(async () => 1);
    process.env.FR_NO_SERVER_CACHE = "1";
    await ttlCached("t:four", 1000, load);
    await ttlCached("t:four", 1000, load);
    expect(load).toHaveBeenCalledTimes(2);
    delete process.env.FR_NO_SERVER_CACHE;
    await ttlCached("t:five", 1000, load);
    forgetFor("t:five");
    await ttlCached("t:five", 1000, load);
    expect(load).toHaveBeenCalledTimes(4);
  });

  it("believes a stamped entry until the API's context stamp moves, however much time is left", async () => {
    noteCtx("boot.1");
    const load = vi.fn().mockResolvedValueOnce(["view"]).mockResolvedValueOnce(["view", "edit"]);
    expect(await ttlCached("perm:s:carol", 600_000, load, { stamped: true })).toEqual(["view"]);
    expect(await ttlCached("perm:s:carol", 600_000, load, { stamped: true })).toEqual(["view"]);
    expect(load).toHaveBeenCalledTimes(1);
    // Something changed who people are: the next answer from the API carries a different stamp.
    noteCtx("boot.2");
    expect(await ttlCached("perm:s:carol", 600_000, load, { stamped: true })).toEqual(["view", "edit"]);
    expect(load).toHaveBeenCalledTimes(2);
    expect(await ttlCached("perm:s:carol", 600_000, load, { stamped: true })).toEqual(["view", "edit"]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not let an unstamped entry be ended by the stamp: it keeps to its own clock", async () => {
    noteCtx("boot.3");
    const load = vi.fn(async () => 1);
    await ttlCached("t:six", 600_000, load);
    noteCtx("boot.4");
    await ttlCached("t:six", 600_000, load);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
