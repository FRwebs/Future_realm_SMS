import type { DrawerSpec } from "@/lib/modules/panels";

import type {
  ArmDetail,
  ArmRow,
  ClassRow,
  Overview,
  SubjectArm,
  TeacherLoad,
  Teaching,
  TimetableList,
} from "@/lib/modules/live/m3-types";

/**
 * Every modal in Class & Timetable, as data.
 *
 * Selects show a person's name or an arm's name and the endpoint stores an id, so
 * each form carries the pairing beside the field it belongs to (`encode`). Two
 * people with one name are told apart by their staff number, so the pairing never
 * silently picks the wrong one.
 */

const API = "/api/v1/class-structure";

export const STAGES = ["Early Years", "Primary", "Junior Secondary", "Senior Secondary"];
export const STREAM_CHOICES = ["Not applicable", "Science", "Commercial", "Arts", "Technical"];
export const NOBODY = "Nobody named yet";

export type Named = { label: string; id: string };

/** "Name · department", with the staff number added only where two labels would collide. */
export function teacherChoices(teachers: TeacherLoad[]): Named[] {
  const base = teachers.map((teacher) => ({
    id: teacher.id,
    label: teacher.department ? `${teacher.name} · ${teacher.department}` : teacher.name,
    staffNo: teacher.staffNo,
  }));
  const counts = new Map<string, number>();
  for (const item of base) counts.set(item.label, (counts.get(item.label) ?? 0) + 1);
  return base.map((item) => ({
    id: item.id,
    label: (counts.get(item.label) ?? 0) > 1 && item.staffNo ? `${item.label} · ${item.staffNo}` : item.label,
  }));
}

export function teacherLabel(choices: Named[], id: string | null | undefined): string | undefined {
  return choices.find((choice) => choice.id === id)?.label;
}

const pair = (choices: Named[]) => Object.fromEntries(choices.map((choice) => [choice.label, choice.id]));
const labels = (choices: Named[]) => choices.map((choice) => choice.label);

function armChoices(arms: Array<Pick<ArmRow, "id" | "name" | "roll" | "capacity">>, withRoom = false): Named[] {
  return arms.map((arm) => ({
    id: arm.id,
    label: withRoom ? `${arm.name} · ${arm.roll} of ${arm.capacity}` : arm.name,
  }));
}

/* ───────────────────────────── classes & arms ───────────────────────────── */

export function addClassDrawer(overview: Overview): DrawerSpec {
  const copy = overview.classes
    .filter((level) => level.arms > 0)
    .map((level) => ({ id: level.id, label: `Copy from ${level.name}` }));
  const scratch = "Build from scratch";
  return {
    mode: "form",
    kicker: "Classes",
    title: "Add class",
    commitLabel: "Create class",
    commitDone: "Class created",
    commitDoneBody: "It is on the ladder now. Add arms to it to give students somewhere to sit.",
    reviewNote: "A class holds arms. Nothing is registered against the class itself.",
    fields: [
      { label: "Class name", kind: "text", placeholder: "JSS 4", required: true, span: 2, hint: "The name your school actually uses" },
      { label: "Stage", kind: "select", value: STAGES[2], options: STAGES, required: true },
      {
        label: "Position in the ladder",
        kind: "text",
        value: String(overview.classes.length + 1),
        required: true,
        hint: "Decides promotion order at term close",
      },
      {
        label: "Arms to create with it",
        kind: "text",
        placeholder: "A, B, C",
        optional: true,
        span: 2,
        hint: "Comma separated — leave blank to add arms yourself",
      },
      {
        label: "Curriculum offering",
        kind: "select",
        value: copy[0]?.label ?? scratch,
        options: [...labels(copy), scratch],
        required: true,
        span: 2,
        hint: "Copying gives each new arm the subjects of the class you pick — nobody is named to teach them yet",
      },
      { label: "Show this class to parents", kind: "toggle", on: true, onLabel: "Visible in the portal", offLabel: "Hidden until published" },
    ],
    submit: {
      endpoint: `${API}/classes`,
      method: "POST",
      map: {
        "Class name": "name",
        Stage: "stage",
        "Position in the ladder": "position",
        "Arms to create with it": "arms",
        "Curriculum offering": "copyFromLevelId",
        "Show this class to parents": "visibleToParents",
      },
      encode: { "Curriculum offering": { ...pair(copy), [scratch]: "" } },
    },
  };
}

export function addArmDrawer(overview: Overview, teachers: TeacherLoad[], levelId?: string): DrawerSpec {
  const levels: Named[] = overview.classes.map((level) => ({ id: level.id, label: level.name }));
  const masters = teacherChoices(teachers);
  const chosen = levels.find((level) => level.id === levelId) ?? levels[0];
  return {
    mode: "form",
    kicker: "Classes",
    title: "Add arm",
    commitLabel: "Create arm",
    commitDone: "Arm created",
    commitDoneBody: "It is on every register and timetable from now.",
    reviewNote: "The arm appears on every register and timetable from the moment it is created.",
    fields: [
      { label: "Class", kind: "select", value: chosen?.label ?? "", options: labels(levels), required: true, hint: "The class this arm belongs to" },
      { label: "Arm", kind: "text", placeholder: "D", required: true, hint: "One letter, or a short name your school uses" },
      { label: "Capacity", kind: "text", value: "30", required: true, hint: "Enrolment above this shows as over capacity" },
      { label: "Form master", kind: "select", value: NOBODY, options: [NOBODY, ...labels(masters)] },
      { label: "Classroom", kind: "text", placeholder: "Block B, Room 4", optional: true },
      { label: "Stream", kind: "choice", value: STREAM_CHOICES[0], options: STREAM_CHOICES, span: 2 },
      { label: "Open for allocation now", kind: "toggle", on: true, onLabel: "Students can be allocated", offLabel: "Created but closed" },
    ],
    submit: {
      endpoint: `${API}/arms`,
      method: "POST",
      map: {
        Class: "levelId",
        Arm: "arm",
        Capacity: "capacity",
        "Form master": "formMasterId",
        Classroom: "room",
        Stream: "stream",
        "Open for allocation now": "open",
      },
      encode: { Class: pair(levels), "Form master": { ...pair(masters), [NOBODY]: "" } },
    },
  };
}

