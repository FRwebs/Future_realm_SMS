import { bucketOf, dayStart, stageOf, utcDay } from "../../backend/src/modules/fee-management/fees.shared";

const at = new Date("2026-10-01T00:00:00.000Z");

describe("fee ageing", () => {
  it("ages a balance by the days since it was billed", () => {
    expect(bucketOf(0)).toBe("Current");
    expect(bucketOf(30)).toBe("Current");
    expect(bucketOf(31)).toBe("30 days");
    expect(bucketOf(60)).toBe("30 days");
    expect(bucketOf(61)).toBe("60 days");
    expect(bucketOf(90)).toBe("60 days");
    expect(bucketOf(91)).toBe("90+ days");
  });
});

describe("fee escalation", () => {
  it("reads the stage off what was actually sent, never off the balance's age", () => {
    expect(stageOf([], false)).toBe("Not started");
    expect(stageOf([{ kind: "REMINDER", createdAt: at }], false)).toBe("First reminder");
    expect(stageOf([{ kind: "REMINDER", createdAt: at }, { kind: "REMINDER", createdAt: at }], false)).toBe("Second reminder");
  });

  it("puts a meeting above reminders, and a plan above everything", () => {
    const sent = [{ kind: "REMINDER", createdAt: at }, { kind: "REMINDER", createdAt: at }, { kind: "MEETING", createdAt: at }];
    expect(stageOf(sent, false)).toBe("Meeting requested");
    expect(stageOf(sent, true)).toBe("On a payment plan");
  });

  it("does not count a note or an adjustment as chasing the family", () => {
    expect(stageOf([{ kind: "NOTE", createdAt: at }, { kind: "ADJUSTMENT", createdAt: at }], false)).toBe("Not started");
  });
});

describe("cash-up days", () => {
  it("holds a calendar day as UTC midnight, so it never slips with the server's timezone", () => {
    expect(dayStart("2026-10-14").toISOString()).toBe("2026-10-14T00:00:00.000Z");
    expect(utcDay(dayStart("2026-10-14"))).toBe("2026-10-14");
  });

  it("recognises something that is not a day", () => {
    expect(Number.isNaN(dayStart("not-a-day").getTime())).toBe(true);
  });
});
