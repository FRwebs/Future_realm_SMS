import { apiGet } from "@/lib/api/server";
import { lessonNotesTab } from "@/lib/modules/live/m3-lesson-notes";
import {
  addArmDrawer,
  addClassDrawer,
  addSubjectDrawer,
  allocateBulkDrawer,
  allocateDrawer,
  bulkAddArmDrawer,
  bulkAssignDrawer,
  bulkCapacityDrawer,
  bulkFormMasterDrawer,
  bulkOfferingDrawer,
  ceilingDrawer,
  classDrawer,
  mapSubjectDrawer,
  newTimetableDrawer,
  publishTimetableDrawer,
  registerSubjectsDrawer,
  subjectArmDrawer,
  type Named,
} from "@/lib/modules/live/m3-forms";
import type {
  Coverage,
  Overview,
  Teaching,
  TeacherLoad,
  TimetableDetail,
  TimetableList,
  TimetableVersionRow,
} from "@/lib/modules/live/m3-types";
import { dayLabel } from "@/lib/modules/timetable-periods";
import {
  bar,
  name as nameCell,
  pill,
  text,
  type DrawerSpec,
  type KpiCard,
  type ListItem,
  type PanelFact,
  type PanelTone,
  type TabContent,
  type TableRow,
} from "@/lib/modules/panels";

/**
 * M03 Class & Timetable, read from `/api/v1/class-structure`.
 *
 * The module is five readings of one structure: classes and the arms under them
 * (Classes), subject × arm × teacher (Subjects), the same mappings read as work and
 * load (Teaching), the weeks that have been built and the one that is running
 * (Timetable), and whether the school is ready to teach at all (Coverage).
 *
 * Where the mockup shows something this school's records cannot yet prove — a
 * subject's choice group, a registration minimum — the figure says "Not recorded"
 * rather than inventing one.
 */

const BASE = "/api/v1/class-structure";
const CONFIG = "/api/v1/configuration";

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

const dateLabel = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

const dateLong = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

const STATE_TONE: Record<string, PanelTone> = {
  Open: "positive",
  "Over capacity": "attention",
  "Under-filled": "neutral",
  Closed: "neutral",
  Uncovered: "attention",
};

export async function loadOverview() {
  return apiGet<Overview>(`${BASE}/overview`);
}
export async function loadTeaching() {
  return apiGet<Teaching>(`${BASE}/teaching`);
}
export async function loadCoverage() {
  return apiGet<Coverage>(`${BASE}/coverage`);
}
export async function loadTimetables() {
  return apiGet<TimetableList>(`${BASE}/timetables`);
}
export async function loadTimetable(id: string) {
  return apiGet<TimetableDetail>(`${BASE}/timetables/${id}`);
}

type TermRecord = { id: string; name: string };
type SessionRecord = { name: string; terms: TermRecord[] };

/** Every term the school has, as "Second Term · 2025/2026" paired with its id. */
export async function loadTermChoices(): Promise<Named[]> {
  const sessions = await apiGet<{ records: SessionRecord[] }>(`${CONFIG}/sessions-terms`).catch(() => ({
    records: [] as SessionRecord[],
  }));
  return (sessions?.records ?? []).flatMap((session) =>
    session.terms.map((term) => ({ id: term.id, label: `${term.name} · ${session.name}` })),
  );
}

/* ───────────────────────────── Classes ───────────────────────────── */

function balancingDrawer(overview: Overview): DrawerSpec | null {
  const plan = overview.balancing;
  if (!plan) return null;
  const arm = overview.arms.find((item) => item.id === plan.armId);
  const level = overview.classes.find((item) => item.id === arm?.levelId);
  return {
    mode: "view",
    kicker: "Classes",
    title: `Balancing proposal for ${plan.name}`,
    sub: `${plan.name} holds ${plan.roll} against a capacity of ${plan.capacity}.`,
    tone: "attention",
    facts: [
      ["Arm", plan.name],
      ["On the roll", String(plan.roll), `${plan.roll - plan.capacity} over capacity`],
      ["Capacity", String(plan.capacity)],
      [
        "Splitting in two",
        `${plan.halves[0]} and ${plan.halves[1]}`,
        `Add a new arm to ${level?.name ?? "the class"}, then move ${plan.halves[1]} students into it`,
      ],
      ["Or", "Raise the capacity", `Open ${plan.name} and change its capacity if the room can hold them`],
      ["Where to do it", "The arm's own page", "Move students out of this arm picks exactly who goes"],
    ],
  };
}