export function classDrawer(level: ClassRow): DrawerSpec {
  const stream = level.stage === "Senior Secondary" ? "Science, Commercial, Arts" : "Not streamed";
  const hasStudents = level.roll > 0;
  return {
    mode: "view",
    kicker: "Classes",
    title: level.name,
    sub: `${level.stage} · ${level.arms} arm${level.arms === 1 ? "" : "s"} · ${level.roll} students`,
    facts: [
      ["Class", level.name],
      ["Stage", level.stage],
      ["Arms", level.armNames.length ? level.armNames.join(", ") : "None yet", "Each arm has its own register and form master"],
      ["Students", String(level.roll), "Across all arms in this class"],
      [
        "Total capacity",
        String(level.capacity),
        level.overArms.length ? `${level.overArms.join(", ")} over its capacity` : "Within capacity",
      ],
      ["Form masters named", `${level.formMastersNamed} of ${level.arms}`],
      ["Streaming", stream],
      ["Position in the ladder", String(level.position), "Decides promotion order at term close"],
      ["Shown to parents", level.visibleToParents ? "Yes" : "No"],
      ["State", level.state],
    ],
    edit: {
      mode: "edit",
      kicker: "Classes",
      title: level.name,
      commitDone: `${level.name} saved`,
      commitDoneBody: "Both the previous and the new values are kept on the record.",
      fields: [
        { label: "Class name", kind: "text", value: level.name, required: true, span: 2, hint: "Renaming it renames every arm under it" },
        { label: "Stage", kind: "select", value: STAGES.includes(level.stage) ? level.stage : STAGES[2], options: STAGES, required: true },
        { label: "Position in the ladder", kind: "text", value: String(level.position), required: true },
        {
          label: "Open for allocation",
          kind: "toggle",
          on: level.isActive,
          onLabel: "Open",
          offLabel: "Closed — no student can be placed in it",
        },
        { label: "Show this class to parents", kind: "toggle", on: level.visibleToParents, onLabel: "Visible in the portal", offLabel: "Hidden" },
      ],
      submit: {
        endpoint: `${API}/classes/${level.id}`,
        method: "PATCH",
        map: {
          "Class name": "name",
          Stage: "stage",
          "Position in the ladder": "position",
          "Open for allocation": "isActive",
          "Show this class to parents": "visibleToParents",
        },
        reasonKey: "reason",
        reasonRequired: true,
      },
      remove: {
        endpoint: `${API}/classes/${level.id}`,
        noun: "class",
        warn: hasStudents
          ? `“${level.name}” has ${level.arms} arm${level.arms === 1 ? "" : "s"} and ${level.roll} students in them. A class with students in it cannot be deleted — move them first.`
          : `“${level.name}” and its ${level.arms} empty arm${level.arms === 1 ? "" : "s"} will be removed. A class that other records refer to is closed instead, and the answer says so.`,
      },
    },
  };
}

export function armEditDrawer(arm: ArmDetail, teachers: TeacherLoad[]): DrawerSpec {
  const masters = teacherChoices(teachers);
  const current = arm.formMaster ? teacherLabel(masters, arm.formMaster.id) ?? NOBODY : NOBODY;
  return {
    mode: "edit",
    kicker: arm.level,
    title: arm.name,
    commitDone: `${arm.name} saved`,
    commitDoneBody: "Both the previous and the new values are kept on the record.",
    fields: [
      { label: "Form master", kind: "select", value: current, options: [NOBODY, ...labels(masters)], span: 2, hint: "Owns the daily register and every guardian conversation about this arm" },
      { label: "Capacity", kind: "text", value: String(arm.capacity), required: true, hint: `${arm.roll} on the roll today` },
      { label: "Classroom", kind: "text", value: arm.room ?? "", optional: true },
      { label: "Stream", kind: "choice", value: arm.stream ?? STREAM_CHOICES[0], options: STREAM_CHOICES, span: 2 },
      { label: "Open for allocation", kind: "toggle", on: arm.isActive, onLabel: "Students can be allocated", offLabel: "Closed" },
    ],
    submit: {
      endpoint: `${API}/arms/${arm.id}`,
      method: "PATCH",
      map: { "Form master": "formMasterId", Capacity: "capacity", Classroom: "room", Stream: "stream", "Open for allocation": "open" },
      encode: { "Form master": { ...pair(masters), [NOBODY]: "" } },
      reasonKey: "reason",
      reasonRequired: true,
    },
    remove: {
      endpoint: `${API}/arms/${arm.id}`,
      noun: "arm",
      warn:
        arm.roll > 0
          ? `${arm.name} has ${arm.roll} student${arm.roll === 1 ? "" : "s"} on its roll. An arm with students in it cannot be deleted — move them first.`
          : `${arm.name} is empty. Deleting it takes it off every register and timetable.`,
    },
  };
}

