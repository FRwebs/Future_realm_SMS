import {
  calculateCurriculumCompletion,
  calculateTotalMinutes,
  calculateTrainingCompliance,
  minutesFromTime,
  normalizeSchoolDay,
  resolveClockInStatus
} from "@/lib/domain/nigeria-operations";

describe("Nigeria-specific academic operations rules", () => {
  it("normalizes school days and parses Nigerian school-day policy times", () => {
    const day = normalizeSchoolDay(new Date("2026-04-13T14:25:00.000Z"));

    expect(day.toISOString()).toBe("2026-04-13T00:00:00.000Z");
    expect(minutesFromTime("07:45")).toBe(465);
  });

  it("calculates clock-in status and total minutes from resumption rules", () => {
    expect(
      resolveClockInStatus({
        clockInAt: new Date("2026-04-13T07:54:00"),
        resumptionTime: "07:45",
        graceMinutes: 10
      })
    ).toBe("PRESENT");

    expect(
      resolveClockInStatus({
        clockInAt: new Date("2026-04-13T07:56:00"),
        resumptionTime: "07:45",
        graceMinutes: 10
      })
    ).toBe("LATE");

    expect(calculateTotalMinutes(new Date("2026-04-13T07:45:00.000Z"), new Date("2026-04-13T15:30:00.000Z"))).toBe(465);
    expect(calculateTotalMinutes(new Date("2026-04-13T15:30:00.000Z"), new Date("2026-04-13T07:45:00.000Z"))).toBeUndefined();
  });

  it("summarizes scheme-of-work completion and mandatory training compliance", () => {
    expect(
      calculateCurriculumCompletion([
        { progressStatus: "COMPLETED" },
        { progressStatus: "TAUGHT" },
        { progressStatus: "IN_PROGRESS" },
        { progressStatus: "NOT_STARTED" }
      ])
    ).toBe(50);

    expect(
      calculateTrainingCompliance([
        { status: "COMPLETED", mandatory: true },
        { status: "ATTENDED", mandatory: true },
        { status: "COMPLETED", mandatory: false }
      ])
    ).toBe(50);
  });
});