function classesTab(overview: Overview, teaching: Teaching): TabContent {
  const { classes, arms, unallocated } = overview;
  const placed = arms.reduce((sum, arm) => sum + arm.roll, 0);
  const over = arms.filter((arm) => arm.roll > arm.capacity);
  const termLabel = overview.term ? `${overview.term.name} ${overview.term.session}` : "No active term";

  const addArm = addArmDrawer(overview, teaching.teachers);
  const addClass = addClassDrawer(overview);
  const allocate = allocateDrawer(overview);
  const allocateAll = allocateBulkDrawer(overview);

  const cards: KpiCard[] = [
    { label: "Classes", value: String(classes.length), sub: "The promotion ladder" },
    { label: "Class arms", value: String(arms.length), sub: "Each with its own register" },
    {
      label: "Students",
      value: (placed + unallocated.length).toLocaleString("en-NG"),
      sub: arms.length ? `${Math.round(placed / arms.length)} per arm on average` : "No arm yet",
    },
    {
      label: "Over capacity",
      value: String(over.length),
      unit: over.length === 1 ? "arm" : "arms",
      tone: over.length ? "attention" : "positive",
      sub: over.length ? over.slice(0, 3).map((arm) => arm.name).join(", ") : "Every arm is within its capacity",
    },
    {
      label: "No arm yet",
      value: String(unallocated.length),
      unit: "students",
      tone: unallocated.length ? "negative" : "positive",
      sub: unallocated.length ? "Excluded from every register" : "Everyone is placed",
      ...(unallocated.length ? { link: "Allocate", drawer: allocate } : {}),
    },
  ];

  const classRows: TableRow[] = classes.map((level) => ({
    id: level.id,
    cells: [
      text(level.name, { strong: true }),
      text(level.stage),
      text(level.armNames.length ? level.armNames.join(" ") : "None yet", { tone: level.arms ? undefined : "attention" }),
      text(String(level.roll)),
      text(String(level.capacity)),
      text(level.arms ? `${level.formMastersNamed} of ${level.arms}` : "—", {
        tone: level.arms && level.formMastersNamed < level.arms ? "attention" : undefined,
      }),
      pill(level.state, STATE_TONE[level.state] ?? "neutral"),
      { kind: "action", label: "Open", drawer: classDrawer(level) },
    ],
    drawer: classDrawer(level),
    keywords: `${level.stage}`,
  }));

  const stages = Array.from(new Set(classes.map((level) => level.stage)));
  const levelNames = classes.map((level) => level.name);
  const streams = Array.from(new Set(arms.map((arm) => arm.stream).filter((value): value is string => Boolean(value))));

  const armLetters = Array.from(new Set(arms.map((arm) => arm.arm)));
  const armRows: TableRow[] = arms.map((arm) => {
    const full = arm.roll > arm.capacity;
    const level = classes.find((item) => item.id === arm.levelId);
    return {
      id: arm.id,
      cells: [
        text(arm.name, { strong: true }),
        arm.formMaster ? nameCell(arm.formMaster.name, "Form master") : text("Nobody named", { tone: "negative", strong: true }),
        text(String(arm.roll)),
        bar(percent(arm.roll, arm.capacity), `${arm.roll} / ${arm.capacity}`, full ? "negative" : "positive"),
        text(String(arm.subjects), { tone: arm.uncoveredSubjects ? "attention" : undefined }),
        text(arm.stream ?? "Not streamed"),
        pill(arm.state, STATE_TONE[arm.state] ?? "neutral"),
        { kind: "action", label: "Open", href: `/class-timetable/classes/${arm.id}` },
      ],
      href: `/class-timetable/classes/${arm.id}`,
      keywords: `|${level?.name ?? ""}| arm:${arm.arm}| ${arm.formMaster?.name ?? ""} ${arm.room ?? ""}`,
    };
  });

  const proposal = balancingDrawer(overview);

  const recent: ListItem[] = [
    ...(unallocated.length
      ? [
          {
            label: plural(unallocated.length, "student") + " awaiting allocation",
            sub: `Enrolled and given no arm · excluded from all registers`,
            pill: "Not started",
            tone: "attention" as PanelTone,
            viewLabel: "Allocate",
            drawer: allocate,
          },
        ]
      : []),
    ...overview.recent.map((entry) => ({
      label: entry.label,
      sub: `By ${entry.by}, ${dateLabel(entry.at)}${entry.detail ? ` · ${entry.detail}` : ""}`,
      pill: "Complete",
    })),
  ];

  return {
    title: "Classes",
    desc: "Every class, its arms, and where each student sits.",
    primary: { label: "Add arm", drawer: addArm },
    launchers: [
      { label: "Add a class", drawer: addClass },
      { label: "Bulk allocation", drawer: allocateAll },
    ],
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: "Structure", sub: termLabel, per: 5, cards }] },
      ...(unallocated.length
        ? [
            {
              cols: "1fr",
              panels: [
                {
                  type: "note" as const,
                  tone: "attention" as PanelTone,
                  title: `${plural(unallocated.length, "student")} ${unallocated.length === 1 ? "has" : "have"} no class arm`,
                  body: `${unallocated
                    .slice(0, 3)
                    .map((student) => student.name)
                    .join(", ")}${unallocated.length > 3 ? ` and ${unallocated.length - 3} more` : ""} ${unallocated.length === 1 ? "was" : "were"} enrolled and never allocated.`,
                  acts: [
                    { label: `Allocate the ${unallocated.length}`, drawer: allocate },
                    { label: "See their records", href: "/student-records/registry" },
                  ],
                },
              ],
            },
          ]
        : []),
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Classes",
            sub: "The ladder students are promoted along. A class holds arms, not students.",
            meta: `${plural(classes.length, "class", "classes")} · ${plural(arms.length, "arm")} · ${(placed + unallocated.length).toLocaleString("en-NG")} students`,
            noun: "class",
            nounPlural: "classes",
            search: "Find a class by name or stage",
            filters: [{ label: "Stage", value: "All stages", options: ["All stages", ...stages] }],
            acts: [{ label: "Add class", primary: true, drawer: addClass }],
            selectable: true,
            bulkActs: [
              { label: "Add an arm to each", drawer: bulkAddArmDrawer(), selection: { key: "levelIds", noun: "class" } },
              { label: "Change capacity", drawer: bulkCapacityDrawer("classes"), selection: { key: "levelIds", noun: "class" } },
              { label: "Export selected", primary: true, export: true },
            ],
            head: ["Class", "Stage", "Arms", "Students", "Capacity", "Form masters", "State", ""],
            rows: classRows,
            per: 8,
            empty: "No class matches this filter.",
            foot: "Open a class to change its arms, capacity or promotion position — or to delete it.",
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Class arms",
            tag: plural(arms.length, "arm"),
            sub: "Every arm, who is responsible for it, and how full it is.",
            meta: `${plural(arms.length, "arm")} · ${placed.toLocaleString("en-NG")} students · ${over.length} over capacity`,
            noun: "arm",
            nounPlural: "arms",
            search: "Find an arm by name, form master or stream",
            filters: [
              {
                label: "Arm",
                value: "All",
                options: ["All", ...armLetters],
                match: Object.fromEntries(armLetters.map((letter) => [letter, `arm:${letter}|`])),
              },
              {
                label: "Class",
                value: "All classes",
                options: ["All classes", ...levelNames],
                match: Object.fromEntries(levelNames.map((levelName) => [levelName, `|${levelName}|`])),
              },
              { label: "Stream", value: "All streams", options: ["All streams", "Not streamed", ...streams] },
              { label: "State", value: "All", options: ["All", "Open", "Over capacity", "Under-filled"], column: 6 },
            ],
            selectable: true,
            bulkActs: [
              { label: "Assign a form master", drawer: bulkFormMasterDrawer(teaching.teachers), selection: { key: "armIds", noun: "arm" } },
              { label: "Change capacity", drawer: bulkCapacityDrawer("arms"), selection: { key: "armIds", noun: "arm" } },
              { label: "Export selected", primary: true, export: true },
            ],
            head: ["Arm", "Form master", "Roll", "Capacity", "Subjects", "Stream", "State", ""],
            rows: armRows,
            per: 10,
            empty: "No arm matches this filter.",
            foot: "Open an arm for its roster, its subject teachers and its register history — or to delete it.",
          },
        ],
      },
      {
        cols: "1fr 1.15fr",
        panels: [
          proposal
            ? {
                type: "note",
                tone: "progress",
                title: `Balancing proposal for ${overview.balancing?.name}`,
                body: `${overview.balancing?.name} holds ${overview.balancing?.roll} against a capacity of ${overview.balancing?.capacity}. Splitting it into two would give ${overview.balancing?.halves[0]} and ${overview.balancing?.halves[1]}.`,
                acts: [
                  { label: "Review the proposal", drawer: proposal },
                  { label: "Change capacity instead", href: `/class-timetable/classes/${overview.balancing?.armId}` },
                ],
              }
            : {
                type: "note",
                tone: "positive",
                title: "No arm needs balancing",
                body: "Every arm is within its capacity, so there is no split to propose.",
              },
          {
            type: "list",
            title: "Recent allocations",
            readOnly: true,
            sub: "Every move is recorded under the name of the person who made it.",
            items: recent.length
              ? recent
              : [{ label: "Nothing has been allocated yet", sub: "A move made here appears on this list", pill: "Empty" }],
          },
        ],
      },
    ],
  };
}