/** Place students who have no arm, or move students from one arm to another. */
export function allocateDrawer(overview: Overview): DrawerSpec {
  const waiting = overview.unallocated.map((student) => ({
    id: student.id,
    label: `${student.name} · ${student.admissionNumber}`,
  }));
  const arms = armChoices(overview.arms.filter((arm) => arm.isActive), true);
  if (!waiting.length) {
    return {
      mode: "view",
      kicker: "Classes",
      title: "Bulk allocation",
      sub: "Every active student already has an arm.",
      facts: [
        ["Waiting for an arm", "0", "Nobody is excluded from a register"],
        ["Moving students between arms", "From the arm's own page", "Open an arm, choose Move students out of this arm"],
      ],
    };
  }
  return {
    mode: "form",
    kicker: "Classes",
    title: "Bulk allocation",
    commitLabel: "Allocate",
    commitDone: "Students allocated",
    commitDoneBody: "They are on the register of their arm from now, and the move is on the allocation record.",
    reviewNote: "Students are placed in the arm you choose. Over its capacity is allowed but flagged, never silently refused.",
    steps: [
      {
        title: "Who",
        hint: `${waiting.length} enrolled student${waiting.length === 1 ? " has" : "s have"} never been given an arm.`,
        fields: [
          { label: "Students", kind: "checks", options: waiting.map((item) => item.label), checked: waiting.map((item) => item.label), span: 2, required: true },
        ],
      },
      {
        title: "Where",
        hint: "Every student you ticked goes into this one arm.",
        fields: [
          { label: "Destination arm", kind: "select", value: arms[0]?.label ?? "", options: labels(arms), required: true, span: 2 },
          { label: "Why", kind: "text", placeholder: "New admissions, September intake", optional: true, span: 2 },
        ],
      },
    ],
    submit: {
      endpoint: `${API}/allocate`,
      method: "POST",
      map: { Students: "studentIds", "Destination arm": "classId", Why: "reason" },
      encode: { Students: pair(waiting), "Destination arm": pair(arms) },
    },
  };
}

/** Move some of an arm's students into another arm — how an over-full arm is split. */
export function moveStudentsDrawer(arm: ArmDetail, otherArms: ArmRow[]): DrawerSpec {
  const students = arm.roster.map((student) => ({ id: student.id, label: `${student.name} · ${student.admissionNumber}` }));
  const targets = armChoices(
    otherArms.filter((other) => other.id !== arm.id && other.isActive),
    true,
  );
  if (!students.length || !targets.length) {
    return {
      mode: "view",
      kicker: arm.level,
      title: "Move students out of this arm",
      sub: !students.length ? "Nobody is on this arm's roll." : "There is no other open arm to move them to.",
      facts: [["On the roll", String(arm.roll)]],
    };
  }
  return {
    mode: "form",
    kicker: arm.name,
    title: "Move students out of this arm",
    commitLabel: "Move them",
    commitDone: "Students moved",
    commitDoneBody: "Their registers, results and fees follow them to the new arm from now.",
    reviewNote: "The move is recorded on the allocation list under your name.",
    fields: [
      { label: "Students to move", kind: "checks", options: students.map((item) => item.label), checked: [], span: 2, required: true },
      { label: "Destination arm", kind: "select", value: targets[0]?.label ?? "", options: labels(targets), required: true, span: 2 },
      { label: "Why", kind: "text", placeholder: "Balancing the arm", optional: true, span: 2 },
    ],
    submit: {
      endpoint: `${API}/allocate`,
      method: "POST",
      map: { "Students to move": "studentIds", "Destination arm": "classId", Why: "reason" },
      encode: { "Students to move": pair(students), "Destination arm": pair(targets) },
    },
  };
}

/* ───────────────────────────── teaching ───────────────────────────── */

const ROLE_LABELS: Record<string, string> = {
  "Primary teacher": "PRIMARY",
  "Second teacher": "SECOND",
  "Cover only": "COVER",
};

