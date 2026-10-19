import { beforeEach, describe, expect, it, vi } from "vitest";

import { OUTBOX_KEYS, enqueue, flushOutbox, noConnection, offlineTarget, readOutbox } from "../../src/lib/offline/outbox";

/** No browser in this runner: the three globals the outbox reads, as a plain in-memory device. */
function device() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value), removeItem: (key: string) => void store.delete(key), clear: () => store.clear() });
  vi.stubGlobal("document", { cookie: "fr_csrf=tok" });
  vi.stubGlobal("navigator", { onLine: true });
}

describe("what a device may hold", () => {
  it("holds a submitted register and a score save, and nothing else", () => {
    expect(offlineTarget("/api/v1/attendance-management/mark/c1/submit", "POST")).toEqual({ kind: "ATTENDANCE", classId: "c1" });
    expect(offlineTarget("/api/v1/score-results/enter/c1/s9/save", "POST")).toEqual({ kind: "SCORE_ENTRY", classId: "c1", subjectId: "s9" });
    expect(offlineTarget("/api/v1/score-results/enter/c1/s9/submit", "POST")).toBeNull();
    expect(offlineTarget("/api/v1/fee-management/payments", "POST")).toBeNull();
    expect(offlineTarget("/api/v1/attendance-management/mark/c1/submit", "DELETE")).toBeNull();
  });

  it("tells a missing connection from a server that said no", () => {
    device();
    expect(noConnection(new TypeError("Failed to fetch"))).toBe(true);
    expect(noConnection(new Error("Register already submitted"))).toBe(false);
  });
});

describe("the outbox", () => {
  beforeEach(() => device());

  it("keeps only the latest register for an arm and a day", () => {
    const target = { kind: "ATTENDANCE" as const, classId: "c1" };
    enqueue(target, { date: "2026-10-19", entries: [{ studentId: "a", status: "ABSENT" }] }, "A register");
    enqueue(target, { date: "2026-10-19", entries: [{ studentId: "a", status: "PRESENT" }] }, "A register");
    enqueue(target, { date: "2026-10-20", entries: [] }, "A register");
    expect(readOutbox()).toHaveLength(2);
    expect(JSON.stringify(readOutbox())).not.toContain("ABSENT");
  });

  it("keeps every score save, in order — each carries only the cells that changed", () => {
    const target = { kind: "SCORE_ENTRY" as const, classId: "c1", subjectId: "s9" };
    enqueue(target, { rows: [{ studentId: "a", cells: { ca1: "8" } }] }, "Scores");
    enqueue(target, { rows: [{ studentId: "b", cells: { ca1: "9" } }] }, "Scores");
    expect(JSON.parse(localStorage.getItem(OUTBOX_KEYS.SCORE_ENTRY) ?? "[]")).toHaveLength(2);
  });

  it("removes what the school answered for, and keeps what it could not be asked", async () => {
    enqueue({ kind: "ATTENDANCE", classId: "c1" }, { date: "2026-10-19", entries: [] }, "A register");
    const [held] = readOutbox();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, data: [{ clientId: held.clientId, state: "CONFLICT", message: "differs" }] }), { status: 200 })));
    const result = await flushOutbox();
    expect(result).toMatchObject({ sent: 1, conflicts: 1, remaining: 0 });

    enqueue({ kind: "ATTENDANCE", classId: "c2" }, { date: "2026-10-19", entries: [] }, "A register");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    expect(await flushOutbox()).toMatchObject({ sent: 0, remaining: 1 });
    expect(readOutbox()).toHaveLength(1);
  });
});