/* ───────────────────────────── Subjects ───────────────────────────── */

function subjectsTab(teaching: Teaching, overview: Overview): TabContent {
  const rows = teaching.subjectArms;
  const unstaffed = rows.filter((row) => !row.teacher);
  const invalid = teaching.invalidCombinations;
  const notCounted = Array.from(new Set(rows.filter((row) => !row.countsToAverage).map((row) => row.subject)));
  const mapDrawer = mapSubjectDrawer(teaching, overview.arms, {
    subjectId: unstaffed[0]?.subjectId,
    armIds: unstaffed[0] ? [unstaffed[0].classId] : [],
  });
  const addSubject = addSubjectDrawer(teaching, overview);
  const mapAny = mapSubjectDrawer(teaching, overview.arms);
  const register = registerSubjectsDrawer(teaching, overview.arms);
  const armsWithSubjects = Array.from(new Map(rows.map((row) => [row.classId, row.arm])).entries());

  const levelNames = Array.from(new Set(rows.map((row) => row.level)));
  const categories = Array.from(new Set(rows.map((row) => row.category)));
  const departments = Array.from(new Set(teaching.teachers.map((teacher) => teacher.department).filter((value): value is string => Boolean(value))));

  const catalogueRows: TableRow[] = rows
    .slice()
    .sort((a, b) => Number(Boolean(a.teacher)) - Number(Boolean(b.teacher)) || a.levelOrder - b.levelOrder || a.subject.localeCompare(b.subject))
    .map((row) => {
      const drawer = subjectArmDrawer(row, teaching.teachers);
      return {
        id: row.id,
        cells: [
          text(row.subject, { strong: true }),
          text(row.code),
          text(row.category),
          text(row.arm),
          row.teacher
            ? nameCell(row.teacher.name, row.teacher.department ?? row.department ?? "")
            : text(`Nobody named · ${row.daysUnassigned} days`, { tone: "negative", strong: true }),
          pill(row.teacher ? "Assigned" : "Not assigned", row.teacher ? "positive" : "negative"),
          text(String(row.takers)),
          { kind: "action", label: row.teacher ? "Edit" : "Assign", drawer },
        ],
        drawer,
        keywords: `|${row.level}| armid:${row.classId}| ${row.department ?? ""} ${row.teacher ? "state:has" : "state:none"}`,
      };
    });

  const teacherRows: TableRow[] = teaching.teachers
    .slice()
    .sort((a, b) => b.periods - a.periods)
    .map((teacher) => ({
      id: teacher.id,
      cells: [
        nameCell(teacher.name, teacher.designation ?? teacher.department ?? ""),
        text(teacher.department ?? "—"),
        text(String(teacher.subjects.length)),
        text(teacher.arms.length ? teacher.arms.slice(0, 4).join(", ") + (teacher.arms.length > 4 ? ` +${teacher.arms.length - 4}` : "") : "—"),
        text(String(teacher.periods)),
        text(teacher.load, {
          tone: teacher.load === "Over the ceiling" ? "negative" : teacher.load === "Under-loaded" || teacher.load === "No assignment" ? "attention" : undefined,
          strong: teacher.load === "Over the ceiling",
        }),
        { kind: "action", label: "View", href: `/class-timetable/subjects/teacher/${teacher.id}` },
      ],
      href: `/class-timetable/subjects/teacher/${teacher.id}`,
      keywords: `${teacher.staffNo ?? ""} ${teacher.subjects.join(" ")}`,
    }));

  const withArms = overview.arms.filter((arm) => arm.subjects > 0 && arm.roll > 0).slice(0, 5);

  return {
    title: "Subjects",
    desc: "What each class offers and what each student takes.",
    primary: { label: "Register subjects", drawer: register },
    launchers: [
      { label: "Add a subject", drawer: addSubject },
      { label: "Map a subject to a teacher", drawer: mapAny },
    ],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            per: 4,
            cards: [
              { label: "Subjects in catalogue", value: String(teaching.subjectCount), sub: `${plural(rows.length, "subject-arm")} offered across ${plural(new Set(rows.map((row) => row.classId)).size, "arm")}` },
              { label: "Choice groups", value: "—", sub: "Not recorded — registration rules are not stored yet" },
              {
                label: "Invalid combinations",
                value: String(invalid.length),
                sub: "Named by student and rule broken",
                tone: invalid.length ? "negative" : "positive",
              },
              {
                label: "Not counted to average",
                value: String(notCounted.length),
                sub: notCounted.length ? notCounted.slice(0, 2).join(", ") : "Every subject counts",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          invalid.length
            ? {
                type: "blockers",
                title: "Invalid subject combinations",
                tag: plural(invalid.length, "student"),
                tagTone: "negative",
                acts: [{ label: "Export list", export: true }],
                items: invalid.map((item) => ({
                  title: `${item.student} · ${item.arm}`,
                  detail: item.detail,
                  action: "Fix registration",
                  href: "/student-records/registry",
                })),
              }
            : {
                type: "note",
                tone: "positive",
                title: "No registration breaks a stream rule",
                body: "A subject restricted to one stream is taken only by students in it. Minimum and maximum subject counts are not checked, because the school has not recorded them.",
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Subject catalogue",
            tag: unstaffed.length ? `${unstaffed.length} unassigned` : "All assigned",
            tagTone: unstaffed.length ? "negative" : "positive",
            sub: "Filter to a class to see exactly what its arms offer and who teaches it.",
            meta: `${plural(teaching.subjectCount, "subject")} · ${plural(rows.length, "subject-arm")} · ${unstaffed.length} with no teacher`,
            search: "Find a subject by name, code, category or teacher",
            noun: "subject",
            nounPlural: "subjects",
            acts: [
              ...(unstaffed.length ? [{ label: `Assign the ${unstaffed.length} uncovered`, drawer: mapDrawer }] : []),
              { label: "Add subject", primary: true, drawer: addSubject },
            ],
            filters: [
              {
                label: "Class",
                value: "All classes",
                options: ["All classes", ...levelNames],
                match: Object.fromEntries(levelNames.map((levelName) => [levelName, `|${levelName}|`])),
              },
              {
                label: "Arm",
                value: "All arms",
                options: ["All arms", ...armsWithSubjects.map(([, label]) => label)],
                match: Object.fromEntries(armsWithSubjects.map(([id, label]) => [label, `armid:${id}|`])),
              },
              {
                label: "Teacher",
                value: "All",
                options: ["All", "Assigned", "Not assigned"],
                match: { Assigned: "state:has", "Not assigned": "state:none" },
              },
              { label: "Category", value: "All categories", options: ["All categories", ...categories], column: 2 },
            ],
            selectable: true,
            bulkActs: [
              { label: "Assign a teacher to all", drawer: bulkAssignDrawer(teaching), selection: { key: "mappingIds", noun: "subject-arm" } },
              { label: "Change the offering", drawer: bulkOfferingDrawer(), selection: { key: "mappingIds", noun: "subject-arm" } },
              { label: "Export selected", primary: true, export: true },
            ],
            head: ["Subject", "Code", "Category", "Arm", "Teacher", "Teacher state", "Takers", ""],
            rows: catalogueRows,
            per: 8,
            empty: "No subject matches this filter.",
            foot: "Teacher state says plainly whether a subject-arm has anybody to teach it. Assign from the row, or from the subject’s own modal.",
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Teachers and what they teach",
            sub: "Open a teacher to see every subject-arm they hold, and to change any of them.",
            meta: `${plural(teaching.teachers.length, "teaching staff", "teaching staff")} · ${rows.length - unstaffed.length} of ${rows.length} subject-arms covered`,
            search: "Find a teacher by name or department",
            noun: "teacher",
            nounPlural: "teachers",
            filters: [
              { label: "Department", value: "All departments", options: ["All departments", ...departments], column: 1 },
              { label: "Load", value: "All", options: ["All", "Over the ceiling", "Under-loaded", "Within range", "At the ceiling"], column: 5 },
            ],
            acts: [
              { label: "Export", export: true },
              { label: "Map a subject to a teacher", primary: true, drawer: mapAny },
            ],
            head: ["Teacher", "Department", "Subjects", "Arms taught", "Periods", "Load", ""],
            rows: teacherRows,
            per: 8,
            empty: "No teacher matches this filter.",
            foot: `The ceiling is ${teaching.schoolCeiling} periods a week. A mapping always names the exact arm — never just the subject.`,
          },
        ],
      },
      {
        cols: "1.1fr 1fr",
        panels: [
          {
            type: "facts",
            title: "Registration rules in force",
            sub: "What is enforced when a student is registered for subjects.",
            per: 2,
            facts: [
              ["Stream restriction", "Enforced", "A student cannot be registered for a subject restricted to another stream"],
              ["Minimum at Senior Secondary", "Not recorded", "Subject counts are not stored, so they are not checked"],
              ["Maximum at Senior Secondary", "Not recorded"],
              ["Trade choice group", "Not recorded"],
              ["Language choice group", "Not recorded"],
              ["Carried forward", "Not recorded"],
            ] satisfies PanelFact[],
          },
          {
            type: "list",
            title: "Bulk registration",
            sub: "The common case is a whole arm taking the same offering.",
            readOnly: true,
            items: withArms.length
              ? withArms.map((arm) => ({
                  label: `${arm.name} — ${plural(arm.roll, "student")} take the ${arm.subjects} subjects it offers`,
                  sub: arm.uncoveredSubjects
                    ? `${arm.uncoveredSubjects} of them have no teacher yet, so no scores can exist`
                    : "Every subject has a teacher",
                  pill: arm.uncoveredSubjects ? "Partial" : "Ready",
                  tone: arm.uncoveredSubjects ? ("attention" as PanelTone) : ("positive" as PanelTone),
                }))
              : [{ label: "No arm has subjects and students yet", sub: "Offer subjects to an arm first", pill: "Not started", tone: "attention" as PanelTone }],
          },
        ],
      },
    ],
  };
}

