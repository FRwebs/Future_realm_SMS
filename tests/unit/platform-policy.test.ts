import { describe, expect, it } from "vitest";

import { decide, type SchoolFacts } from "../../backend/src/modules/platform-policy/lifecycle.service";
import { DEFAULT_POLICY, inQuietHours, mergePolicy, roundAmount } from "../../backend/src/modules/platform-policy/policy.shared";

const day = 86_400_000;
const now = new Date("2026-10-20T12:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * day);
const school = (over: Partial<SchoolFacts> = {}): SchoolFacts => ({ status: "ACTIVE", billingStatus: "ACTIVE", isPersonalWorkspace: false, trialEndsAt: null, createdAt: ago(400), dormantAt: null, dormancyNoticeAt: null, addressReleaseDueAt: null, ...over });

describe("a school's trial", () => {
  const trial = (over: Partial<SchoolFacts>) => school({ status: "TRIAL", billingStatus: "TRIAL", createdAt: ago(10), ...over });

  it("reminds the owner a few days before it ends, once", () => {
    expect(decide(trial({ trialEndsAt: new Date(now.getTime() + 2 * day) }), now, DEFAULT_POLICY, now)).toEqual(["TRIAL_ENDING"]);
    expect(decide(trial({ trialEndsAt: new Date(now.getTime() + 2 * day) }), now, DEFAULT_POLICY, now, [{ kind: "TRIAL_ENDING", at: ago(1) }])).toEqual([]);
    expect(decide(trial({ trialEndsAt: new Date(now.getTime() + 20 * day) }), now, DEFAULT_POLICY, now)).toEqual([]);
  });

  it("goes read-only when it ends, then locks after the read-only window", () => {
    expect(decide(trial({ trialEndsAt: ago(1) }), now, DEFAULT_POLICY, now)).toEqual(["TRIAL_READ_ONLY"]);
    expect(decide(trial({ status: "GRACE_PERIOD", trialEndsAt: ago(8) }), now, DEFAULT_POLICY, now)).toEqual(["TRIAL_LOCK"]);
    expect(decide(trial({ status: "GRACE_PERIOD", trialEndsAt: ago(5) }), now, DEFAULT_POLICY, now)).toEqual(["TRIAL_LOCK_DUE"]);
  });

  it("locks at once when the policy has no read-only window", () => {
    const policy = { ...DEFAULT_POLICY, trial: { ...DEFAULT_POLICY.trial, readOnlyDays: 0 } };
    expect(decide(trial({ trialEndsAt: ago(1) }), now, policy, now)).toEqual(["TRIAL_LOCK"]);
  });

  it("leaves a school that has paid alone", () => {
    expect(decide(school({ trialEndsAt: ago(30) }), now, DEFAULT_POLICY, now)).toEqual([]);
  });
});

describe("a school nobody signs in to", () => {
  it("is watched, then dormant, then its address is released — never sooner", () => {
    expect(decide(school(), ago(30), DEFAULT_POLICY, now)).toEqual([]);
    expect(decide(school(), ago(70), DEFAULT_POLICY, now)).toEqual(["DORMANT_WATCH"]);
    expect(decide(school(), ago(130), DEFAULT_POLICY, now)).toEqual(["DORMANT"]);
    const dormant = { dormantAt: ago(31), dormancyNoticeAt: ago(31), addressReleaseDueAt: ago(1) };
    expect(decide(school({ ...dormant, billingStatus: "TRIAL" }), ago(160), DEFAULT_POLICY, now)).toEqual(["ADDRESS_RELEASE"]);
    expect(decide(school({ ...dormant, addressReleaseDueAt: new Date(now.getTime() + 5 * day), billingStatus: "TRIAL" }), ago(160), DEFAULT_POLICY, now)).toEqual([]);
  });

  it("never releases the address of a school that pays", () => {
    const dormant = { dormantAt: ago(31), dormancyNoticeAt: ago(31), addressReleaseDueAt: ago(1) };
    expect(decide(school(dormant), ago(160), DEFAULT_POLICY, now)).toEqual([]);
  });

  it("recovers the moment somebody signs in", () => {
    const dormant = { dormantAt: ago(10), dormancyNoticeAt: ago(10), addressReleaseDueAt: new Date(now.getTime() + 20 * day) };
    expect(decide(school(dormant), ago(1), DEFAULT_POLICY, now)).toEqual(["RECOVERED"]);
  });

  it("ignores a teacher's own workspace and an archived school", () => {
    expect(decide(school({ isPersonalWorkspace: true }), ago(500), DEFAULT_POLICY, now)).toEqual([]);
    expect(decide(school({ status: "ARCHIVED" }), ago(500), DEFAULT_POLICY, now)).toEqual([]);
  });
});

describe("the policy", () => {
  it("refuses a dormant threshold that comes before the watch threshold", () => {
    expect(() => mergePolicy({}, { dormancy: { watchDays: 90, dormantDays: 60 } })).toThrow(/dormant later/);
  });

  it("fills missing keys from the defaults", () => {
    expect(mergePolicy({ trial: { days: 45 } }).trial).toEqual({ ...DEFAULT_POLICY.trial, days: 45 });
  });

  it("knows quiet hours that cross midnight", () => {
    const quiet = { ...DEFAULT_POLICY.messaging, quietHoursOn: true };
    // Lagos is UTC+1: 21:30 WAT is 20:30 UTC, 12:00 WAT is 11:00 UTC
    expect(inQuietHours(quiet, new Date("2026-10-20T20:30:00Z"))).toBe(true);
    expect(inQuietHours(quiet, new Date("2026-10-20T04:30:00Z"))).toBe(true);
    expect(inQuietHours(quiet, new Date("2026-10-20T11:00:00Z"))).toBe(false);
    expect(inQuietHours({ ...quiet, quietHoursOn: false }, new Date("2026-10-20T20:30:00Z"))).toBe(false);
  });

  it("rounds an invoice the way the policy says", () => {
    expect(roundAmount(1234.56, "NONE")).toBe(1234.56);
    expect(roundAmount(1234.56, "NEAREST_NAIRA")).toBe(1235);
    expect(roundAmount(1234.56, "NEAREST_FIVE")).toBe(1235);
    expect(roundAmount(1236, "NEAREST_TEN")).toBe(1240);
  });
});