export function mapSubjectDrawer(
  teaching: Teaching,
  arms: Array<Pick<ArmRow, "id" | "name" | "roll" | "capacity">>,
  preset: { teacherId?: string; subjectId?: string; armIds?: string[]; title?: string } = {},
): DrawerSpec {
  const teachers = teacherChoices(teaching.teachers);
  const subjects: Named[] = teaching.catalogue.map((subject) => ({ id: subject.id, label: subject.name }));
  const armPairs = armChoices(arms);
  const teacher = preset.teacherId ? teachers.find((item) => item.id === preset.teacherId) : undefined;
  const subject = preset.subjectId ? subjects.find((item) => item.id === preset.subjectId) : undefined;
  const load = preset.teacherId ? teaching.teachers.find((item) => item.id === preset.teacherId) : undefined;
  return {
    mode: "form",
    kicker: "Teaching",
    title: preset.title ?? "Map subject to teacher",
    commitLabel: "Map it",
    commitDone: "Subject mapped",
    commitDoneBody: "The teacher can enter scores for that arm from now on, and it appears on their load.",
    reviewNote:
      "A mapping is always subject AND arm. Mapping a subject without naming the arm is what leaves registers with nobody responsible for them.",
    fields: [
      {
        label: "Teacher",
        kind: "select",
        value: teacher?.label ?? teachers[0]?.label ?? "",
        options: labels(teachers),
        required: true,
        span: 2,
        hint: load ? `Currently ${load.periods} of ${load.ceiling} periods a week` : "Their current load is shown on the Teaching tab",
      },
      { label: "Subject", kind: "select", value: subject?.label ?? subjects[0]?.label ?? "", options: labels(subjects), required: true, hint: "From the saved catalogue" },
      {
        label: "Exactly which arm",
        kind: "checks",
        required: true,
        span: 2,
        row: true,
        options: labels(armPairs),
        checked: (preset.armIds ?? []).map((id) => armPairs.find((item) => item.id === id)?.label).filter((label): label is string => Boolean(label)),
        hint: "Tick every arm this teacher takes the subject in. A mapping with no arm is refused.",
      },
      { label: "Role for these arms", kind: "select", value: "Primary teacher", options: Object.keys(ROLE_LABELS), required: true },
      { label: "Periods a week per arm", kind: "text", value: "4", required: true, hint: `Counted against the ceiling of ${load?.ceiling ?? teaching.schoolCeiling}` },
      {
        label: "If this takes them past the ceiling",
        kind: "text",
        optional: true,
        span: 2,
        placeholder: "Why this teacher can carry more than the ceiling",
        hint: "Only needed if the mapping goes past the ceiling — it is refused without a reason.",
      },
      {
        label: "Score entry",
        kind: "static",
        value: "A mapped teacher can enter and submit scores for these arms",
        hint: "Nobody else can score a subject-arm — which is why an unmapped one blocks every report card in it.",
      },
    ],
    submit: {
      endpoint: `${API}/teaching/map`,
      method: "POST",
      map: {
        Teacher: "teacherId",
        Subject: "subjectId",
        "Exactly which arm": "classIds",
        "Role for these arms": "role",
        "Periods a week per arm": "periodsPerWeek",
        "If this takes them past the ceiling": "overCeilingReason",
      },
      encode: {
        Teacher: pair(teachers),
        Subject: pair(subjects),
        "Exactly which arm": pair(armPairs),
        "Role for these arms": ROLE_LABELS,
      },
    },
  };
}

export function ceilingDrawer(teacher: TeacherLoad, schoolCeiling: number): DrawerSpec {
  return {
    mode: "form",
    kicker: "Teaching",
    title: "Raise teaching ceiling",
    commitLabel: "Raise the ceiling",
    commitDone: "Ceiling raised for this teacher",
    commitDoneBody: "It applies to this teacher only, and is visible on every load report.",
    reviewNote: "A raised ceiling applies to one teacher and is visible on every load report.",
    fields: [
      { label: "Teacher", kind: "static", value: teacher.name, hint: `Currently ${teacher.periods} periods against a ceiling of ${teacher.ceiling}` },
      { label: "New ceiling for this teacher", kind: "text", value: String(Math.max(teacher.periods, schoolCeiling + 1)), required: true },
      { label: "For how long", kind: "select", value: "This term only", options: ["This term only", "This session", "Until I change it"], required: true },
      {
        label: "Reason",
        kind: "area",
        required: true,
        placeholder: "Why this teacher carries more than the school ceiling — kept on their record and on every load report.",
        span: 2,
      },
      { label: "Approved by", kind: "select", value: "The Principal", options: ["The Principal", "The Proprietor"], required: true, span: 2 },
    ],
    submit: {
      endpoint: `${API}/teaching/ceiling`,
      method: "POST",
      body: { teacherId: teacher.id },
      map: {
        "New ceiling for this teacher": "ceiling",
        "For how long": "duration",
        Reason: "reason",
        "Approved by": "approvedBy",
      },
    },
  };
}

export function addSubjectDrawer(teaching: Teaching, overview: Overview): DrawerSpec {
  const teachers = teacherChoices(teaching.teachers);
  const levels: Named[] = overview.classes.filter((level) => level.arms > 0).map((level) => ({ id: level.id, label: level.name }));
  const NOT_YET = "Not assigned yet";
  return {
    mode: "form",
    kicker: "Subjects",
    title: "Add subject",
    commitLabel: "Create subject",
    commitDone: "Subject created",
    commitDoneBody: "It is offered to every arm of the classes you ticked. Nobody is named to teach it until you say who.",
    reviewNote: "A new subject can be offered to any arm as soon as it exists.",
    fields: [
      { label: "Subject name", kind: "text", placeholder: "Data Processing", required: true, span: 2 },
      { label: "Code", kind: "text", placeholder: "DPR", required: true, hint: "Shown on report cards and broadsheets" },
      {
        label: "Category",
        kind: "select",
        value: "Core",
        options: ["Core", "Elective", "Science", "Commercial", "Arts", "Language", "Trade", "Co-curricular"],
        required: true,
      },
      { label: "Offer to", kind: "checks", options: labels(levels), checked: levels.slice(0, 1).map((item) => item.label), span: 2, required: true, row: true },
      {
        label: "Teacher",
        kind: "select",
        value: NOT_YET,
        options: [NOT_YET, ...labels(teachers)],
        span: 2,
        hint: "Optional — leave it unassigned and the catalogue will flag it until someone is named.",
      },
      { label: "Periods a week", kind: "text", value: "3", required: true },
      { label: "Counts to the average", kind: "toggle", on: true, onLabel: "Counts", offLabel: "Does not count" },
      {
        label: "Choice group",
        kind: "static",
        value: "Not recorded yet",
        span: 2,
        hint: "Which choice group a subject belongs to is not stored, so registration rules cannot be enforced from here.",
      },
    ],
    submit: {
      endpoint: `${API}/teaching/subject`,
      method: "POST",
      map: {
        "Subject name": "name",
        Code: "code",
        Category: "category",
        "Offer to": "levelIds",
        Teacher: "teacherId",
        "Periods a week": "periodsPerWeek",
        "Counts to the average": "countsToAverage",
      },
      encode: { "Offer to": pair(levels), Teacher: { ...pair(teachers), [NOT_YET]: "" } },
    },
  };
}