/* ───────────────────────────── Teaching ───────────────────────────── */

type SchemeRow = {
  id: string;
  status: string;
  subjectName: string;
  subjectCode: string | null;
  className: string;
  departmentName: string | null;
  teacherName: string | null;
  totalWeeks: number;
  coveredWeeks: number;
  teachingWeeks: number;
  coveragePercent: number;
};

function coverageTone(value: number): PanelTone {
  if (value >= 75) return "positive";
  if (value >= 40) return "attention";
  return "negative";
}

function loadTone(teacher: TeacherLoad): PanelTone {
  if (teacher.load === "Over the ceiling") return "negative";
  if (teacher.load === "At the ceiling" || teacher.load === "Under-loaded") return "attention";
  return "positive";
}

/** One arm's day from the running timetable, as table rows. */
function dayRows(detail: TimetableDetail, armId: string, day: number): TableRow[] {
  const cells = detail.grid[armId] ?? {};
  const arm = detail.arms.find((item) => item.id === armId);
  return detail.periods.map((period) => {
    if (period.n === "break") {
      return {
        cells: [text("—"), text(`${period.start}–${period.end}`), text("Break", { tone: "neutral" }), text("—"), text("—")],
      };
    }
    const cell = cells[`${day}|${period.n}`];
    const subject = cell ? (detail.subjects[armId] ?? []).find((item) => item.subjectId === cell.subjectId) : undefined;
    return {
      cells: [
        text(String(period.n), { strong: true }),
        text(`${period.start}–${period.end}`),
        text(subject?.name ?? (cell ? "A subject" : "Free")),
        text(subject?.teacher ?? "—"),
        text(cell ? arm?.room ?? "—" : "—"),
      ],
    };
  });
}

