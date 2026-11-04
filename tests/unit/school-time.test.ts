import { describe, expect, it } from "vitest";

import { clockIn, todayIn } from "../../backend/src/modules/parent-portal/school-time";

describe("the day and the clock at a school", () => {
  // 23:30 UTC is already the next day in Abuja (UTC+1) and still the same day in Accra (UTC+0).
  const lateEvening = new Date("2026-11-03T23:30:00Z");

  it("gives each school its own clock, an hour apart for Accra and Abuja", () => {
    expect(clockIn("Africa/Lagos", lateEvening)).toBe("00:30");
    expect(clockIn("Africa/Accra", lateEvening)).toBe("23:30");
  });

  it("turns the day over at each school's own midnight", () => {
    expect(todayIn("Africa/Lagos", lateEvening)).toBe("2026-11-04");
    expect(todayIn("Africa/Accra", lateEvening)).toBe("2026-11-03");
  });

  it("writes the day as YYYY-MM-DD and the clock as 24-hour HH:MM", () => {
    const noon = new Date("2026-03-05T12:05:00Z");
    expect(todayIn("Africa/Accra", noon)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(clockIn("Africa/Accra", noon)).toBe("12:05");
  });

  it("falls back to Lagos for a zone the runtime does not know, rather than failing", () => {
    expect(todayIn("Not/AZone", lateEvening)).toBe("2026-11-04");
    expect(clockIn("Not/AZone", lateEvening)).toBe("00:30");
  });
});