export function subjectArmDrawer(row: SubjectArm, teachers: TeacherLoad[]): DrawerSpec {
  const choices = teacherChoices(teachers);
  const assigned = Boolean(row.teacher);
  const NOBODY_SECOND = "No second teacher";
  const NOT_ASSIGNED = "Not assigned";
  return {
    mode: "view",
    kicker: "Subject catalogue",
    title: `${row.subject} · ${row.arm}`,
    sub: assigned ? `Taught by ${row.teacher?.name}` : "Nobody teaches this yet — name someone here.",
    tone: assigned ? "neutral" : "negative",
    facts: [
      ["Subject", row.subject, `Code ${row.code}`],
      ["Arm", row.arm],
      ["Category", row.category],
      [
        "Teacher",
        row.teacher?.name ?? "Not assigned",
        assigned
          ? row.department ?? row.teacher?.department ?? undefined
          : `Unassigned for ${row.daysUnassigned} days — no scores can exist until someone is named`,
      ],
      ["Second teacher", row.assistant?.name ?? "—"],
      ["Teacher state", assigned ? "Assigned" : "Not assigned"],
      ["Takers", String(row.takers), "Students registered for it in this arm"],
      ["Periods a week", String(row.periods)],
      ["Counts to the average", row.countsToAverage ? "Yes" : "No"],
      ["Compulsory here", row.compulsory ? "Yes" : "No"],
    ],
    edit: {
      mode: "edit",
      kicker: "Subject catalogue",
      title: `${row.subject} · ${row.arm}`,
      commitDone: `${row.subject} in ${row.arm} saved`,
      commitDoneBody: "Both the previous and the new values are kept on the record.",
      fields: [
        {
          label: "Teacher",
          kind: "select",
          value: teacherLabel(choices, row.teacher?.id) ?? NOT_ASSIGNED,
          options: [NOT_ASSIGNED, ...labels(choices)],
          span: 2,
          hint: "A subject nobody teaches cannot be scored, so every card in that arm is blocked by it.",
        },
        {
          label: "Second teacher",
          kind: "select",
          value: teacherLabel(choices, row.assistant?.id) ?? NOBODY_SECOND,
          options: [NOBODY_SECOND, ...labels(choices)],
          span: 2,
        },
        { label: "Periods a week", kind: "text", value: String(row.periods), required: true },
        { label: "Counts to the average", kind: "toggle", on: row.countsToAverage, onLabel: "Counts", offLabel: "Does not count" },
        {
          label: "If this takes them past the ceiling",
          kind: "text",
          optional: true,
          span: 2,
          placeholder: "Only needed if the change goes past their ceiling",
        },
      ],
      submit: {
        endpoint: `${API}/teaching/${row.id}`,
        method: "PATCH",
        map: {
          Teacher: "teacherId",
          "Second teacher": "assistantTeacherId",
          "Periods a week": "periodsPerWeek",
          "Counts to the average": "countsToAverage",
          "If this takes them past the ceiling": "overCeilingReason",
        },
        encode: {
          Teacher: { ...pair(choices), [NOT_ASSIGNED]: "" },
          "Second teacher": { ...pair(choices), [NOBODY_SECOND]: "" },
        },
        reasonKey: "reason",
        reasonRequired: true,
      },
      remove: {
        endpoint: `${API}/teaching/${row.id}`,
        noun: "subject offering",
        warn: `Removing ${row.subject} from ${row.arm} stops that arm offering it. A subject-arm that already has scores cannot be removed.`,
      },
    },
  };
}

/* ───────────────────────────── timetables ───────────────────────────── */

const DAY_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_CODES = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
export const dayCodeFor = (label: string) => label.slice(0, 3).toUpperCase();

