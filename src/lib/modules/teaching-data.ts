import { armRows } from "@/lib/modules/school-data";

/**
 * Subject × arm × teacher — the mapping the school actually runs on.
 *
 * A subject is only real once somebody teaches it in a named arm, so the unit
 * here is never the subject: it is the subject-arm. A subject-arm nobody
 * teaches cannot be scored, so every report card in that arm is blocked by it,
 * and the list says so rather than quietly showing a blank.
 */

export type SubjectArm = {
  subject: string;
  code: string;
  category: string;
  arm: string;
  /** Empty when nobody teaches it. */
  teacher: string;
  department: string;
  /** Days it has gone unassigned, counted from the start of term. */
  unassignedDays: number;
  takers: number;
};

const seed: Array<[string, string, string, string, string, string, number, number]> = [
  ["Mathematics", "MTH", "Core", "JSS 2A", "Mr Ibrahim Danladi", "Mathematics", 0, 34],
  ["Mathematics", "MTH", "Core", "JSS 2B", "Mr Ibrahim Danladi", "Mathematics", 0, 31],
  ["English Language", "ENG", "Core", "JSS 2A", "Mrs Folake Adeniyi", "Languages", 0, 34],
  ["English Language", "ENG", "Core", "JSS 1A", "Mrs Folake Adeniyi", "Languages", 0, 29],
  ["Civic Education", "CIV", "Core", "JSS 3A", "", "Humanities", 34, 33],
  ["Civic Education", "CIV", "Core", "JSS 3C", "", "Humanities", 34, 31],
  ["Civic Education", "CIV", "Core", "JSS 2A", "Mrs Ngozi Eze", "Humanities", 0, 34],
  ["Basic Science", "BSC", "Science", "JSS 2A", "Miss Grace Etim", "Sciences", 0, 34],
  ["Physics", "PHY", "Science", "SSS 2A", "Mr Peter Obi", "Sciences", 0, 34],
  ["Chemistry", "CHM", "Science", "SSS 2A", "Mr Samuel Adeyemi", "Sciences", 0, 34],
  ["Biology", "BIO", "Science", "SSS 1B", "Mr Sule Bature", "Sciences", 0, 28],
  ["Financial Accounting", "FAC", "Commercial", "SSS 2B", "Mrs Chioma Obi", "Commerce", 0, 24],
  ["Business Studies", "BUS", "Commercial", "JSS 2A", "Mrs Chioma Obi", "Commerce", 0, 34],
  ["Agricultural Science", "AGR", "Science", "JSS 2A", "Mr Sule Bature", "Vocational", 0, 34],
  ["Garment Making", "GMK", "Trade", "SSS 2A", "Mrs Amaka Eze", "Vocational", 0, 18],
  ["Physical Education", "PHE", "Co-curricular", "JSS 2A", "Mr Peter Obi", "Sciences", 0, 34],
  ["French", "FRE", "Language", "JSS 1C", "Mrs Ngozi Eze", "Languages", 0, 28],
  ["Social Studies", "SOS", "Humanities", "JSS 2A", "Mrs Blessing Uche", "Humanities", 0, 34],
  ["Computer Studies", "CMP", "Core", "SSS 1A", "Mr Samuel Adeyemi", "Sciences", 0, 26],
  ["Home Economics", "HEC", "Vocational", "JSS 1A", "Mrs Amaka Eze", "Vocational", 0, 29],
];

export const subjectArms: SubjectArm[] = seed.map(
  ([subject, code, category, arm, teacher, department, unassignedDays, takers]) => ({
    subject,
    code,
    category,
    arm,
    teacher,
    department,
    unassignedDays,
    takers,
  }),
);

/** The subject-arms nobody teaches. Each one blocks a whole arm's report cards. */
export const uncoveredSubjectArms = subjectArms.filter((entry) => !entry.teacher);

/**
 * The school's own figures for the mapping as a whole.
 *
 * 186 subject-arms is the school's total across 42 arms; the 20 above are the
 * ones the mockup names, and the two uncovered are both of the uncovered ones.
 */
export const subjectArmTotals = {
  subjects: 34,
  subjectArms: 186,
  assigned: 184,
  unassigned: uncoveredSubjectArms.length,
  teachingStaff: 42,
  /** Periods a week one teacher may hold. */
  ceiling: 24,
};

export type TeacherLoad = {
  name: string;
  department: string;
  subjects: string[];
  arms: string;
  periods: number;
  verdict: "Within range" | "At the ceiling" | "Over the ceiling" | "Under-loaded";
};

