/**
 * The sample school the mockup describes: 14 classes, 42 arms, 1,560 students.
 *
 * The mockup is emphatic that this is ONE source of truth — "results, attendance
 * and the broadsheet all derive from it, so no screen can report a different
 * school than the Classes page does". Every module's content should read its
 * arms, rolls and form masters from here rather than restating them.
 */

export type ArmRow = {
  /** e.g. "JSS 2A" */
  arm: string;
  formMaster: string;
  roll: number;
  capacity: number;
  subjects: number;
  stream: string;
  className: string;
};

const formMasterNames = [
  "Mrs Folake Adeniyi",
  "Mrs Amaka Eze",
  "Mrs Ngozi Eze",
  "Adaeze Nwosu",
  "Mr Peter Obi",
  "Miss Grace Etim",
  "Mrs Blessing Uche",
  "Mr Ibrahim Danladi",
  "Mr Sule Bature",
  "Mr Samuel Adeyemi",
  "Mrs Chioma Obi",
  "Mrs Chidinma Eze",
  "Mr Yusuf Bello",
  "Mrs Adaeze Iwu",
  "Mr Femi Balogun",
  "Mrs Hauwa Sani",
];

/** class, arms, capacity, rolls — 14 classes · 42 arms · 1,560 students */
const classGroups: Array<[string, string[], number, number[]]> = [
  ["Nursery 1", ["A", "B", "C"], 42, [40, 39, 40]],
  ["Nursery 2", ["A", "B", "C"], 42, [41, 40, 41]],
  ["Primary 1", ["A", "B", "C"], 45, [44, 43, 44]],
  ["Primary 2", ["A", "B", "C"], 45, [44, 44, 43]],
  ["Primary 3", ["A", "B", "C"], 45, [45, 44, 44]],
  ["Primary 4", ["A", "B", "C"], 45, [44, 44, 45]],
  ["Primary 5", ["A", "B", "C"], 45, [43, 42, 42]],
  ["Primary 6", ["A", "B", "C"], 45, [44, 42, 42]],
  ["JSS 1", ["A", "B", "C"], 30, [29, 30, 28]],
  ["JSS 2", ["A", "B", "C"], 32, [34, 32, 30]],
  ["JSS 3", ["A", "B", "C"], 32, [33, 31, 31]],
  ["SSS 1", ["A", "B", "C"], 32, [30, 31, 30]],
  ["SSS 2", ["A", "B", "C"], 32, [34, 28, 26]],
  ["SSS 3", ["A", "B", "C"], 32, [26, 25, 25]],
];

export const armRows: ArmRow[] = (() => {
  const rows: ArmRow[] = [];
  let index = 0;

  for (const [className, arms, capacity, rolls] of classGroups) {
    arms.forEach((arm, armIndex) => {
      const senior = /SSS/.test(className);
      const stream = senior
        ? arm === "B"
          ? "Commercial"
          : arm === "C"
            ? "Arts"
            : "Science"
        : "Not streamed";

      rows.push({
        arm: `${className}${arm}`,
        formMaster: formMasterNames[index % formMasterNames.length]!,
        roll: rolls[armIndex]!,
        capacity,
        subjects: senior ? 9 : /JSS/.test(className) ? 8 : 6,
        stream,
        className,
      });
      index++;
    });
  }

  return rows;
})();

export const allArmNames = armRows.map((row) => row.arm);

/** The form master of an arm. One arm has exactly one named owner. */
export function formMasterOf(arm: string): string {
  return armRows.find((row) => row.arm === arm)?.formMaster ?? "Unassigned";
}

export type AttendanceState = "Marked" | "In progress" | "Unmarked";

export type AttendanceArm = {
  arm: string;
  formMaster: string;
  roll: number;
  present: number | null;
  absent: number | null;
  late: number | null;
  excused: number | null;
  state: AttendanceState;
  markedAt: string;
  termPercent: string;
};

const unmarkedToday = ["JSS 1C", "JSS 2C", "JSS 3B", "SSS 2B", "SSS 3A"];
const inProgressToday = ["SSS 1A"];

/**
 * Today's register for every arm.
 *
 * The arithmetic is the mockup's own, kept verbatim so the tables and the
 * headline above them cannot disagree. Note that its `absent` term is
 * `(i * 3) % 3`, which is always zero — so no arm shows an absence today. That
 * is the mockup's own sample data, not a transcription slip; change it here if
 * the sample school should show absences.
 */
export const attendanceArms: AttendanceArm[] = armRows.map((row, index) => {
  const unmarked = unmarkedToday.includes(row.arm);
  const partial = inProgressToday.includes(row.arm);

  if (unmarked) {
    return {
      arm: row.arm,
      formMaster: row.formMaster,
      roll: row.roll,
      present: null,
      absent: null,
      late: null,
      excused: null,
      state: "Unmarked",
      markedAt: "—",
      termPercent: (row.arm === "JSS 3B" ? 89.4 : 91 + ((index * 7) % 8)).toFixed(1),
    };
  }

  const absent = (index * 3) % 3;
  const late = (index * 5) % 2;
  const excused = index % 7 === 0 ? 1 : 0;

  return {
    arm: row.arm,
    formMaster: row.formMaster,
    roll: row.roll,
    present: row.roll - absent - late - excused,
    absent,
    late,
    excused,
    state: partial ? "In progress" : "Marked",
    markedAt: partial
      ? "09:41"
      : `0${7 + (index % 2)}:${String(2 + ((index * 7) % 50)).padStart(2, "0")}`,
    termPercent: (93 + ((index * 5) % 5)).toFixed(1),
  };
});

/**
 * The day in numbers, computed from the arms actually rendered — so a headline
 * can never describe a different school than the table beneath it.
 */
