import { apiGet } from "@/lib/api/server";
import {
  name as nameCell,
  pill,
  text,
  type DrawerSpec,
  type KpiCard,
  type PanelTone,
  type TabContent,
  type TableRow,
} from "@/lib/modules/panels";

/**
 * M03 Class & Timetable, read from the classes and timetable APIs.
 *
 * Two tabs are wired. Classes comes from `GET /v1/classes`, which carries the
 * roll and the class teacher per arm. Timetable comes from
 * `GET /v1/timetable/classes`, which already counts each arm's slots — total,
 * lesson, filled and published — so how complete a timetable is does not have
 * to be worked out a class at a time.
 *
 * Subjects, Teaching and Coverage keep their authored content: the first two
 * need a subject-arm teaching assignment the schema does not hold yet, which is
 * the gap docs/command-center-data-map.md names as the weakest link.
 */

type ClassRow = {
  id: string;
  name: string;
  level: string;
  section: string | null;
  category: string | null;
  arm: string | null;
  capacity: number;
  room: string | null;
  studentCount: number;
  isActive: boolean;
  classTeacher: { id: string; name: string; email: string; phone: string | null } | null;
  assistantClassTeacher: { id: string; name: string } | null;
};

type TimetableRow = {
  id: string;
  name: string;
  level: string;
  category: string;
  classTeacherName: string | null;
  totalSlots: number;
  lessonSlots: number;
  filledSlots: number;
  publishedSlots: number;
  setupStatus: "empty" | "structure_only" | "draft" | "published";
};

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** Over capacity is the one state that has to read as a problem, not a colour. */
function fillTone(used: number, capacity: number): PanelTone {
  if (capacity === 0) return "neutral";
  if (used > capacity) return "negative";
  if (used >= capacity * 0.9) return "attention";
  return "positive";
}

function classDrawer(classRoom: ClassRow): DrawerSpec {
  const over = classRoom.studentCount > classRoom.capacity;

  return {
    kicker: classRoom.level,
    title: classRoom.name,
    sub: classRoom.classTeacher
      ? `${classRoom.classTeacher.name} · ${classRoom.studentCount} of ${classRoom.capacity}`
      : `No class teacher · ${classRoom.studentCount} of ${classRoom.capacity}`,
    tone: over ? "negative" : classRoom.classTeacher ? "neutral" : "attention",
    readOnly: true,
    readOnlyNote:
      "Who teaches an arm, and how many sit in it, are changed where they are set — this is the record as it stands.",
    facts: [
      ["Class and arm", classRoom.name],
      ["Level", classRoom.level],
      ["Section", classRoom.section ?? "—"],
      ["Room", classRoom.room ?? "Not assigned"],
      ["On the roll", String(classRoom.studentCount)],
      ["Capacity", String(classRoom.capacity)],
      [
        "Fill",
        `${percent(classRoom.studentCount, classRoom.capacity)}%`,
        over ? `${classRoom.studentCount - classRoom.capacity} over capacity` : undefined,
      ],
      ["Class teacher", classRoom.classTeacher?.name ?? "Nobody assigned"],
      ["Assistant", classRoom.assistantClassTeacher?.name ?? "—"],
      ["Contact", classRoom.classTeacher?.email ?? "—"],
      ["Active", classRoom.isActive ? "Yes" : "No"],
    ],
  };
}