export const teacherLoads: TeacherLoad[] = [
  { name: "Mr Ibrahim Danladi", department: "Mathematics", subjects: ["Mathematics"], arms: "JSS 2A, JSS 2B, JSS 3B, SSS 1A", periods: 22, verdict: "Within range" },
  { name: "Mrs Folake Adeniyi", department: "Languages", subjects: ["English Language", "Literature"], arms: "JSS 1A, JSS 2A, SSS 2A", periods: 24, verdict: "At the ceiling" },
  { name: "Mr Samuel Adeyemi", department: "Sciences", subjects: ["Chemistry", "Computer Studies"], arms: "SSS 1A, SSS 2A, SSS 3A", periods: 26, verdict: "Over the ceiling" },
  { name: "Mrs Ngozi Eze", department: "Languages", subjects: ["French", "Civic Education"], arms: "JSS 1C, JSS 2A", periods: 14, verdict: "Within range" },
  { name: "Miss Grace Etim", department: "Sciences", subjects: ["Basic Science"], arms: "JSS 1A, JSS 2A, JSS 2C", periods: 18, verdict: "Within range" },
  { name: "Mr Peter Obi", department: "Sciences", subjects: ["Physics", "Physical Education"], arms: "JSS 2A, SSS 2A, SSS 3A", periods: 25, verdict: "Over the ceiling" },
  { name: "Mrs Blessing Uche", department: "Humanities", subjects: ["Social Studies", "Government"], arms: "JSS 2A, JSS 3A, SSS 2B", periods: 20, verdict: "Within range" },
  { name: "Mr Sule Bature", department: "Vocational", subjects: ["Agricultural Science", "Biology"], arms: "JSS 2A, JSS 3C, SSS 1B", periods: 19, verdict: "Within range" },
  { name: "Mrs Chioma Obi", department: "Commerce", subjects: ["Business Studies", "Financial Accounting"], arms: "JSS 2A, SSS 2B", periods: 16, verdict: "Within range" },
  { name: "Mrs Amaka Eze", department: "Vocational", subjects: ["Home Economics", "Garment Making"], arms: "JSS 1A, SSS 2A", periods: 11, verdict: "Under-loaded" },
];

export type SchoolClass = {
  name: string;
  stage: "Early Years" | "Primary" | "Junior Secondary" | "Senior Secondary";
  roll: number;
  capacity: number;
  arms: string[];
  /** e.g. "3 arms · A, B, C" */
  armsLabel: string;
  formMasters: string;
  overCapacity: string[];
  uncovered: number;
  state: "Uncovered" | "Over capacity" | "Open";
};

function stageOf(className: string): SchoolClass["stage"] {
  if (/Nursery/.test(className)) return "Early Years";
  if (/Primary/.test(className)) return "Primary";
  if (/JSS/.test(className)) return "Junior Secondary";
  return "Senior Secondary";
}

/**
 * The classes, grouped from the same arm table every other module reads.
 *
 * A class holds arms, not students — it is the ladder students are promoted
 * along, and its roll is only ever the sum of its arms'.
 */
export function schoolClasses(): SchoolClass[] {
  const grouped = new Map<string, typeof armRows>();

  for (const row of armRows) {
    const list = grouped.get(row.className) ?? [];
    list.push(row);
    grouped.set(row.className, list);
  }

  return [...grouped].map(([name, arms]) => {
    const overCapacity = arms.filter((arm) => arm.roll > arm.capacity).map((arm) => arm.arm);
    const uncovered = subjectArms.filter(
      (entry) => !entry.teacher && entry.arm.replace(/[A-C]$/, "") === name,
    ).length;

    return {
      name,
      stage: stageOf(name),
      roll: arms.reduce((total, arm) => total + arm.roll, 0),
      capacity: arms.reduce((total, arm) => total + arm.capacity, 0),
      arms: arms.map((arm) => arm.arm),
      armsLabel: `${arms.length} arms · ${arms.map((arm) => arm.arm.slice(-1)).join(", ")}`,
      formMasters: `${arms.length} of ${arms.length} named`,
      overCapacity,
      uncovered,
      state: uncovered ? "Uncovered" : overCapacity.length ? "Over capacity" : "Open",
    };
  });
}

/** The arms the mockup offers in its own arm filters. */
export const namedArms = [
  "JSS 1A", "JSS 1B", "JSS 1C", "JSS 2A", "JSS 2B", "JSS 2C",
  "JSS 3A", "JSS 3B", "SSS 1A", "SSS 2A", "SSS 2B", "SSS 3A",
];

/** The three children enrolled this term and never allocated to an arm. */
export const unallocatedStudents = ["Chioma Nwankwo", "Ibrahim Sule", "Blessing Ade"];

export type Period = {
  period: string;
  time: string;
  subject: string;
  teacher: string;
  venue: string;
};

/** JSS 2A's Thursday on the running timetable — the arm the mockup shows. */
export const jss2aThursday: Period[] = [
  { period: "1", time: "08:00–08:40", subject: "English Language", teacher: "Mrs Folake Adeniyi", venue: "Block A · 12" },
  { period: "2", time: "08:40–09:20", subject: "Mathematics", teacher: "Mr Ibrahim Danladi", venue: "Block A · 12" },
  { period: "3", time: "09:20–10:00", subject: "Basic Science", teacher: "Miss Grace Etim", venue: "Laboratory 1" },
  { period: "—", time: "10:00–10:20", subject: "Break", teacher: "—", venue: "—" },
  { period: "4", time: "10:20–11:00", subject: "Civic Education", teacher: "Mrs Ngozi Eze", venue: "Block A · 12" },
  { period: "5", time: "11:00–11:40", subject: "Mathematics", teacher: "Mr Ibrahim Danladi", venue: "Block A · 12" },
  { period: "6", time: "11:40–12:20", subject: "Agricultural Science", teacher: "Mr Sule Bature", venue: "Block B · 3" },
  { period: "7", time: "12:20–13:00", subject: "Physical Education", teacher: "Mr Peter Obi", venue: "Main field" },
];

/** Which block an arm is based in. */
export function venueBase(arm: string): string {
  if (/SSS/.test(arm)) return "Block C";
  if (/JSS/.test(arm)) return "Block A";
  return "Block B";
}