export function newTimetableDrawer(list: TimetableList, terms: Named[]): DrawerSpec {
  const stateWord = (state: string) => (state === "RUNNING" ? "running" : state === "DRAFT" ? "draft" : "archived");
  const sources: Named[] = list.versions.map((version) => ({ id: version.id, label: `${version.name} · ${stateWord(version.state)}` }));
  const running = list.versions.find((version) => version.state === "RUNNING");
  const startOptions = ["A copy of the running timetable", "A copy of another timetable", "An empty grid"];
  const currentTerm = terms.find((term) => term.label.startsWith(list.term?.name ?? "")) ?? terms[0];
  return {
    mode: "form",
    kicker: "Timetable",
    title: "New timetable",
    commitLabel: "Create timetable",
    commitDone: "Timetable created as a draft",
    commitDoneBody: "It is a draft until you publish it. The running timetable is untouched.",
    reviewNote: "This creates a draft. Nothing changes for a teacher or a student until you publish it.",
    fields: [
      { label: "Timetable name", kind: "text", placeholder: `${list.term?.name ?? "Term"} · version ${list.versions.length + 1}`, required: true, span: 2, hint: "What you will recognise it by in the list" },
      { label: "Term", kind: "select", value: currentTerm?.label ?? "", options: labels(terms), required: true },
      { label: "Start from", kind: "choice", value: running ? startOptions[0] : startOptions[2], options: startOptions, span: 2 },
      {
        label: "Copy from",
        kind: "select",
        value: sources[0]?.label ?? "Nothing to copy yet",
        options: sources.length ? labels(sources) : ["Nothing to copy yet"],
        hint: "Only used if you chose to copy another timetable",
      },
      { label: "Periods a day", kind: "text", value: "8", required: true },
      { label: "Period length (minutes)", kind: "text", value: "40", required: true },
      { label: "First period starts", kind: "text", value: "08:00", required: true },
      { label: "Break after period", kind: "text", value: "3", optional: true, hint: "Leave blank for no break" },
      { label: "School days", kind: "checks", options: DAY_OPTIONS, checked: DAY_OPTIONS.slice(0, 5), required: true, span: 2, row: true },
      {
        label: "Applies to",
        kind: "select",
        value: "Every arm",
        options: ["Every arm", "Junior Secondary only", "Senior Secondary only"],
        required: true,
        span: 2,
      },
      { label: "Check for teacher clashes as I build it", kind: "toggle", on: true, onLabel: "Checked on every change", offLabel: "Only checked at publish" },
    ],
    submit: {
      endpoint: `${API}/timetables`,
      method: "POST",
      map: {
        "Timetable name": "name",
        Term: "termId",
        "Start from": "startFrom",
        "Copy from": "copyFromId",
        "Periods a day": "periodsPerDay",
        "Period length (minutes)": "periodMinutes",
        "First period starts": "firstStarts",
        "Break after period": "breakAfter",
        "School days": "schoolDays",
        "Applies to": "appliesTo",
        "Check for teacher clashes as I build it": "checkClashes",
      },
      encode: {
        Term: pair(terms),
        "Copy from": pair(sources),
        "School days": Object.fromEntries(DAY_OPTIONS.map((day) => [day, dayCodeFor(day)])),
      },
    },
  };
}

export function publishTimetableDrawer(list: TimetableList, clashes: number): DrawerSpec {
  const candidates = list.versions.filter((version) => version.state !== "RUNNING" && !version.synthetic);
  const running = list.versions.find((version) => version.state === "RUNNING");
  if (!candidates.length) {
    return {
      mode: "view",
      kicker: "Timetable",
      title: "Publish a timetable",
      sub: "There is no draft to publish.",
      facts: [
        ["Currently running", running ? running.name : "Nothing is running"],
        ["Next step", "Build a timetable first", "Start one with New timetable"],
      ],
    };
  }
  const named: Named[] = candidates.map((version) => ({
    id: version.id,
    label: `${version.name} · ${version.state === "DRAFT" ? "draft" : "archived"}`,
  }));
  return {
    mode: "form",
    kicker: "Timetable",
    title: "Publish a timetable",
    commitLabel: "Publish it",
    commitDone: "Timetable published",
    commitDoneBody: "If it takes effect now it is the running timetable and the week families see has changed; if you chose a day, it is set to publish itself that morning.",
    reviewNote:
      "Publishing replaces the running timetable. The one it replaces is kept, and can be published again later.",
    fields: [
      { label: "Timetable to publish", kind: "select", value: named[0].label, options: labels(named), required: true, span: 2, hint: "Only drafts and archived versions can be published — the running one already is" },
      { label: "Currently running", kind: "static", value: running ? running.name : "Nothing", hint: running ? "It becomes archived, and can be republished later" : "This will be the first timetable families see" },
      {
        label: "Clash check",
        kind: "static",
        value: clashes ? `${clashes} clash${clashes === 1 ? "" : "es"} in the running week` : "Re-run on the timetable the moment you publish it",
        hint: "A timetable with a teacher in two rooms in one period is refused, and the answer names who.",
      },
      {
        label: "Takes effect",
        kind: "select",
        value: "Immediately",
        options: ["Immediately", "From tomorrow", "From next Monday", "On a date I choose"],
        required: true,
        hint: "Anything but Immediately sets it to publish itself that morning, after the same checks run today.",
      },
      { label: "Effective date", kind: "text", type: "date", value: "", optional: true, hint: "Only used if you chose a date" },
      {
        label: "Notify",
        kind: "checks",
        options: ["Teachers whose periods changed", "All teaching staff", "Form masters", "Students", "Guardians"],
        checked: ["Teachers whose periods changed", "Form masters"],
        span: 2,
        required: true,
        hint: "Each choice is an in-app announcement to that audience, sent when it is published.",
      },
      {
        label: "Notify by",
        kind: "static",
        value: "In-app",
        span: 2,
        hint: "SMS and email are not sent from here, so they are not offered — they would spend credits.",
      },
      { label: "Note to staff", kind: "area", optional: true, span: 2, placeholder: "Anything the staff should know about the change" },
    ],
    submit: {
      endpoint: `${API}/timetables/publish`,
      method: "POST",
      map: {
        "Timetable to publish": "timetableId",
        "Takes effect": "takesEffect",
        "Effective date": "effectiveDate",
        Notify: "notify",
        "Note to staff": "note",
      },
      encode: {
        "Timetable to publish": pair(named),
        Notify: {
          "Teachers whose periods changed": "teachers-changed",
          "All teaching staff": "teachers-all",
          "Form masters": "form-masters",
          Students: "students",
          Guardians: "guardians",
        },
      },
    },
  };
}