function classesTab(classes: ClassRow[]): TabContent {
  const students = classes.reduce((sum, item) => sum + item.studentCount, 0);
  const seats = classes.reduce((sum, item) => sum + item.capacity, 0);
  const unstaffed = classes.filter((item) => !item.classTeacher);
  const over = classes.filter((item) => item.studentCount > item.capacity);

  const cards: KpiCard[] = [
    { label: "Class arms", value: String(classes.length), sub: "Across every level" },
    { label: "On the roll", value: String(students), sub: `${seats} seats provided` },
    {
      label: "Seats used",
      value: `${percent(students, seats)}%`,
      tone: fillTone(students, seats),
      sub: seats > students ? `${seats - students} spare` : "At or over capacity",
    },
    {
      label: "No class teacher",
      value: String(unstaffed.length),
      tone: unstaffed.length > 0 ? "attention" : "positive",
      sub: unstaffed.length ? "Nobody owns the register" : "Every arm is staffed",
    },
    {
      label: "Over capacity",
      value: String(over.length),
      tone: over.length > 0 ? "negative" : "positive",
      sub: over.length ? over.map((item) => item.name).slice(0, 3).join(", ") : "None",
    },
  ];

  const rows: TableRow[] = classes.map((classRoom) => ({
    cells: [
      nameCell(classRoom.name, classRoom.level),
      text(classRoom.classTeacher?.name ?? "Nobody assigned", {
        tone: classRoom.classTeacher ? "neutral" : "attention",
      }),
      text(`${classRoom.studentCount} / ${classRoom.capacity}`, {
        tone: fillTone(classRoom.studentCount, classRoom.capacity),
      }),
      text(`${percent(classRoom.studentCount, classRoom.capacity)}%`),
      text(classRoom.room ?? "—"),
      pill(classRoom.isActive ? "Active" : "Inactive", classRoom.isActive ? "positive" : "neutral"),
      { kind: "action" as const, label: "Open", drawer: classDrawer(classRoom) },
    ],
    drawer: classDrawer(classRoom),
    keywords: `${classRoom.level} ${classRoom.classTeacher?.name ?? ""} ${classRoom.room ?? ""}`,
  }));

  return {
    title: "Classes",
    desc: "Every arm this school runs, who owns its register, and how full it is.",
    launchers: [{ label: "Timetable", href: "/class-timetable/timetable" }],
    rows: [
      {
        cols: "1fr",
        panels: [{ type: "kpi", title: "How the school is divided", per: 5, cards }],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Every class arm",
            sub: classes.length
              ? `${classes.length} arm${classes.length === 1 ? "" : "s"}, in teaching order.`
              : "No class has been created yet.",
            head: ["Class", "Class teacher", "Roll", "Fill", "Room", "State", ""],
            rows,
            per: 10,
            empty: "No class matches this filter.",
          },
        ],
      },
    ],
  };
}

const SETUP_LABEL: Record<TimetableRow["setupStatus"], { label: string; tone: PanelTone }> = {
  empty: { label: "No timetable", tone: "negative" },
  structure_only: { label: "Periods only", tone: "negative" },
  draft: { label: "Draft", tone: "attention" },
  published: { label: "Published", tone: "positive" },
};

/**
 * Publishing is the command this tab exists for, and it is the one the API
 * refuses when a lesson slot is still empty — so the drawer offers it even on a
 * draft arm and lets that refusal come back, rather than hiding the button and
 * leaving somebody to guess why.
 */
