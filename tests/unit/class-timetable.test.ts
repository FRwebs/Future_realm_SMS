import { describe, expect, it } from "vitest";

import { addArmDrawer, teacherChoices } from "@/lib/modules/live/m3-forms";
import type { Overview, TeacherLoad } from "@/lib/modules/live/m3-types";
import { buildPeriods, clashesIn, type Grid } from "@/lib/modules/timetable-periods";

const teacher = (id: string, name: string, department: string | null, staffNo: string): TeacherLoad => ({
  id,
  name,
  email: `${id}@school.test`,
  phone: null,
  staffNo,
  designation: null,
  department,
  subjects: [],
  arms: [],
  subjectArms: 0,
  sheetsOwed: 0,
  periods: 0,
  ceiling: 24,
  raised: false,
  load: "No assignment",
});

describe("buildPeriods", () => {
  it("cuts a day into periods and puts the break where the school said", () => {
    const day = buildPeriods({ periodsPerDay: 8, periodMinutes: 40, firstStarts: "08:00", breakAfter: 3 });
    expect(day).toHaveLength(9);
    expect(day[0]).toEqual({ n: 1, start: "08:00", end: "08:40" });
    expect(day[2]).toEqual({ n: 3, start: "09:20", end: "10:00" });
    expect(day[3]).toEqual({ n: "break", start: "10:00", end: "10:20" });
    expect(day[4]).toEqual({ n: 4, start: "10:20", end: "11:00" });
    expect(day[8]).toEqual({ n: 8, start: "13:00", end: "13:40" });
  });

  it("leaves the break out when there is none, or when it would fall after the last period", () => {
    expect(buildPeriods({ periodsPerDay: 4, periodMinutes: 45, firstStarts: "07:30", breakAfter: null })).toHaveLength(4);
    expect(buildPeriods({ periodsPerDay: 4, periodMinutes: 45, firstStarts: "07:30", breakAfter: 4 })).toHaveLength(4);
  });
});

describe("clashesIn", () => {
  const cell = (teacherId: string | null) => ({ subjectId: "s", teacherId });

  it("finds a teacher booked into two arms in the same period", () => {
    const grid: Grid = {
      a: { "1|1": cell("t1"), "1|2": cell("t2") },
      b: { "1|1": cell("t1"), "2|1": cell("t1") },
    };
    const clashes = clashesIn(grid);
    expect(clashes).toHaveLength(1);
    expect(clashes[0]).toMatchObject({ teacherId: "t1", day: 1, period: 1 });
    expect(clashes[0].classIds.sort()).toEqual(["a", "b"]);
  });

  it("does not call one teacher in one arm twice a clash, and ignores periods nobody teaches", () => {
    const grid: Grid = { a: { "1|1": cell("t1"), "1|2": cell("t1"), "1|3": cell(null) }, b: { "1|3": cell(null) } };
    expect(clashesIn(grid)).toEqual([]);
  });
});

describe("teacherChoices", () => {
  it("labels people by department and tells two of the same name apart by staff number", () => {
    const choices = teacherChoices([
      teacher("1", "Ada Obi", "Sciences", "EMP-1"),
      teacher("2", "Ada Obi", "Sciences", "EMP-2"),
      teacher("3", "Tunde Bello", null, "EMP-3"),
    ]);
    expect(choices.map((choice) => choice.label)).toEqual([
      "Ada Obi · Sciences · EMP-1",
      "Ada Obi · Sciences · EMP-2",
      "Tunde Bello",
    ]);
    expect(new Set(choices.map((choice) => choice.label)).size).toBe(3);
  });
});

describe("addArmDrawer", () => {
  const overview = {
    term: null,
    classes: [
      { id: "L1", name: "JSS 1", arms: 2 },
      { id: "L2", name: "JSS 2", arms: 1 },
    ],
    arms: [],
    unallocated: [],
    balancing: null,
    recent: [],
  } as unknown as Overview;

  it("sends the class and the form master as ids, not as the names on screen", () => {
    const drawer = addArmDrawer(overview, [teacher("t1", "Ada Obi", "Sciences", "EMP-1")], "L2");
    expect(drawer.submit?.encode?.Class).toEqual({ "JSS 1": "L1", "JSS 2": "L2" });
    expect(drawer.submit?.encode?.["Form master"]).toMatchObject({ "Ada Obi · Sciences": "t1", "Nobody named yet": "" });
    const classField = drawer.fields?.find((field) => field.label === "Class");
    expect(classField && "value" in classField ? classField.value : undefined).toBe("JSS 2");
  });
});

describe("bulk drawers", () => {
  it("send teachers and the offering rule as codes the API reads, not the words on screen", async () => {
    const { bulkAssignDrawer, bulkOfferingDrawer, publishTimetableDrawer } = await import("@/lib/modules/live/m3-forms");
    const teaching = {
      teachers: [teacher("t1", "Ada Obi", "Sciences", "EMP-1")],
      catalogue: [],
      subjectArms: [],
    } as unknown as import("@/lib/modules/live/m3-types").Teaching;
    expect(bulkAssignDrawer(teaching).submit?.encode?.Teacher).toEqual({ "Ada Obi · Sciences": "t1" });
    expect(bulkOfferingDrawer().submit?.encode?.["Counts to the average"]).toEqual({
      "Leave as it is": "keep",
      Counts: "counts",
      "Does not count": "not",
    });
    const list = {
      term: null,
      versions: [{ id: "v1", name: "Draft one", state: "DRAFT", synthetic: false }],
      totals: { arms: 0, liveArms: 0, clashes: 0 },
      publishes: [],
    } as unknown as import("@/lib/modules/live/m3-types").TimetableList;
    const publish = publishTimetableDrawer(list, 0);
    expect(publish.submit?.encode?.Notify).toMatchObject({ Guardians: "guardians", "Form masters": "form-masters" });
    expect(publish.fields?.some((field) => field.label === "Takes effect" && field.kind === "select")).toBe(true);
  });
});
