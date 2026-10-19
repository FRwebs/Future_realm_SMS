import { describe, expect, it } from "vitest";

import { isOwed, lastDueAt } from "../../backend/src/modules/analytics-reports/schedule";

const at = (iso: string) => new Date(iso);

describe("report schedules (West Africa Time)", () => {
  it("fires Monday 07:00 WAT, which is 06:00 UTC", () => {
    // Wednesday 2026-10-21 12:00 UTC → the most recent Monday is the 19th
    expect(lastDueAt("Every Monday, 07:00", at("2026-10-21T12:00:00Z"))?.toISOString()).toBe("2026-10-19T06:00:00.000Z");
    // Monday 05:00 UTC has not yet reached 06:00 UTC, so the previous Monday is the last one
    expect(lastDueAt("Every Monday, 07:00", at("2026-10-19T05:00:00Z"))?.toISOString()).toBe("2026-10-12T06:00:00.000Z");
  });

  it("fires Friday 16:00 WAT and the first of the month at 07:00 WAT", () => {
    expect(lastDueAt("Every Friday, 16:00", at("2026-10-19T12:00:00Z"))?.toISOString()).toBe("2026-10-16T15:00:00.000Z");
    expect(lastDueAt("First of each month", at("2026-10-19T12:00:00Z"))?.toISOString()).toBe("2026-10-01T06:00:00.000Z");
    expect(lastDueAt("First of each month", at("2026-10-01T05:00:00Z"))?.toISOString()).toBe("2026-09-01T06:00:00.000Z");
  });

  it("fires the morning after a term ends, and never on its own for 'On demand'", () => {
    expect(lastDueAt("End of each term", at("2026-12-20T12:00:00Z"), [at("2026-12-18T00:00:00Z")])?.toISOString()).toBe("2026-12-19T06:00:00.000Z");
    expect(lastDueAt("End of each term", at("2026-10-19T12:00:00Z"), [at("2026-12-18T00:00:00Z")])).toBeNull();
    expect(lastDueAt("On demand", at("2026-10-19T12:00:00Z"))).toBeNull();
  });

  it("owes a run only once: not before the report existed, not after it has run", () => {
    const now = at("2026-10-21T12:00:00Z");
    expect(isOwed("Every Monday, 07:00", now, { createdAt: at("2026-10-20T09:00:00Z"), lastRunAt: null })).toBe(false);
    expect(isOwed("Every Monday, 07:00", now, { createdAt: at("2026-10-01T09:00:00Z"), lastRunAt: null })).toBe(true);
    expect(isOwed("Every Monday, 07:00", now, { createdAt: at("2026-10-01T09:00:00Z"), lastRunAt: at("2026-10-19T06:05:00Z") })).toBe(false);
    expect(isOwed("Every Monday, 07:00", now, { createdAt: at("2026-10-01T09:00:00Z"), lastRunAt: at("2026-10-12T06:05:00Z") })).toBe(true);
  });
});