function timetableDrawer(entry: TimetableRow): DrawerSpec {
  const state = SETUP_LABEL[entry.setupStatus];
  const published = entry.setupStatus === "published";

  return {
    kicker: entry.level,
    title: entry.name,
    sub: `${state.label} · ${entry.filledSlots} of ${entry.lessonSlots} lessons filled`,
    tone: state.tone,
    facts: [
      ["Class and arm", entry.name],
      ["Class teacher", entry.classTeacherName ?? "Nobody assigned"],
      ["State", state.label],
      ["Periods in the week", String(entry.totalSlots)],
      ["Teaching periods", String(entry.lessonSlots)],
      [
        "Filled",
        `${entry.filledSlots} of ${entry.lessonSlots}`,
        // The API counts a free period as a teaching slot in this figure but
        // does not require one to carry a subject before publishing, so an arm
        // can read 0 of 70 here and still publish. Say "no subject", not
        // "unfilled", rather than implying work that may not be owed.
        entry.lessonSlots > entry.filledSlots
          ? `${entry.lessonSlots - entry.filledSlots} carry no subject, free periods included`
          : undefined,
      ],
      ["Published", `${entry.publishedSlots} of ${entry.lessonSlots}`],
    ],
    mode: "commit",
    commitLabel: published ? "Withdraw it" : "Publish this timetable",
    commitNote: published
      ? "Withdrawing takes it off the parent and student portals."
      : "Publishing puts it on the parent and student portals. A period still marked as a lesson must carry a subject first; free periods do not.",
    commitDone: published ? "Timetable withdrawn" : "Timetable published",
    commitDoneBody: published
      ? `${entry.name}'s timetable is no longer visible to families.`
      : `${entry.name}'s timetable is now on the portals.`,
    submit: {
      endpoint: `/api/v1/timetable/${entry.id}/publish`,
      method: "PATCH",
      body: { action: published ? "unpublish" : "publish" },
    },
  };
}

function timetableTab(entries: TimetableRow[]): TabContent {
  const published = entries.filter((entry) => entry.setupStatus === "published");
  const unstarted = entries.filter(
    (entry) => entry.setupStatus === "empty" || entry.setupStatus === "structure_only",
  );
  const lessons = entries.reduce((sum, entry) => sum + entry.lessonSlots, 0);
  const filled = entries.reduce((sum, entry) => sum + entry.filledSlots, 0);

  const cards: KpiCard[] = [
    { label: "Arms timetabled", value: String(entries.length), sub: "This term" },
    {
      label: "Published",
      value: `${published.length} of ${entries.length}`,
      tone: published.length === entries.length ? "positive" : "attention",
      sub: published.length === entries.length ? "All visible to families" : "The rest are not on the portals",
    },
    {
      label: "Lessons placed",
      value: `${percent(filled, lessons)}%`,
      tone: filled === lessons ? "positive" : "attention",
      sub: `${filled} of ${lessons} periods carry a subject`,
    },
    {
      label: "Not started",
      value: String(unstarted.length),
      tone: unstarted.length > 0 ? "negative" : "positive",
      sub: unstarted.length ? "No subject placed at all" : "Every arm has a draft",
    },
  ];

  const rows: TableRow[] = entries.map((entry) => {
    const state = SETUP_LABEL[entry.setupStatus];
    return {
      cells: [
        nameCell(entry.name, entry.classTeacherName ?? "No class teacher"),
        text(`${entry.filledSlots} / ${entry.lessonSlots}`, {
          tone: entry.filledSlots === entry.lessonSlots ? "positive" : "attention",
        }),
        text(`${percent(entry.filledSlots, entry.lessonSlots)}%`),
        text(String(entry.totalSlots)),
        pill(state.label, state.tone),
        { kind: "action" as const, label: "Open", drawer: timetableDrawer(entry) },
      ],
      drawer: timetableDrawer(entry),
      keywords: `${entry.level} ${entry.category} ${entry.classTeacherName ?? ""}`,
    };
  });

  return {
    title: "Timetable",
    desc: "How complete each arm's week is, and which of them families can already see.",
    launchers: [{ label: "Classes", href: "/class-timetable/classes" }],
    rows: [
      {
        cols: "1fr",
        panels: [{ type: "kpi", title: "Where the timetable stands", per: 4, cards }],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Every arm's week",
            sub: entries.length
              ? `${entries.length} arm${entries.length === 1 ? "" : "s"} with a timetable this term.`
              : "No timetable has been set up for this term.",
            head: ["Class", "Lessons filled", "Complete", "Periods", "State", ""],
            rows,
            per: 10,
            empty: "No arm matches this filter.",
          },
        ],
      },
    ],
  };
}