/* ───────────────────────────── bulk actions ─────────────────────────────
   These are templates for a table's bulk bar: the table adds the ticked rows' ids to
   the payload and says how many rows the form applies to. */

export function bulkAssignDrawer(teaching: Teaching): DrawerSpec {
  const teachers = teacherChoices(teaching.teachers);
  return {
    mode: "form",
    kicker: "Teaching",
    title: "Assign a teacher to all",
    commitLabel: "Assign",
    commitDone: "Teacher assigned",
    commitDoneBody: "They can enter scores for each of those arms from now on, and it counts on their load.",
    reviewNote: "Every ticked subject-arm gets this teacher as its primary teacher. Their load is checked against the ceiling for all of them together.",
    fields: [
      { label: "Teacher", kind: "select", value: teachers[0]?.label ?? "", options: labels(teachers), required: true, span: 2 },
      { label: "If this takes them past the ceiling", kind: "text", optional: true, span: 2, placeholder: "Why this teacher can carry more than the ceiling", hint: "Only needed if the whole set goes past their ceiling." },
    ],
    submit: {
      endpoint: `${API}/teaching/bulk-assign`,
      method: "POST",
      map: { Teacher: "teacherId", "If this takes them past the ceiling": "overCeilingReason" },
      encode: { Teacher: pair(teachers) },
    },
  };
}

export function bulkOfferingDrawer(): DrawerSpec {
  const KEEP = "Leave as it is";
  return {
    mode: "form",
    kicker: "Subjects",
    title: "Change the offering",
    commitLabel: "Change them",
    commitDone: "Offering changed",
    commitDoneBody: "The periods and the average rule are updated on every ticked subject-arm.",
    reviewNote: "Only what you fill in is changed; anything left alone stays as it is.",
    fields: [
      { label: "Periods a week", kind: "text", value: "", optional: true, hint: "Leave blank to keep each one's own" },
      { label: "Counts to the average", kind: "choice", value: KEEP, options: [KEEP, "Counts", "Does not count"], span: 2 },
    ],
    submit: {
      endpoint: `${API}/teaching/bulk-update`,
      method: "POST",
      map: { "Periods a week": "periodsPerWeek", "Counts to the average": "countsToAverage" },
      encode: { "Counts to the average": { [KEEP]: "keep", Counts: "counts", "Does not count": "not" } },
    },
  };
}

export function bulkFormMasterDrawer(teachers: TeacherLoad[]): DrawerSpec {
  const masters = teacherChoices(teachers);
  return {
    mode: "form",
    kicker: "Classes",
    title: "Assign a form master",
    commitLabel: "Assign",
    commitDone: "Form master assigned",
    commitDoneBody: "They own the register of each of those arms from now.",
    reviewNote: "One person becomes form master of every ticked arm.",
    fields: [{ label: "Form master", kind: "select", value: masters[0]?.label ?? "", options: labels(masters), required: true, span: 2 }],
    submit: { endpoint: `${API}/arms/bulk`, method: "POST", map: { "Form master": "formMasterId" }, encode: { "Form master": pair(masters) } },
  };
}

export function bulkCapacityDrawer(target: "arms" | "classes"): DrawerSpec {
  return {
    mode: "form",
    kicker: "Classes",
    title: "Change capacity",
    commitLabel: "Change capacity",
    commitDone: "Capacity changed",
    commitDoneBody: "Enrolment above the new figure now shows as over capacity.",
    reviewNote: target === "classes" ? "Every arm of each ticked class gets this capacity." : "Every ticked arm gets this capacity.",
    fields: [{ label: "Capacity", kind: "text", value: "35", required: true, hint: target === "classes" ? "Per arm" : "Seats in each arm" }],
    submit: {
      endpoint: target === "classes" ? `${API}/classes/bulk` : `${API}/arms/bulk`,
      method: "POST",
      map: { Capacity: "capacity" },
    },
  };
}

export function bulkAddArmDrawer(): DrawerSpec {
  return {
    mode: "form",
    kicker: "Classes",
    title: "Add an arm to each",
    commitLabel: "Add the arms",
    commitDone: "Arms added",
    commitDoneBody: "Each ticked class has a new arm, named with the next free letter.",
    reviewNote: "The new arms have no students, form master or subjects yet.",
    fields: [{ label: "Add one arm to each class", kind: "static", value: "Named with the next free letter", hint: "Choose its capacity below, or leave it as the class's other arms have it.", span: 2 }, { label: "Capacity", kind: "text", value: "", optional: true }],
    submit: { endpoint: `${API}/classes/bulk`, method: "POST", body: { addArm: true }, map: { Capacity: "capacity" } },
  };
}

export function moveSelectedDrawer(arms: Array<Pick<ArmRow, "id" | "name" | "roll" | "capacity" | "isActive">>, fromArmId: string): DrawerSpec {
  const targets = armChoices(arms.filter((arm) => arm.isActive && arm.id !== fromArmId), true);
  return {
    mode: "form",
    kicker: "Classes",
    title: "Move to another arm",
    commitLabel: "Move them",
    commitDone: "Students moved",
    commitDoneBody: "Their registers, results and fees follow them from now, and the move is on the allocation record.",
    reviewNote: "The move is recorded under your name. Going over capacity is allowed but flagged.",
    fields: [
      { label: "Destination arm", kind: "select", value: targets[0]?.label ?? "", options: labels(targets), required: true, span: 2 },
      { label: "Why", kind: "text", optional: true, placeholder: "Balancing the arm", span: 2 },
    ],
    submit: { endpoint: `${API}/allocate`, method: "POST", map: { "Destination arm": "classId", Why: "reason" }, encode: { "Destination arm": pair(targets) } },
  };
}