export function attendanceDay() {
  const marked = attendanceArms.filter((arm) => arm.state === "Marked");
  const partial = attendanceArms.filter((arm) => arm.state === "In progress");
  const unmarked = attendanceArms.filter((arm) => arm.state === "Unmarked");
  const counted = [...marked, ...partial];

  const sum = (rows: AttendanceArm[], pick: (arm: AttendanceArm) => number | null) =>
    rows.reduce((total, arm) => total + (pick(arm) ?? 0), 0);

  const accounted = sum(counted, (arm) => arm.roll);
  const present = sum(counted, (arm) => arm.present);

  return {
    arms: attendanceArms.length,
    roll: sum(attendanceArms, (arm) => arm.roll),
    marked: marked.length,
    partial: partial.length,
    unmarked: unmarked.length,
    unmarkedArms: unmarked,
    accounted,
    present,
    absent: sum(counted, (arm) => arm.absent),
    late: sum(counted, (arm) => arm.late),
    percent: accounted ? ((present / accounted) * 100).toFixed(1) : "0.0",
  };
}

export type FormMasterRecord = {
  name: string;
  arms: ArmRow[];
  armNames: string;
  roll: number;
  done: number;
  missed: number;
  /** Punctuality, as a percentage. */
  punctuality: number;
  /** Arm-days missed in the last five school days. */
  week: number;
  /** Arm-days missed across all 34 school days so far. */
  term: number;
  department: string;
  pattern: "Repeat" | "Occasional" | "Clean";
};

const departments = [
  "Languages",
  "Sciences",
  "Mathematics",
  "Humanities",
  "Commerce",
  "Vocational",
];

/**
 * Form masters, grouped from the arm rows — so the "by teacher" tables cannot
 * disagree with the "by arm" tables above them.
 */
export function formMasters(): FormMasterRecord[] {
  const grouped = new Map<string, ArmRow[]>();
  for (const row of armRows) {
    grouped.set(row.formMaster, [...(grouped.get(row.formMaster) ?? []), row]);
  }

  const stateByArm = new Map(attendanceArms.map((arm) => [arm.arm, arm.state]));

  return [...grouped.entries()].map(([name, arms], index) => {
    const done = arms.filter((row) => stateByArm.get(row.arm) === "Marked").length;
    const missed = arms.length - done;
    const punctuality = Math.max(58, Math.min(99, 99 - missed * 11 - (index % 3) * 4));

    return {
      name,
      arms,
      armNames: arms.map((row) => row.arm).join(", "),
      roll: arms.reduce((total, row) => total + row.roll, 0),
      done,
      missed,
      punctuality,
      week: missed * 2 + (index % 2),
      term: missed * 7 + (index % 4),
      department: departments[index % departments.length]!,
      pattern: punctuality < 72 ? "Repeat" : punctuality < 90 ? "Occasional" : "Clean",
    };
  });
}

export type ArmResult = {
  arm: string;
  formMaster: string;
  roll: number;
  /** Students whose result can actually be computed. */
  computed: number;
  average: number;
  passRate: number;
  subjects: number;
  topGrade: string;
  /** Students waiting on an unapproved score sheet. */
  blocked: number;
};

/** A handful of arms are still waiting on a sheet — named, not random. */
const blockedByArm: Record<string, number> = {
  "JSS 3A": 8,
  "JSS 3C": 7,
  "SSS 2A": 1,
  "JSS 2B": 1,
};

/**
 * Results per arm, derived from the same arm table as attendance and the
 * broadsheet — so no screen can report a different school than the Classes
 * page does.
 */
export function armResults(): ArmResult[] {
  return armRows.map((row, index) => {
    const blocked = blockedByArm[row.arm] ?? 0;
    const senior = /SSS/.test(row.arm);
    // A stable per-arm average, seniors a little higher, JSS 3B the weakest.
    const base = row.arm === "JSS 3B" ? 61.7 : (senior ? 69.4 : 66.2) + ((index * 7) % 9) - 4;
    const average = Math.round(base * 10) / 10;

    return {
      arm: row.arm,
      formMaster: row.formMaster,
      roll: row.roll,
      computed: row.roll - blocked,
      average,
      passRate: Math.max(72, Math.min(96, Math.round(average + 19))),
      subjects: senior ? 9 : 8,
      topGrade: average >= 70 ? "A1" : average >= 65 ? "B2" : "B3",
      blocked,
    };
  });
}

export function armResultOf(arm: string): ArmResult {
  return armResults().find((result) => result.arm === arm) ?? armResults()[0]!;
}

export type ArmCardState = {
  arm: string;
  formMaster: string;
  roll: number;
  ready: number;
  blocked: number;
  /** Cards whose form master remark is still unwritten. */
  owed: number;
  /** Cards written but not yet reviewed. */
  inReview: number;
  average: number;
};

/**
 * Report-card readiness per arm.
 *
 * A card is generated for a child but published for an arm, so the question is
 * "which arms can I send out", not "how many cards exist". The per-student rule
 * is the mockup's: a card needs its scores, its form master remark and a review.
 */
export function armCardStates(): ArmCardState[] {
  return armResults().map((result) => {
    let ready = 0;
    let owed = 0;
    let inReview = 0;

    for (let index = 0; index < result.roll; index++) {
      // The blocked students sit at the foot of the arm's ranking.
      const scores = index >= result.blocked;
      const remark = index % 3 !== 0;
      const review = scores && remark && index % 5 !== 0;

      if (scores && remark && review) ready++;
      else if (scores && !remark) owed++;
      else if (scores && remark && !review) inReview++;
    }

    return {
      arm: result.arm,
      formMaster: result.formMaster,
      roll: result.roll,
      ready,
      blocked: result.blocked,
      owed,
      inReview,
      average: result.average,
    };
  });
}
