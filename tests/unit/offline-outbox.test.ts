import { beforeEach, describe, expect, it, vi } from "vitest";

import { OUTBOX_KEYS, enqueue, flushOutbox, noConnection, offlineTarget, outboxCount, readOutbox } from "../../src/lib/offline/outbox";

/** No browser in this runner: the three globals the outbox reads, as a plain in-memory device. */
function device() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value), removeItem: (key: string) => void store.delete(key), clear: () => store.clear() });
  vi.stubGlobal("document", { cookie: "fr_csrf=tok" });
  vi.stubGlobal("navigator", { onLine: true });
}

describe("what a device may hold", () => {
  it("holds a submitted register, a score save and an observation, and nothing else", () => {
    expect(offlineTarget("/api/v1/attendance-management/mark/c1/submit", "POST")).toEqual({ kind: "ATTENDANCE", classId: "c1" });
    expect(offlineTarget("/api/v1/score-results/enter/c1/s9/save", "POST")).toEqual({ kind: "SCORE_ENTRY", classId: "c1", subjectId: "s9" });
    expect(offlineTarget("/api/v1/teacher-workspace/observations/st7", "POST")).toEqual({ kind: "OBSERVATION", studentId: "st7" });
    expect(offlineTarget("/api/v1/score-results/enter/c1/s9/submit", "POST")).toBeNull();
    expect(offlineTarget("/api/v1/fee-management/payments", "POST")).toBeNull();
    expect(offlineTarget("/api/v1/attendance-management/mark/c1/submit", "DELETE")).toBeNull();
  });

  /*
   * Neither of these is a child, so neither may be held against one: a group write has to reach
   * several records at once, and the summary is a read.
   */
  it("does not mistake the group write or the summary for a child", () => {
    expect(offlineTarget("/api/v1/teacher-workspace/observations/group", "POST")).toBeNull();
    expect(offlineTarget("/api/v1/teacher-workspace/observations/summary", "POST")).toBeNull();
  });

  it("holds an observation of its own, counted apart from registers and scores", () => {
    device();
    enqueue({ kind: "OBSERVATION", studentId: "st7" }, { areas: { Literacy: "Secure" }, note: "Counted six shells aloud and recounted them unprompted." }, "An observation");
    enqueue({ kind: "OBSERVATION", studentId: "st8" }, { areas: { Mathematics: "Emerging" }, note: "Sorted the bricks by colour before building with them." }, "An observation");
    enqueue({ kind: "ATTENDANCE", classId: "c1" }, { date: "2026-10-19", entries: [] }, "A register");
    expect(outboxCount("OBSERVATION")).toBe(2);
    expect(outboxCount("SCORE_ENTRY")).toBe(0);
    expect(readOutbox()).toHaveLength(3);
    // each child's own record, never one row shared between them
    expect(new Set(readOutbox().filter((entry) => entry.kind === "OBSERVATION").map((entry) => entry.studentId)).size).toBe(2);
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
