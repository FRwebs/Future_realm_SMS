import { describe, expect, it } from "vitest";

import { countSchoolDays, dayRange } from "@/lib/modules/live/m2-school-configuration";
import {
  POLICY_DEFINITIONS,
  policyDefinition,
  policySub,
  summarisePolicy,
  validatePolicyValues,
} from "@/lib/modules/school-policies";

describe("school policies", () => {
  it("ships a default every setting can actually hold", () => {
    for (const definition of POLICY_DEFINITIONS) {
      expect(validatePolicyValues(definition, definition.defaults)).toBeNull();
    }
  });

  it("refuses a value the setting does not offer", () => {
    const timeout = policyDefinition("session_timeout")!;
    expect(validatePolicyValues(timeout, { mode: "5 minutes" })).toMatch(/choices offered/);
    expect(validatePolicyValues(timeout, {})).toMatch(/missing/);

    const visibility = policyDefinition("student_portal_visibility")!;
    // Fees are never shown to a student, so they are not an option at all.
    expect(validatePolicyValues(visibility, { sees: ["Results", "Fees"] })).toMatch(/options offered/);
  });

  it("describes a setting the way a person would say it", () => {
    expect(summarisePolicy("student_portal_visibility", { sees: ["Results", "Attendance"] })).toBe(
      "Results and attendance only",
    );
    expect(summarisePolicy("guardian_portal_visibility", { sees: ["Results", "Attendance", "Fees"] })).toBe(
      "Results, attendance, fees",
    );
    expect(
      summarisePolicy("default_channel_window", { channel: "SMS", opens: "07:00", closes: "19:00" }),
    ).toBe("SMS · 07:00–19:00 WAT");
  });

  it("counts accepted guardian submissions as it goes", () => {
    const definition = policyDefinition("guardian_submissions")!;
    expect(policySub(definition, { accepts: ["Absence", "Fee query"] })).toBe("2 of 8 types accepted");
  });
});

describe("school days", () => {
  const term = { startDate: "2026-01-05", endDate: "2026-01-16", breakStart: null, breakEnd: null, schoolDays: undefined };

  it("counts Monday to Friday by default", () => {
    // 5 Jan 2026 is a Monday: two full weeks.
    expect(countSchoolDays(term, new Set())).toBe(10);
  });

  it("takes the mid-term break out", () => {
    expect(countSchoolDays({ ...term, breakStart: "2026-01-12", breakEnd: "2026-01-14" }, new Set())).toBe(7);
  });

  it("leaves out a day an event closes the school, and respects the days the school sits", () => {
    const closed = new Set([Date.UTC(2026, 0, 7)]);
    expect(countSchoolDays(term, closed)).toBe(9);
    // One Saturday (10 Jan) falls inside the two weeks.
    expect(countSchoolDays({ ...term, schoolDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT"] }, new Set())).toBe(11);
  });
});

describe("date ranges", () => {
  it("reads as a person would write it", () => {
    expect(dayRange("2026-10-27", "2026-10-31")).toBe("27–31 Oct");
    expect(dayRange("2026-10-30", "2026-11-03")).toBe("30 Oct–3 Nov");
    expect(dayRange("2026-10-01", "2026-10-01")).toBe("1 Oct");
  });
});
