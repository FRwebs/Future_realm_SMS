import {
  allArmNames,
  armRows,
  attendanceArms,
  attendanceDay,
  formMasterOf,
  formMasters,
} from "@/lib/modules/school-data";

describe("the sample school's shared data", () => {
  it("builds the mockup's 14 classes and 42 arms", () => {
    expect(armRows).toHaveLength(42);
    expect(new Set(armRows.map((row) => row.className)).size).toBe(14);
    expect(new Set(allArmNames).size).toBe(42);

    expect(armRows[0]!.arm).toBe("Nursery 1A");
    expect(armRows.at(-1)!.arm).toBe("SSS 3C");
  });

  it("totals the roll from the arm table rather than a stated figure", () => {
    // The mockup's own comment says 1,560, but the roll table it ships sums to
    // 1,557. The table is the source of truth, so every module reads this.
    const summed = armRows.reduce((total, row) => total + row.roll, 0);
    expect(attendanceDay().roll).toBe(summed);
    expect(summed).toBe(1557);
  });

  it("streams senior arms and leaves the rest unstreamed", () => {
    expect(armRows.find((row) => row.arm === "SSS 2A")!.stream).toBe("Science");
    expect(armRows.find((row) => row.arm === "SSS 2B")!.stream).toBe("Commercial");
    expect(armRows.find((row) => row.arm === "SSS 2C")!.stream).toBe("Arts");
    expect(armRows.find((row) => row.arm === "JSS 1A")!.stream).toBe("Not streamed");

    expect(armRows.find((row) => row.arm === "SSS 1A")!.subjects).toBe(9);
    expect(armRows.find((row) => row.arm === "JSS 1A")!.subjects).toBe(8);
    expect(armRows.find((row) => row.arm === "Primary 1A")!.subjects).toBe(6);
  });

  it("gives every arm exactly one named form master", () => {
    for (const row of armRows) {
      expect(row.formMaster).toBeTruthy();
      expect(formMasterOf(row.arm)).toBe(row.formMaster);
    }

    expect(formMasterOf("not-an-arm")).toBe("Unassigned");
  });

  it("marks today's register for every arm exactly once", () => {
    expect(attendanceArms).toHaveLength(42);

    const day = attendanceDay();
    expect(day.marked + day.partial + day.unmarked).toBe(42);
    expect(day.unmarked).toBe(5);
    expect(day.partial).toBe(1);

    // An unmarked arm is unknown, never zero — it reports no counts at all.
    for (const arm of attendanceArms) {
      if (arm.state === "Unmarked") {
        expect(arm.present).toBeNull();
        expect(arm.absent).toBeNull();
        expect(arm.markedAt).toBe("—");
      } else {
        expect(arm.present).toBe(arm.roll - arm.absent! - arm.late! - arm.excused!);
      }
    }
  });

  it("counts the day only from arms that have been marked", () => {
    const day = attendanceDay();
    const counted = attendanceArms.filter((arm) => arm.state !== "Unmarked");

    expect(day.accounted).toBe(counted.reduce((total, arm) => total + arm.roll, 0));
    expect(day.accounted).toBeLessThan(day.roll);
    expect(day.present).toBe(counted.reduce((total, arm) => total + arm.present!, 0));
  });

  it("groups form masters so the by-teacher tables cannot disagree with the by-arm ones", () => {
    const masters = formMasters();
    expect(masters).toHaveLength(16);

    // Every arm is answered for by exactly one form master in the grouping.
    const groupedArms = masters.flatMap((master) => master.arms.map((row) => row.arm));
    expect(groupedArms).toHaveLength(42);
    expect(new Set(groupedArms).size).toBe(42);

    for (const master of masters) {
      expect(master.roll).toBe(master.arms.reduce((total, row) => total + row.roll, 0));
      expect(master.done + master.missed).toBe(master.arms.length);
      expect(master.punctuality).toBeGreaterThanOrEqual(58);
      expect(master.punctuality).toBeLessThanOrEqual(99);
    }
  });
});
