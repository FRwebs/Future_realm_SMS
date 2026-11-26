import { attendanceRate, countedDays, daysHere, tallyCounts, tallyMarks } from "../../src/lib/domain/attendance-rate";

describe("a child's attendance rate", () => {
  it("is the share of counted days in school", () => {
    expect(attendanceRate(tallyMarks(["PRESENT", "PRESENT", "PRESENT", "ABSENT"]))).toBe(75);
  });

  it("does not count an excused day at all", () => {
    // 3 days present, 1 excused: the excused day is neither present nor missed, so 3 of 3.
    expect(attendanceRate(tallyMarks(["PRESENT", "PRESENT", "PRESENT", "EXCUSED"]))).toBe(100);
    expect(countedDays(tallyMarks(["PRESENT", "EXCUSED"]))).toBe(1);
  });

  it("has no rate yet, not 0%, for a child whose only marked day is excused", () => {
    expect(attendanceRate(tallyMarks(["EXCUSED"]))).toBeNull();
    expect(attendanceRate(tallyMarks([]))).toBeNull();
  });

  it("counts a late day as present unless the school says otherwise", () => {
    const tally = tallyMarks(["PRESENT", "LATE", "ABSENT", "ABSENT"]);
    expect(attendanceRate(tally)).toBe(50);
    expect(attendanceRate(tally, false)).toBe(25);
    expect(daysHere(tally, false)).toBe(1);
  });

  it("is a real 0% when a child was counted and never there", () => {
    expect(attendanceRate(tallyMarks(["ABSENT", "ABSENT"]))).toBe(0);
  });

  it("ignores a holiday or anything that is not a register mark", () => {
    expect(attendanceRate(tallyMarks(["PRESENT", "HOLIDAY", "ABSENT"]))).toBe(50);
  });

  it("works the same from marks already grouped", () => {
    const grouped = tallyCounts([{ status: "PRESENT", count: 18 }, { status: "LATE", count: 1 }, { status: "ABSENT", count: 1 }, { status: "EXCUSED", count: 4 }]);
    expect(attendanceRate(grouped)).toBe(95);
  });
});