type SchemeRow = {
  id: string;
  status: string;
  submittedAt: string | null;
  approvedAt: string | null;
  subjectName: string;
  subjectCode: string | null;
  className: string;
  level: string | null;
  arm: string | null;
  departmentName: string | null;
  teacherName: string | null;
  totalWeeks: number;
  coveredWeeks: number;
  teachingWeeks: number;
  coveragePercent: number;
};

function coverageTone(percent: number): PanelTone {
  if (percent >= 75) return "positive";
  if (percent >= 40) return "attention";
  return "negative";
}

function schemeTone(status: string): PanelTone {
  switch (status.toUpperCase()) {
    case "APPROVED":
      return "positive";
    case "SUBMITTED":
      return "attention";
    case "RETURNED":
      return "negative";
    default:
      return "neutral";
  }
}

function schemeStatus(value: string): string {
  const words = value.replace(/_/g, " ").toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function schemeDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * M03 · Teaching, read from `GET /v1/scheme-of-work`.
 *
 * A scheme is the only record of what a class is *meant* to be taught, so the
 * tab reads coverage against it rather than against the timetable: a period
 * that ran teaches nothing if the topic it was for is still uncovered with
 * three weeks of term left.
 */
function teachingTab(rows: SchemeRow[]): TabContent {
  const approved = rows.filter((row) => row.status.toUpperCase() === "APPROVED");
  const unapproved = rows.filter((row) => row.status.toUpperCase() !== "APPROVED");
  const behind = rows.filter((row) => row.coveragePercent < 50);
  const teacherless = rows.filter((row) => !row.teacherName);
  const totalWeeks = rows.reduce((sum, row) => sum + row.teachingWeeks, 0);
  const coveredWeeks = rows.reduce((sum, row) => sum + row.coveredWeeks, 0);
  const overall = totalWeeks ? Math.round((coveredWeeks / totalWeeks) * 100) : 0;

  const departments = new Map<string, { covered: number; total: number }>();
  for (const row of rows) {
    const key = row.departmentName?.trim() || "Unassigned";
    const entry = departments.get(key) ?? { covered: 0, total: 0 };
    entry.covered += row.coveredWeeks;
    entry.total += row.teachingWeeks;
    departments.set(key, entry);
  }

  return {
    title: "Teaching",
    desc: "What each class is meant to be taught, and how much of it has been.",
    launchers: [{ label: "Timetable", href: "/class-timetable/timetable" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "Scheme of work coverage",
            per: 4,
            cards: [
              {
                label: "Schemes",
                value: String(rows.length),
                sub: `${approved.length} approved`,
                tone: unapproved.length ? "attention" : "positive",
              },
              {
                label: "Overall coverage",
                value: `${overall}%`,
                sub: `${coveredWeeks} of ${totalWeeks} teaching weeks`,
                tone: coverageTone(overall),
              },
              {
                label: "Behind halfway",
                value: String(behind.length),
                sub: behind.length ? "Under 50% covered" : "Nothing is behind",
                tone: behind.length ? "negative" : "positive",
              },
              {
                label: "No teacher named",
                value: String(teacherless.length),
                sub: teacherless.length ? "Nobody owns the scheme" : "Every scheme has an owner",
                tone: teacherless.length ? "negative" : "positive",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          unapproved.length
            ? {
                type: "note",
                tone: "attention",
                title: `${unapproved.length} scheme${unapproved.length === 1 ? "" : "s"} ${unapproved.length === 1 ? "is" : "are"} not approved`,
                body: "An unapproved scheme is being taught from anyway — the lessons happen on the timetable whether or not anybody signed the plan off. That is the gap between what was agreed and what is being delivered.",
              }
            : {
                type: "note",
                tone: "positive",
                title: "Every scheme has been approved",
                body: "What is being taught is what was signed off.",
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          rows.length
            ? {
                type: "table",
                title: "Schemes of work",
                sub: "Least covered first, because that is where the term runs out.",
                meta: `${rows.length} scheme${rows.length === 1 ? "" : "s"} · ${overall}% covered`,
                head: ["Subject", "Class", "Teacher", "Covered", "Coverage", "Status", ""],
                per: 12,
                rows: rows
                  .slice()
                  .sort((a, b) => a.coveragePercent - b.coveragePercent)
                  .map((row) => ({
                    cells: [
                      nameCell(row.subjectName, row.subjectCode ?? row.departmentName ?? ""),
                      text(row.className),
                      text(row.teacherName ?? "none", {
                        tone: row.teacherName ? undefined : "negative",
                        strong: !row.teacherName,
                      }),
                      text(`${row.coveredWeeks}/${row.teachingWeeks}`),
                      text(`${row.coveragePercent}%`, {
                        tone: coverageTone(row.coveragePercent),
                        strong: true,
                      }),
                      pill(schemeStatus(row.status), schemeTone(row.status)),
                      {
                        kind: "action" as const,
                        label: "View",
                        drawer: {
                          kicker: row.className,
                          title: row.subjectName,
                          sub: `${row.coveragePercent}% of ${row.teachingWeeks} teaching weeks covered`,
                          tone: coverageTone(row.coveragePercent),
                          readOnly: true,
                          facts: [
                            ["Subject", `${row.subjectName}${row.subjectCode ? ` (${row.subjectCode})` : ""}`],
                            ["Class", row.className],
                            ["Level", row.level ?? "—"],
                            ["Arm", row.arm ?? "—"],
                            ["Department", row.departmentName ?? "—"],
                            ["Teacher", row.teacherName ?? "none named"],
                            ["Weeks in the scheme", String(row.totalWeeks)],
                            ["Teaching weeks", String(row.teachingWeeks)],
                            ["Covered", String(row.coveredWeeks)],
                            ["Coverage", `${row.coveragePercent}%`],
                            ["Status", schemeStatus(row.status)],
                            ["Submitted", schemeDate(row.submittedAt)],
                            ["Approved", schemeDate(row.approvedAt)],
                          ],
                        },
                      },
                    ],
                    keywords: `${row.subjectName} ${row.className} ${row.teacherName ?? ""}`,
                  })),
              }
            : {
                type: "note",
                tone: "attention",
                title: "No scheme of work exists",
                body: "Without one there is no record of what a class is meant to be taught, so coverage cannot be measured at all.",
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "bars",
            title: "Coverage by department",
            sub: "Weakest first.",
            rows: Array.from(departments.entries())
              .map(([label, entry]) => ({
                label,
                value: entry.total ? Math.round((entry.covered / entry.total) * 100) : 0,
              }))
              .sort((a, b) => a.value - b.value)
              .map((entry) => ({
                label: entry.label,
                value: entry.value,
                display: `${entry.value}%`,
                tone: coverageTone(entry.value),
              })),
          },
        ],
      },
    ],
  };
}

export async function classTimetableLiveTab(
  tabSlug: string,
): Promise<TabContent | undefined> {
  if (tabSlug === "classes") {
    const payload = await apiGet<{ data: ClassRow[] }>("/api/v1/classes");
    return classesTab(payload?.data ?? []);
  }

  if (tabSlug === "timetable") {
    // This endpoint groups by category, which the page does not use — the table
    // is one list in teaching order, so flatten it back out.
    const payload = await apiGet<{ data: Record<string, TimetableRow[]> }>(
      "/api/v1/timetable/classes",
    );
    const entries = Object.values(payload?.data ?? {}).flat();
    return timetableTab(entries);
  }

  if (tabSlug === "teaching") {
    const schemes = await apiGet<SchemeRow[]>("/api/v1/scheme-of-work");
    return teachingTab(schemes ?? []);
  }

  // Subjects and Coverage stay authored. Subjects would repeat what M02's
  // Curriculum already reads off the same 88 records, and Coverage wants
  // period-level attendance against the timetable, which nothing records.
  return undefined;
}
