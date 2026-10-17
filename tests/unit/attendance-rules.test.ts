import { add, addDays, dayOf, emptyTally, isSchoolDay, iso, rate, schoolDaysBetween, today, weekStart, type TermLike } from "../../backend/src/modules/attendance-management/attendance.shared";
import { isBreach, stateOfRegister, teacherRecord, type Ledger } from "../../backend/src/modules/attendance-management/ledger";

const policy = { markCutoff: "09:30", bell: "08:00", lateCounts: true, target: 92, chronic: 75, watch: 85, minDays: 5, alertDays: 3, alertChannel: "SMS", guardianNotifyAt: "10:00" };

const term: TermLike = {
  id: "t1", name: "Second Term", startDate: new Date("2026-01-05"), endDate: new Date("2026-04-30"),
  breakStart: new Date("2026-03-02"), breakEnd: new Date("2026-03-06"), schoolDays: ["MON", "TUE", "WED", "THU", "FRI"],
};

describe("a rate", () => {
  it("leaves an excused day out of the count and keeps a late one in", () => {
    const tally = { present: 8, late: 1, absent: 1, excused: 5 };
    expect(rate(tally)).toBe(90);
  });

  it("can be told a late child does not count as in the room", () => {
    expect(rate({ present: 8, late: 2, absent: 0, excused: 0 }, false)).toBe(80);
  });

  it("is unknown, not zero, when nothing was recorded", () => {
    expect(rate(emptyTally())).toBeNull();
    const only = emptyTally();
    add(only, "EXCUSED", 3);
    expect(rate(only)).toBeNull();
  });
});

describe("which days the school sat", () => {
  it("skips weekends and the mid-term break", () => {
    expect(isSchoolDay(term, dayOf("2026-01-10"))).toBe(false);
    expect(isSchoolDay(term, dayOf("2026-03-04"))).toBe(false);
    expect(isSchoolDay(term, dayOf("2026-03-09"))).toBe(true);
  });

  it("is closed outside the term's own dates", () => {
    expect(isSchoolDay(term, dayOf("2026-01-02"))).toBe(false);
    expect(isSchoolDay(term, dayOf("2026-05-04"))).toBe(false);
  });

  it("counts a week without the break in it as five days", () => {
    expect(schoolDaysBetween(term, dayOf("2026-03-09"), dayOf("2026-03-13"))).toHaveLength(5);
    expect(schoolDaysBetween(term, dayOf("2026-03-02"), dayOf("2026-03-06"))).toHaveLength(0);
  });

  it("starts a week on Monday", () => {
    expect(iso(weekStart(dayOf("2026-04-17")))).toBe("2026-04-13");
    expect(iso(weekStart(dayOf("2026-04-19")))).toBe("2026-04-13");
    expect(iso(addDays(dayOf("2026-04-13"), 4))).toBe("2026-04-17");
  });

  it("reads today as the calendar date in Lagos, not in UTC", () => {
    expect(iso(today(new Date("2026-04-17T23:30:00Z")))).toBe("2026-04-18");
    expect(iso(today(new Date("2026-04-17T11:00:00Z")))).toBe("2026-04-17");
  });
});

describe("whether a register was in time", () => {
  const base = { status: "SUBMITTED", date: dayOf("2026-04-17"), backdated: false };

  it("is on time before the cutoff on the day", () => {
    expect(stateOfRegister({ ...base, submittedAt: new Date("2026-04-17T07:10:00Z") }, policy)).toBe("ON_TIME");
  });

  it("is late after the cutoff, in Lagos time", () => {
    expect(stateOfRegister({ ...base, submittedAt: new Date("2026-04-17T09:45:00Z") }, policy)).toBe("LATE");
  });

  it("is backdated when it was taken on a later day", () => {
    expect(stateOfRegister({ ...base, submittedAt: new Date("2026-04-20T08:00:00Z") }, policy)).toBe("BACKDATED");
  });

  it("is untimed, and never a breach, when no clock time was ever recorded", () => {
    const state = stateOfRegister({ ...base, submittedAt: null }, policy);
    expect(state).toBe("UNTIMED");
    expect(isBreach(state)).toBe(false);
  });

  it("is a draft until it is submitted", () => {
    expect(stateOfRegister({ ...base, status: "DRAFT", submittedAt: null }, policy)).toBe("DRAFT");
  });
});

describe("a form master's record", () => {
  const arm = { id: "a1", name: "JSS 1 A", roll: 20, masterId: "u1", master: "Mr A", assistantId: null, dept: null };
  const days = ["2026-04-13", "2026-04-14", "2026-04-15", "2026-04-16"].map(dayOf);
  const entry = (state: string) => ({ state, markedAt: null, byId: "u1", roll: 20, startedAt: null, submittedAt: null }) as never;

  it("counts a missing register against punctuality and leaves an untimed one out", () => {
    const ledger: Ledger = new Map([["a1", new Map([["2026-04-13", entry("ON_TIME")], ["2026-04-14", entry("LATE")], ["2026-04-15", entry("UNTIMED")]])]]);
    const record = teacherRecord([arm], ledger, days);
    expect(record.owed).toBe(4);
    expect(record.breached).toBe(2);
    expect(record.missing).toBe(1);
    expect(record.punctuality).toBe(33);
  });

  it("has no punctuality when every register is of unknown time", () => {
    const ledger: Ledger = new Map([["a1", new Map(days.map((day) => [iso(day), entry("UNTIMED")]))]]);
    expect(teacherRecord([arm], ledger, days).punctuality).toBeNull();
  });
});