/** Put subjects on an arm's list, with nobody named to teach them until someone is. */
export function registerSubjectsDrawer(
  teaching: Teaching,
  arms: Array<Pick<ArmRow, "id" | "name" | "roll" | "capacity">>,
  armIds: string[] = [],
): DrawerSpec {
  const subjects: Named[] = teaching.catalogue.map((subject) => ({ id: subject.id, label: `${subject.name} · ${subject.code}` }));
  const teachers = teacherChoices(teaching.teachers);
  const armPairs = armChoices(arms);
  const NOT_YET = "Not assigned yet";
  return {
    mode: "form",
    kicker: "Subjects",
    title: "Register subjects",
    commitLabel: "Register",
    commitDone: "Subject registered",
    commitDoneBody: "It is on each arm's list. Until someone is named to teach it, the catalogue flags it.",
    reviewNote: "Registering offers the subject to the arms you tick. It does not name a teacher unless you choose one.",
    fields: [
      { label: "Subject", kind: "select", value: subjects[0]?.label ?? "", options: labels(subjects), required: true, span: 2, hint: "From the saved catalogue" },
      {
        label: "Offer to",
        kind: "checks",
        options: labels(armPairs),
        checked: armIds.map((id) => armPairs.find((item) => item.id === id)?.label).filter((value): value is string => Boolean(value)),
        required: true,
        span: 2,
        row: true,
      },
      { label: "Teacher", kind: "select", value: NOT_YET, options: [NOT_YET, ...labels(teachers)], span: 2, hint: "Optional — a subject can exist before anyone teaches it." },
    ],
    submit: {
      endpoint: `${API}/teaching/offer`,
      method: "POST",
      map: { Subject: "subjectId", "Offer to": "classIds", Teacher: "teacherId" },
      encode: { Subject: pair(subjects), "Offer to": pair(armPairs), Teacher: { ...pair(teachers), [NOT_YET]: "" } },
    },
  };
}

/** The mockup's bulk student allocation: who is being moved, then where they go. */
export function allocateBulkDrawer(overview: Overview): DrawerSpec {
  const sources: Array<{ label: string; token: string }> = [];
  if (overview.unallocated.length) sources.push({ label: `Students with no arm · ${overview.unallocated.length}`, token: "none" });
  for (const level of overview.classes.filter((item) => item.roll > 0)) {
    sources.push({ label: `${level.name} · all arms · ${level.roll}`, token: `level:${level.id}` });
  }
  for (const arm of overview.arms.filter((item) => item.roll > 0)) {
    sources.push({ label: `${arm.name} · ${arm.roll}`, token: `arm:${arm.id}` });
  }
  const arms = armChoices(overview.arms.filter((arm) => arm.isActive), true);
  if (!sources.length) {
    return { mode: "view", kicker: "Classes", title: "Bulk allocation", sub: "Nobody is on a roll yet.", facts: [["Students", "0"]] };
  }
  const BASIS = ["By gender", "By prior performance", "Alphabetical"];
  return {
    mode: "form",
    kicker: "Classes",
    title: "Bulk allocation",
    commitLabel: "Allocate",
    commitDone: "Students allocated",
    commitDoneBody: "They are dealt out across the arms you chose and the move is on the allocation record.",
    reviewNote:
      "A preview of the sizes this gives is shown when it is done. Above fifty students you must type ALLOCATE to go ahead.",
    steps: [
      {
        title: "Select",
        hint: "Who is being moved, and how they are shared out.",
        fields: [
          { label: "From", kind: "select", value: sources[0].label, options: sources.map((item) => item.label), required: true, span: 2 },
          { label: "Basis", kind: "choice", value: BASIS[0], options: BASIS, span: 2, hint: "By gender deals boys and girls out evenly; by prior performance deals the strongest and weakest out in turn." },
        ],
      },
      {
        title: "Destination",
        hint: "The arms they are shared across.",
        fields: [
          { label: "Destination arms", kind: "checks", options: labels(arms), checked: [], required: true, span: 2, row: true },
          { label: "Respect stream election", kind: "static", value: "Not applied", hint: "A student's stream election is not recorded, so students are placed by the basis alone.", span: 2 },
          { label: "Allow arms to go over capacity", kind: "toggle", on: false, onLabel: "Allowed", offLabel: "Blocked — add an arm instead", span: 2 },
          { label: "Confirm (needed above 50 students)", kind: "text", value: "", optional: true, placeholder: "ALLOCATE", span: 2 },
          { label: "Why", kind: "text", optional: true, placeholder: "Start of term allocation", span: 2 },
        ],
      },
    ],
    submit: {
      endpoint: `${API}/allocate/bulk`,
      method: "POST",
      map: {
        From: "from",
        Basis: "basis",
        "Destination arms": "destinationIds",
        "Allow arms to go over capacity": "allowOver",
        "Confirm (needed above 50 students)": "confirm",
        Why: "reason",
      },
      encode: { From: Object.fromEntries(sources.map((item) => [item.label, item.token])), "Destination arms": pair(arms) },
    },
  };
}
