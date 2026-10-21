import { describe, expect, it } from "vitest";

import { addWorkingHours, workingHoursBetween, type WorkingHours } from "../../backend/src/modules/support-desk/working-time";

const lagos: WorkingHours = { timeZone: "Africa/Lagos", start: "08:00", end: "17:00", days: [1, 2, 3, 4, 5], holidays: [] };

describe("working-time", () => {
  it("counts a target inside one working day as plain hours", () => {
    // Tuesday 2026-10-20 09:00 Lagos (UTC+1) → 4 working hours → 13:00 Lagos
    expect(addWorkingHours(new Date("2026-10-20T08:00:00Z"), 4, lagos).toISOString()).toBe("2026-10-20T12:00:00.000Z");
  });

  it("stands still overnight and over the weekend", () => {
    // Friday 2026-10-23 16:00 Lagos, 4 working hours → 1h Friday, 3h on Monday from 08:00 → Monday 11:00 Lagos
    expect(addWorkingHours(new Date("2026-10-23T15:00:00Z"), 4, lagos).toISOString()).toBe("2026-10-26T10:00:00.000Z");
  });

  it("skips a holiday", () => {
    const withHoliday = { ...lagos, holidays: ["2026-10-26"] };
    expect(addWorkingHours(new Date("2026-10-23T15:00:00Z"), 4, withHoliday).toISOString()).toBe("2026-10-27T10:00:00.000Z");
  });

  it("measures elapsed working hours", () => {
    expect(workingHoursBetween(new Date("2026-10-23T15:00:00Z"), new Date("2026-10-26T10:00:00Z"), lagos)).toBeCloseTo(4, 5);
  });
});