/** The school day an arm has most lessons on, so a sample day is never an empty one. */
function busiestDay(detail: TimetableDetail, armId: string): number {
  const counts = new Map<number, number>();
  for (const key of Object.keys(detail.grid[armId] ?? {})) {
    const day = Number(key.split("|")[0]);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const best = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  return best?.[0] ?? 1;
}

async function runningDetail(list: TimetableList): Promise<TimetableDetail | null> {
  const running = list.versions.find((version) => version.state === "RUNNING");
  if (!running) return null;
  return loadTimetable(running.id).catch(() => null);
}

async function teachingTab(teaching: Teaching, overview: Overview, list: TimetableList): Promise<TabContent> {
  const rows = teaching.subjectArms;
  const unstaffed = rows.filter((row) => !row.teacher);
  const over = teaching.teachers.filter((teacher) => teacher.periods > teacher.ceiling);
  const under = teaching.teachers.filter((teacher) => teacher.load === "Under-loaded");
  const drafts = list.versions.filter((version) => version.state === "DRAFT");
  const mapDrawer = mapSubjectDrawer(teaching, overview.arms, {
    subjectId: unstaffed[0]?.subjectId,
    armIds: unstaffed[0] ? [unstaffed[0].classId] : [],
  });
  const levelNames = Array.from(new Set(rows.map((row) => row.level)));
  const armsHere = Array.from(new Map(rows.map((row) => [row.classId, row.arm])).entries());

  const assignments: TableRow[] = rows
    .slice()
    .sort((a, b) => Number(Boolean(a.teacher)) - Number(Boolean(b.teacher)) || a.levelOrder - b.levelOrder || a.subject.localeCompare(b.subject))
    .map((row) => {
      const drawer = subjectArmDrawer(row, teaching.teachers);
      return {
        id: row.id,
        cells: [
          text(row.subject, { strong: true }),
          text(row.arm),
          row.teacher
            ? nameCell(row.teacher.name, row.teacher.department ?? row.department ?? "")
            : text(`Unassigned · ${row.daysUnassigned} days`, { tone: "negative", strong: true }),
          row.assistant ? nameCell(row.assistant.name, "Second teacher") : text("—"),
          text(String(row.periods)),
          pill(row.teacher ? "Assigned" : "Unassigned", row.teacher ? "positive" : "negative"),
          { kind: "action", label: row.teacher ? "Edit" : "Assign", drawer },
        ],
        drawer,
        keywords: `|${row.level}| armid:${row.classId}| ${row.teacher ? "state:has" : "state:none"}`,
      };
    });

  const detail = await runningDetail(list);
  const firstArm = detail ? detail.arms.find((arm) => Object.keys(detail.grid[arm.id] ?? {}).length > 0) : undefined;
  const day = detail && firstArm ? busiestDay(detail, firstArm.id) : 1;

  const bars = teaching.teachers
    .filter((teacher) => teacher.periods > 0)
    .sort((a, b) => b.periods - a.periods)
    .slice(0, 8)
    .map((teacher) => ({
      label: teacher.name,
      value: Math.min(100, percent(teacher.periods, teacher.ceiling)),
      display: `${teacher.periods} of ${teacher.ceiling}`,
      sub:
        teacher.periods > teacher.ceiling
          ? `${teacher.periods - teacher.ceiling} periods above ${teacher.raised ? "their raised" : "the school"} ceiling`
          : teacher.periods === teacher.ceiling
            ? "At the ceiling exactly"
            : teacher.load === "Under-loaded"
              ? `Capacity for ${Math.max(1, Math.floor((teacher.ceiling - teacher.periods) / 4))} more subject-arms`
              : undefined,
      tone: loadTone(teacher),
    }));

  const schemes = await apiGet<SchemeRow[]>("/api/v1/scheme-of-work").catch(() => [] as SchemeRow[]);
  const coveredWeeks = schemes.reduce((sum, row) => sum + row.coveredWeeks, 0);
  const teachingWeeks = schemes.reduce((sum, row) => sum + row.teachingWeeks, 0);

  return {
    title: "Teaching",
    desc: "Who teaches what, to whom — and whether anything is uncovered.",
    primary: unstaffed.length ? { label: `Assign the ${unstaffed.length} uncovered`, drawer: mapDrawer } : undefined,
    launchers: [{ label: "Open the timetable", href: "/class-timetable/timetable" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            per: 5,
            cards: [
              { label: "Subject-arms", value: String(rows.length), sub: `Across ${plural(new Set(rows.map((row) => row.classId)).size, "arm")}` },
              {
                label: "Assigned",
                value: String(rows.length - unstaffed.length),
                unit: `of ${rows.length}`,
                sub: "Primary teacher named",
                tone: unstaffed.length ? "attention" : "positive",
              },
              {
                label: "Unassigned",
                value: String(unstaffed.length),
                sub: unstaffed.length
                  ? Array.from(new Set(unstaffed.map((row) => `${row.subject} ${row.arm}`))).slice(0, 2).join(" and ") + (unstaffed.length > 2 ? " and more" : "")
                  : "Nothing is uncovered",
                tone: unstaffed.length ? "negative" : "positive",
              },
              {
                label: "Load outside ceiling",
                value: String(over.length + under.length),
                sub: `${over.length} above ${teaching.schoolCeiling} periods · ${under.length} far below`,
                tone: over.length ? "attention" : under.length ? "attention" : "positive",
              },
              {
                label: "Timetables in draft",
                value: String(drafts.length),
                sub: drafts.length ? drafts.slice(0, 2).map((draft) => draft.name).join(" and ") : "Nothing waiting to be published",
                tone: drafts.length ? "attention" : "positive",
                link: "Open timetables",
                href: "/class-timetable/timetable",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Assignments · subject × arm",
            tag: unstaffed.length ? `${unstaffed.length} unassigned` : "All assigned",
            tagTone: unstaffed.length ? "negative" : "positive",
            sub: "Unassigned combinations carry the days since the term began.",
            meta: `${plural(rows.length, "subject-arm")} · ${rows.length - unstaffed.length} assigned`,
            search: "Find by subject, arm or teacher",
            noun: "subject-arm",
            nounPlural: "subject-arms",
            filters: [
              {
                label: "Arm",
                value: "All",
                options: ["All", ...armsHere.map(([, label]) => label)],
                match: Object.fromEntries(armsHere.map(([id, label]) => [label, `armid:${id}|`])),
              },
              {
                label: "Level",
                value: "All",
                options: ["All", ...levelNames],
                match: Object.fromEntries(levelNames.map((levelName) => [levelName, `|${levelName}|`])),
              },
              {
                label: "State",
                value: "All",
                options: ["All", "Assigned", "Unassigned"],
                match: { Assigned: "state:has", Unassigned: "state:none" },
              },
            ],
            selectable: true,
            bulkActs: [
              { label: "Bulk assign teacher", drawer: bulkAssignDrawer(teaching), selection: { key: "mappingIds", noun: "subject-arm" } },
              { label: "Export selected", primary: true, export: true },
            ],
            head: ["Subject", "Arm", "Primary teacher", "Assistant", "Periods", "State", "Edit"],
            rows: assignments,
            per: 8,
            empty: "No subject-arm matches this filter.",
          },
        ],
      },
      {
        cols: "1.15fr 1fr",
        panels: [
          detail && firstArm
            ? {
                type: "table",
                title: `Schedule · ${firstArm.name}, ${dayLabel(day)}`,
                sub: "From the running timetable.",
                meta: `${detail.periods.filter((period) => period.n !== "break").length} periods · ${detail.clashes.length ? plural(detail.clashes.length, "clash", "clashes") : "no unresolved clashes"}`,
                head: ["Period", "Time", "Subject", "Teacher", "Venue"],
                rows: dayRows(detail, firstArm.id, day),
                noun: "period",
                nounPlural: "periods",
              }
            : {
                type: "note",
                tone: "attention",
                title: "No timetable is running",
                body: "A day's schedule appears here once a timetable has been published. Build one in the Timetable tab.",
                acts: [{ label: "Open the timetable", href: "/class-timetable/timetable" }],
              },
          {
            type: "bars",
            title: `Teaching load · ceiling ${teaching.schoolCeiling} periods`,
            sub: `The school ceiling is ${teaching.schoolCeiling} periods a week; heaviest first.`,
            rows: bars,
          },
        ],
      },
      ...(schemes.length
        ? [
            {
              cols: "1fr",
              panels: [
                {
                  type: "table" as const,
                  title: "Schemes of work",
                  sub: "What each class is meant to be taught, and how much of it has been — least covered first.",
                  meta: `${plural(schemes.length, "scheme")} · ${percent(coveredWeeks, teachingWeeks)}% covered`,
                  head: ["Subject", "Class", "Teacher", "Covered", "Coverage", "Status"],
                  per: 8,
                  noun: "scheme",
                  nounPlural: "schemes",
                  search: "Find a scheme by subject, class or teacher",
                  rows: schemes
                    .slice()
                    .sort((a, b) => a.coveragePercent - b.coveragePercent)
                    .map((row) => ({
                      cells: [
                        nameCell(row.subjectName, row.subjectCode ?? row.departmentName ?? ""),
                        text(row.className),
                        text(row.teacherName ?? "none", { tone: row.teacherName ? undefined : "negative", strong: !row.teacherName }),
                        text(`${row.coveredWeeks}/${row.teachingWeeks}`),
                        text(`${row.coveragePercent}%`, { tone: coverageTone(row.coveragePercent), strong: true }),
                        pill(
                          row.status.replace(/_/g, " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase()),
                          row.status.toUpperCase() === "APPROVED" ? "positive" : row.status.toUpperCase() === "RETURNED" ? "negative" : "attention",
                        ),
                      ],
                      keywords: `${row.subjectName} ${row.className} ${row.teacherName ?? ""}`,
                    })),
                },
              ],
            },
          ]
        : []),
    ],
  };
}

/* ───────────────────────────── Timetable ───────────────────────────── */

const VERSION_STATE: Record<TimetableVersionRow["state"], { label: string; tone: PanelTone }> = {
  RUNNING: { label: "Running", tone: "positive" },
  DRAFT: { label: "Draft", tone: "progress" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
};

function publishFacts(entry: TimetableList["publishes"][number]): PanelFact[] {
  const detail = entry.detail as {
    version?: string;
    periodsMoved?: number;
    teachersTold?: number;
    arms?: number;
    note?: string;
    state?: string;
    saturdayNotPublished?: boolean;
  };
  const when = new Date(entry.at).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  if (entry.action === "discard_version") {
    return [
      ["Timetable", detail.version ?? "A draft"],
      ["Discarded", when, `By ${entry.by || "someone"}`],
      ["Was", detail.state === "ARCHIVED" ? "Archived" : "A draft", `${detail.arms ?? 0} arms had periods in it`],
      ["Staff notified", "0", "Nothing was published"],
    ];
  }
  return [
    ["Timetable", detail.version ?? "A timetable"],
    ["Published", when, `By ${entry.by || "someone"}`],
    ["Arms covered", String(detail.arms ?? 0)],
    ["Periods moved", String(detail.periodsMoved ?? 0), "Compared with the week that was running"],
    ["Teachers whose week changed", String(detail.teachersTold ?? 0)],
    ...(detail.note ? ([["Note to staff", detail.note]] as PanelFact[]) : []),
    ...(detail.saturdayNotPublished ? ([["Saturday", "Not published", "Only Monday to Friday are written to the live week"]] as PanelFact[]) : []),
    ["Reversible", "Yes", "Publish the archived version again — it replaces this one"],
  ];
}

async function timetableTab(list: TimetableList, overview: Overview): Promise<TabContent> {
  const terms = await loadTermChoices();
  const running = list.versions.find((version) => version.state === "RUNNING");
  const drafts = list.versions.filter((version) => version.state === "DRAFT");
  const detail = await runningDetail(list);
  const newDrawer = newTimetableDrawer(list, terms);
  const publishDrawer = publishTimetableDrawer(list, list.totals.clashes);
  const previewHref = running ? `/class-timetable/timetable/${running.id}` : undefined;

  const versionRows: TableRow[] = list.versions.map((version) => {
    const base = VERSION_STATE[version.state];
    const state =
      version.state === "DRAFT" && version.scheduledFor
        ? { label: `Scheduled · ${dateLabel(version.scheduledFor)}`, tone: "attention" as PanelTone }
        : base;
    return {
      cells: [
        nameCell(version.name, version.note ?? `${version.term ?? "No term"} · ${version.periodsPerDay} periods a day`),
        text(version.term ?? "—"),
        pill(state.label, state.tone),
        text(String(version.arms)),
        text(version.builtBy),
        text(dateLabel(version.updatedAt)),
        { kind: "action", label: "Preview", href: `/class-timetable/timetable/${version.id}` },
        { kind: "action", label: "Edit", href: `/class-timetable/timetable/${version.id}/build` },
      ],
      href: `/class-timetable/timetable/${version.id}`,
      keywords: `${version.builtBy}`,
    };
  });

  const termNames = Array.from(new Set(list.versions.map((version) => version.term).filter((value): value is string => Boolean(value))));

  const levelNames = overview.classes.map((level) => level.name);
  const byArm: TableRow[] = detail
    ? overview.arms
        .filter((arm) => detail.arms.some((item) => item.id === arm.id))
        .sort((a, b) => Object.keys(detail.grid[b.id] ?? {}).length - Object.keys(detail.grid[a.id] ?? {}).length)
        .map((arm) => {
          const placed = Object.keys(detail.grid[arm.id] ?? {}).length;
          const full = detail.version.schoolDays.length * detail.periods.filter((period) => period.n !== "break").length;
          const level = overview.classes.find((item) => item.id === arm.levelId);
          const subjects = (detail.subjects[arm.id] ?? []).length;
          return {
            cells: [
              text(arm.name, { strong: true }),
              text(level?.name ?? "—"),
              arm.formMaster ? nameCell(arm.formMaster.name, "Form master") : text("Nobody named", { tone: "negative", strong: true }),
              text(String(placed), { tone: placed === 0 ? "negative" : undefined }),
              text(String(subjects)),
              text(arm.room ?? "—"),
              { kind: "action", label: "View week", href: `/class-timetable/timetable/${running?.id}?arm=${arm.id}` },
            ],
            href: `/class-timetable/timetable/${running?.id}?arm=${arm.id}`,
            keywords: `|${level?.name ?? ""}| arm:${arm.arm}| ${placed >= full ? "week:full" : "week:short"}`,
          };
        })
    : [];

  const firstArm = detail ? detail.arms.find((arm) => Object.keys(detail.grid[arm.id] ?? {}).length > 0) : undefined;
  const day = detail && firstArm ? busiestDay(detail, firstArm.id) : 1;

  const publishItems: ListItem[] = list.publishes.map((entry) => {
    const info = entry.detail as { version?: string; periodsMoved?: number; teachersTold?: number; arms?: number };
    const discarded = entry.action === "discard_version";
    return {
      label: discarded
        ? `${info.version ?? "A draft"} discarded before publishing`
        : `${info.version ?? "A timetable"} published — ${plural(info.periodsMoved ?? 0, "period")} moved`,
      sub: `${dateLabel(entry.at)} by ${entry.by || "someone"} · ${discarded ? "nothing was sent" : `${plural(info.teachersTold ?? 0, "teacher")} told`}`,
      pill: discarded ? "Cancelled" : "Complete",
      tone: discarded ? "attention" : "positive",
      viewLabel: "View",
      facts: publishFacts(entry),
    };
  });

  return {
    title: "Timetable",
    desc: "Every timetable built, and which one is running.",
    primary: { label: "New timetable", drawer: newDrawer },
    launchers: [
      ...(previewHref ? [{ label: "Preview the running timetable", href: previewHref }] : []),
      { label: "Publish a timetable", drawer: publishDrawer },
    ],
    rows: [
      {
        cols: "1fr",
        panels: [
          running
            ? {
                type: "note",
                tone: "positive",
                icon: "M5 12.5l4.5 4.5 9-10",
                title: `Running now · ${running.name}`,
                body: `${running.publishedAt ? `Published ${dateLong(running.publishedAt)}. ` : ""}${plural(list.totals.liveArms, "arm")} on it, ${running.periodsPerDay} periods a day, ${list.totals.clashes ? plural(list.totals.clashes, "unresolved clash", "unresolved clashes") : "no unresolved clashes"}.`,
                acts: [
                  ...(previewHref ? [{ label: "Preview it", href: previewHref }] : []),
                  { label: "Publish a different one", drawer: publishDrawer },
                ],
              }
            : {
                type: "note",
                tone: "attention",
                title: "No timetable is running",
                body: "Families and teachers see no timetable until one is published. Start a draft, build the week, and publish it.",
                acts: [{ label: "New timetable", drawer: newDrawer }],
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "Timetables",
            per: 4,
            cards: [
              {
                label: "Running",
                value: running ? "1" : "0",
                sub: running ? `${running.name}${running.publishedAt ? ` · published ${dateLabel(running.publishedAt)}` : ""}` : "Nothing is published",
                tone: running ? "positive" : "negative",
                ...(previewHref ? { link: "Preview it", href: previewHref } : {}),
              },
              {
                label: "In draft",
                value: String(drafts.length),
                sub: drafts.length ? drafts.slice(0, 2).map((draft) => draft.name).join(" and ") : "Nothing waiting",
                tone: drafts.length ? "progress" : undefined,
              },
              {
                label: "Arms covered",
                value: String(list.totals.liveArms),
                unit: `of ${list.totals.arms}`,
                sub: list.totals.liveArms === list.totals.arms ? "Every arm has periods on the running version" : "The rest have no week families can see",
                tone: list.totals.liveArms === list.totals.arms && list.totals.arms > 0 ? "positive" : "attention",
              },
              {
                label: "Unresolved clashes",
                value: String(list.totals.clashes),
                sub: "A teacher in two arms in one period, on the running week",
                tone: list.totals.clashes ? "negative" : "positive",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "All timetables",
            sub: "The running one is marked. Open any to preview, edit, publish or delete.",
            meta: `${plural(list.versions.length, "timetable")} · ${running ? 1 : 0} running`,
            noun: "timetable",
            nounPlural: "timetables",
            search: "Find a timetable by name, term or who built it",
            filters: [
              { label: "Term", value: "All terms", options: ["All terms", ...termNames], column: 1 },
              { label: "State", value: "All", options: ["All", "Running", "Draft", "Scheduled", "Archived"], column: 2 },
            ],
            acts: [
              { label: "Publish a timetable", drawer: publishDrawer },
              { label: "New timetable", primary: true, drawer: newDrawer },
            ],
            head: ["Timetable", "Term", "State", "Arms", "Built by", "Last edited", "", ""],
            rows: versionRows,
            per: 8,
            empty: "No timetable has been built yet. Start one with New timetable.",
            foot: "Publishing never silently replaces the running timetable: the one it replaces is archived and can be published again.",
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          detail
            ? {
                type: "table",
                title: "What is running, by arm",
                sub: "Choose an arm to see the week it is actually on.",
                meta: `${running?.name} · ${plural(list.totals.liveArms, "arm")} on it`,
                noun: "arm",
                nounPlural: "arms",
                search: "Find an arm or a form master",
                filters: [
                  {
                    label: "Arm",
                    value: "All",
                    options: ["All", ...Array.from(new Set(overview.arms.map((arm) => arm.arm)))],
                    match: Object.fromEntries(Array.from(new Set(overview.arms.map((arm) => arm.arm))).map((letter) => [letter, `arm:${letter}|`])),
                  },
                  {
                    label: "Class",
                    value: "All classes",
                    options: ["All classes", ...levelNames],
                    match: Object.fromEntries(levelNames.map((levelName) => [levelName, `|${levelName}|`])),
                  },
                  { label: "Periods", value: "All", options: ["All", "Full week", "Short week"], match: { "Full week": "week:full", "Short week": "week:short" } },
                ],
                acts: previewHref ? [{ label: "Preview the running week", primary: true, href: previewHref }] : [],
                head: ["Arm", "Class", "Form master", "Periods", "Subjects", "Venue base", ""],
                rows: byArm,
                per: 8,
                empty: "No arm matches this filter.",
                foot: "View week opens that arm’s own grid — the same one its teachers and guardians see.",
              }
            : {
                type: "note",
                tone: "attention",
                title: "No arm has a running week yet",
                body: "Once a timetable is published, each arm’s week is listed here with the form master who answers for it.",
              },
        ],
      },
      {
        cols: "1.15fr 1fr",
        panels: [
          detail && firstArm
            ? {
                type: "table",
                title: `Running timetable · ${firstArm.name}, ${dayLabel(day)}`,
                tag: running?.name,
                tagTone: "positive",
                sub: "A single arm’s day. Choose another arm or day from the preview.",
                meta: `${detail.periods.filter((period) => period.n !== "break").length} periods · ${detail.clashes.length ? plural(detail.clashes.length, "clash", "clashes") : "no clashes"}`,
                acts: previewHref ? [{ label: "Preview the full week", href: `${previewHref}?arm=${firstArm.id}` }] : [],
                head: ["Period", "Time", "Subject", "Teacher", "Venue"],
                rows: dayRows(detail, firstArm.id, day),
                noun: "period",
                nounPlural: "periods",
              }
            : {
                type: "note",
                tone: "neutral",
                title: "No day to show",
                body: "A single arm’s day appears here once a timetable with periods in it is running.",
              },
          {
            type: "list",
            title: "What changed, and who was told",
            sub: "Every publish leaves this behind.",
            meta: list.publishes.length ? `Last ${plural(list.publishes.length, "record")}` : undefined,
            readOnly: true,
            items: publishItems.length
              ? publishItems
              : [{ label: "Nothing has been published from here yet", sub: "A publish, and a draft thrown away, are both recorded", pill: "Empty" }],
          },
        ],
      },
    ],
  };
}

/* ───────────────────────────── Coverage ───────────────────────────── */

function coverageTab(data: Coverage, overview: Overview, teaching: Teaching): TabContent {
  const top = data.checks.find((check) => check.state !== "Complete");
  const cards = data.cards;
  return {
    title: "Coverage",
    desc: "Is this school actually ready to teach?",
    primary: top ? { label: "Fix the top gap", href: top.href, icon: "M5 12h13M13 6.5l5.5 5.5L13 17.5" } : undefined,
    launchers: [],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            per: 4,
            cards: [
              {
                label: "Subject-arms uncovered",
                value: String(cards.uncovered),
                sub: cards.uncoveredSub,
                tone: cards.uncovered ? "negative" : "positive",
                ...(cards.uncovered ? { link: "Assign teachers", href: "/class-timetable/teaching" } : {}),
              },
              {
                label: "Students with no arm",
                value: String(cards.noArm),
                sub: cards.noArm ? "Excluded from every register and result" : "Everyone is on a register",
                tone: cards.noArm ? "negative" : "positive",
                ...(cards.noArm ? { link: "Allocate", href: "/class-timetable/classes" } : {}),
              },
              {
                label: "Load outside ceiling",
                value: String(cards.overCeiling + cards.underLoaded),
                sub: `${cards.overCeiling} above ${teaching.schoolCeiling} periods · ${cards.underLoaded} far below`,
                tone: cards.overCeiling || cards.underLoaded ? "attention" : "positive",
                ...(cards.overCeiling || cards.underLoaded ? { link: "See loads", href: "/class-timetable/teaching" } : {}),
              },
              {
                label: "Timetables unpublished",
                value: String(cards.unpublishedArms),
                unit: `of ${Math.max(cards.timetabledArms, overview.arms.length)} arms`,
                sub: "Arms with periods placed that families cannot see",
                tone: cards.unpublishedArms ? "attention" : "positive",
                link: "Publish",
                href: "/class-timetable/timetable",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "tracker",
            title: "Coverage checks",
            meta: `${data.checks.length} checks${data.term ? ` · term day ${data.term.day}` : ""}`,
            noun: "checks clear",
            groups: ["By issue type", "By teacher", "By class", "By subject", "By owner"],
            groupRows: Object.fromEntries(
              Object.entries(data.groups).map(([group, checks]) => [
                group,
                checks.map((check) => ({
                  unit: check.unit,
                  sub: check.sub,
                  owner: check.owner,
                  role: check.role,
                  state: check.state,
                  age: check.age,
                  overdue: check.overdue,
                  href: check.href,
                  count: check.count,
                })),
              ]),
            ),
            clear: { title: "This school is ready to teach", body: "All eight coverage checks pass. Nothing is uncovered." },
            rows: data.checks.map((check) => ({
              unit: check.unit,
              sub: check.sub,
              owner: check.owner,
              role: check.role,
              state: check.state,
              age: check.age,
              overdue: check.overdue,
              href: check.href,
              count: check.count,
            })),
          },
        ],
      },
    ],
  };
}

/* ───────────────────────────── entry ───────────────────────────── */

export async function classTimetableLiveTab(tabSlug: string): Promise<TabContent | undefined> {
  if (tabSlug === "classes") {
    const [overview, teaching] = await Promise.all([loadOverview(), loadTeaching()]);
    return classesTab(overview, teaching);
  }

  if (tabSlug === "subjects") {
    const [teaching, overview] = await Promise.all([loadTeaching(), loadOverview()]);
    return subjectsTab(teaching, overview);
  }

  if (tabSlug === "teaching") {
    const [teaching, overview, list] = await Promise.all([loadTeaching(), loadOverview(), loadTimetables()]);
    return teachingTab(teaching, overview, list);
  }

  if (tabSlug === "timetable") {
    const [list, overview] = await Promise.all([loadTimetables(), loadOverview()]);
    return timetableTab(list, overview);
  }

  if (tabSlug === "lesson-notes") return lessonNotesTab();

  if (tabSlug === "coverage") {
    const [data, overview, teaching] = await Promise.all([loadCoverage(), loadOverview(), loadTeaching()]);
    return coverageTab(data, overview, teaching);
  }

  return undefined;
}

export { ceilingDrawer, mapSubjectDrawer, subjectArmDrawer };
