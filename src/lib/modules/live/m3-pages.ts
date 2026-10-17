import { apiGet } from "@/lib/api/server";
import {
  armEditDrawer,
  ceilingDrawer,
  mapSubjectDrawer,
  moveSelectedDrawer,
  moveStudentsDrawer,
  registerSubjectsDrawer,
  subjectArmDrawer,
} from "@/lib/modules/live/m3-forms";
import { loadOverview, loadTeaching, loadTimetables } from "@/lib/modules/live/m3-class-timetable";
import type { ArmDetail, StudentInArm } from "@/lib/modules/live/m3-types";
import {
  name as nameCell,
  pill,
  text,
  type PanelFact,
  type PanelTone,
  type TabContent,
  type TableRow,
} from "@/lib/modules/panels";

/**
 * The two pages Class & Timetable opens into: one arm, and one teacher.
 *
 * Both are read from the same endpoints as the tabs they open from — an arm page
 * that disagreed with the arms table above it is how a school stops trusting both.
 */

const BASE = "/api/v1/class-structure";

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const money = (value: number) => `₦${value.toLocaleString("en-NG")}`;

function since(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function seen(iso: string | null): string {
  if (!iso) return "Never signed in";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

const SCORE_TONE: Record<string, PanelTone> = {
  Approved: "positive",
  Submitted: "attention",
  "In progress": "progress",
  Returned: "negative",
  Unassigned: "negative",
  "Not started": "neutral",
  Published: "positive",
  "No result yet": "neutral",
};

function gradeTone(average: number | null): PanelTone {
  if (average === null) return "neutral";
  return average >= 65 ? "positive" : average >= 45 ? "attention" : "negative";
}

function standing(average: number | null): string {
  if (average === null) return "standing:blocked";
  return average >= 70 ? "standing:high" : average >= 50 ? "standing:mid" : "standing:low";
}

export async function armPage(armId: string): Promise<(TabContent & { heading: string }) | null> {
  const detail = await apiGet<ArmDetail>(`${BASE}/arms/${armId}`).catch(() => null);
  if (!detail) return null;
  const [overview, teaching] = await Promise.all([loadOverview(), loadTeaching()]);

  const over = detail.roll > detail.capacity;
  const uncovered = detail.subjects.filter((row) => !row.teacher);
  const roster = detail.roster;
  const marked = roster.filter((student) => student.attendance !== null);
  const attendance = marked.length
    ? Math.round((marked.reduce((sum, student) => sum + (student.attendance ?? 0), 0) / marked.length) * 10) / 10
    : null;
  const chronic = marked.filter((student) => (student.attendance ?? 100) < 75).length;
  const owing = roster.filter((student) => student.owes > 0);
  const master = detail.formMaster;
  const results = detail.results;

  const edit = armEditDrawer(detail, teaching.teachers);
  const mapDrawer = mapSubjectDrawer(teaching, overview.arms, {
    armIds: [detail.id],
    subjectId: uncovered[0]?.subjectId,
  });
  const register = registerSubjectsDrawer(teaching, overview.arms, [detail.id]);
  const moveOut = moveStudentsDrawer(detail, overview.arms);
  const moveSelected = moveSelectedDrawer(overview.arms, detail.id);

  const rosterRows: TableRow[] = roster.map((student) => ({
    id: student.id,
    cells: [
      nameCell(student.name, `${student.gender} · ${detail.name}`),
      text(student.admissionNumber, { mono: true }),
      text(student.gender),
      student.guardian
        ? nameCell(student.guardian, `${student.relationship ?? "Guardian"} · ${student.guardianPhone ?? "no phone"}`, { avatar: false })
        : text("No guardian on file", { tone: "attention" }),
      student.attendance === null
        ? text("Not marked")
        : text(`${student.attendance}%`, { mono: true, strong: true, tone: student.attendance < 75 ? "negative" : student.attendance < 92 ? "attention" : "positive" }),
      text(student.average === null ? "—" : String(student.average), { mono: true }),
      text(student.position === null ? "—" : String(student.position), { mono: true }),
      student.grade ? pill(student.grade, gradeTone(student.average)) : text("—"),
      student.owes > 0 ? pill(money(student.owes), "attention") : pill("Settled", "positive"),
      pill(student.resultState, SCORE_TONE[student.resultState] ?? "neutral"),
      { kind: "action", label: "Open", href: `/student-records/registry/${student.id}?from=arm&arm=${detail.id}` },
    ],
    href: `/student-records/registry/${student.id}?from=arm&arm=${detail.id}`,
    keywords: `${student.guardian ?? ""} fees:${student.owes > 0 ? "owing" : "settled"} att:${
      student.attendance === null ? "none" : student.attendance < 75 ? "low" : student.attendance < 92 ? "mid" : "high"
    } ${standing(student.average)} portal:${student.portal === "Active" ? "active" : "inactive"} gender:${student.gender.toLowerCase()}`,
  }));

  const subjectRows: TableRow[] = detail.subjects.map((row) => {
    const drawer = subjectArmDrawer(row, teaching.teachers);
    return {
      id: row.id,
      cells: [
        text(row.subject, { strong: true }),
        text(row.code, { mono: true }),
        text(row.category),
        row.teacher
          ? nameCell(row.teacher.name, `${row.teacher.department ?? row.department ?? "Teacher"}`)
          : text(`Nobody named · ${row.daysUnassigned} days`, { tone: "negative", strong: true }),
        text(String(row.periods)),
        text(String(row.takers)),
        text(row.scores.average === null ? "—" : String(row.scores.average), { mono: true }),
        pill(row.scores.state, SCORE_TONE[row.scores.state] ?? "neutral"),
        row.teacher
          ? { kind: "action", label: "Open", href: "/score-entry-results/review" }
          : { kind: "action", label: "Assign", drawer: mapSubjectDrawer(teaching, overview.arms, { armIds: [detail.id], subjectId: row.subjectId }) },
      ],
      drawer,
      keywords: `teacher:${row.teacher ? "assigned" : "unassigned"}`,
    };
  });

  const categories = Array.from(new Set(detail.subjects.map((row) => row.category)));

  const facts: PanelFact[] = master
    ? [
        ["Name", master.name, master.designation ?? "Form master"],
        ["Department", master.department ?? "—", master.subjects.length ? `Teaches ${master.subjects.slice(0, 4).join(", ")}${master.subjects.length > 4 ? "…" : ""}` : undefined],
        ["Phone", master.phone ?? "—", "Their login and their SMS number"],
        ["Email", master.email],
        ["Teaching load", `${master.periods} periods a week`, master.load],
        ["Other arms", master.otherArms.length ? master.otherArms.join(", ") : "This arm only"],
        ["Staff number", master.staffNo ?? "—", master.since ? `At this school since ${since(master.since)}` : undefined],
        ["Last seen", seen(master.lastSeen), "In the app"],
      ]
    : [["Name", "Nobody named", "This register has nobody marking it"]];

  const haveAverages = detail.siblings.some((sibling) => sibling.average !== null);
  const compare = detail.siblings
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((sibling) => {
      const here = sibling.id === detail.id;
      return haveAverages
        ? {
            label: `${sibling.name}${here ? " · this arm" : ""}`,
            value: Math.min(100, Math.round(sibling.average ?? 0)),
            display: sibling.average === null ? "No results" : String(sibling.average),
            tone: (here ? "progress" : "positive") as PanelTone,
          }
        : {
            label: `${sibling.name}${here ? " · this arm" : ""}`,
            value: Math.min(100, percent(sibling.roll, sibling.capacity)),
            display: `${sibling.roll} / ${sibling.capacity}`,
            tone: (sibling.roll > sibling.capacity ? "negative" : here ? "progress" : "positive") as PanelTone,
          };
    });

  return {
    heading: detail.name,
    title: detail.name,
    desc: `${detail.level}${detail.stream ? ` · ${detail.stream} stream` : ""} · ${plural(detail.roll, "student")} · form master ${master?.name ?? "not named"}.`,
    primary: { label: "Mark today’s register", href: "/attendance/mark", icon: "M5 12.5l4.5 4.5 9-10" },
    launchers: [
      { label: "Edit this arm", drawer: edit },
      { label: "Open the score review", href: "/score-entry-results/review" },
    ],
    rows: [
      ...(uncovered.length
        ? [
            {
              cols: "1fr",
              panels: [
                {
                  type: "note" as const,
                  tone: "negative" as PanelTone,
                  title: `${plural(uncovered.length, "subject")} in this arm ${uncovered.length === 1 ? "has" : "have"} no teacher`,
                  body: `${uncovered.map((row) => row.subject).join(", ")} — nobody can enter scores for ${uncovered.length === 1 ? "it" : "them"}, which blocks every report card in this arm.`,
                  acts: [
                    { label: "Assign a teacher", drawer: mapDrawer },
                    { label: "See the coverage gaps", href: "/class-timetable/coverage" },
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
            type: "kpi",
            title: "This arm this term",
            sub: detail.term ? `${detail.term.name} ${detail.term.session} · every figure is the one on the child’s own record.` : "No active term",
            per: 6,
            cards: [
              { label: "Roll", value: String(detail.roll), unit: `of ${detail.capacity}`, sub: over ? `Over capacity by ${detail.roll - detail.capacity}` : `${detail.capacity - detail.roll} places free`, tone: over ? "attention" : "positive" },
              {
                label: "Attendance",
                value: attendance === null ? "—" : `${attendance}%`,
                sub: attendance === null ? "No register marked this term" : "Target is 92%",
                tone: attendance === null ? "neutral" : attendance >= 92 ? "positive" : "attention",
                link: "Open the register history",
                href: "/attendance/log",
              },
              {
                label: "Term average",
                value: results.average === null ? "—" : String(results.average),
                unit: results.average === null ? undefined : "/ 100",
                sub: results.average === null ? "No result sheet yet" : `Pass rate ${results.passRate}% · top grade ${results.topGrade ?? "—"}`,
                tone: results.average === null ? "neutral" : results.average >= 65 ? "positive" : "attention",
              },
              { label: "Subjects", value: String(detail.subjects.length), sub: uncovered.length ? `${uncovered.length} with no teacher` : "All have a named teacher", tone: uncovered.length ? "negative" : "positive" },
              {
                label: "Fees outstanding",
                value: String(owing.length),
                unit: "families",
                sub: owing.length ? `${money(owing.reduce((sum, student) => sum + student.owes, 0))} unpaid` : "Everyone settled",
                tone: owing.length ? "attention" : "positive",
                link: owing.length ? "Open the debtor list" : undefined,
                href: owing.length ? "/fee-management/collections" : undefined,
              },
              { label: "Chronic absence", value: String(chronic), unit: "students", sub: "Below the 75% threshold", tone: chronic ? "negative" : "positive" },
            ],
          },
        ],
      },
      {
        cols: "1.25fr 1fr",
        panels: [
          {
            type: "facts",
            title: "Form master",
            tag: master ? "Named" : "Not named",
            tagTone: master ? "positive" : "negative",
            sub: "Responsible for the daily register, the remarks, and every guardian conversation about this arm.",
            meta: master?.staffNo ? `Staff number ${master.staffNo}${master.since ? ` · at this school since ${since(master.since)}` : ""}` : undefined,
            per: 2,
            acts: [
              { label: "Message them", href: "/communication-center/compose" },
              { label: "Change form master", drawer: edit },
              ...(master ? [{ label: "Open their staff record", primary: true, href: "/staff-access/directory" }] : []),
            ],
            facts,
          },
          {
            type: "list",
            title: "Subject teachers in this arm",
            sub: "Everyone who can enter a score against these children.",
            readOnly: true,
            items: detail.subjects.slice(0, 7).map((row) => ({
              label: row.teacher?.name ?? `Nobody named · ${row.subject}`,
              sub: `${row.subject} · ${row.category}${row.teacher ? "" : ` · ${row.daysUnassigned} days unassigned`}`,
              pill: row.teacher ? "Assigned" : "Unassigned",
              tone: (row.teacher ? "positive" : "negative") as PanelTone,
              viewLabel: row.teacher ? "Open" : "Assign",
              ...(row.teacher
                ? { href: `/class-timetable/subjects/teacher/${row.teacher.id}` }
                : { drawer: mapSubjectDrawer(teaching, overview.arms, { armIds: [detail.id], subjectId: row.subjectId }) }),
            })),
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: `Students in ${detail.name}`,
            tag: `${detail.roll} on the roll`,
            sub: "Every child registered against this arm. Open any one of them for their full record.",
            meta: `${plural(detail.roll, "student")} · ${chronic} below the attendance threshold · ${owing.length} with fees outstanding`,
            noun: "student",
            nounPlural: "students",
            search: "Find a student by name, admission number or guardian",
            filters: [
              { label: "Gender", value: "All", options: ["All", "Female", "Male"], match: { Female: "gender:female", Male: "gender:male" } },
              {
                label: "Attendance",
                value: "All",
                options: ["All", "Below 75%", "75–92%", "Above 92%"],
                match: { "Below 75%": "att:low", "75–92%": "att:mid", "Above 92%": "att:high" },
              },
              {
                label: "Standing",
                value: "All",
                options: ["All", "A1–B2", "B3–C6", "D7 and below", "Blocked"],
                match: { "A1–B2": "standing:high", "B3–C6": "standing:mid", "D7 and below": "standing:low", Blocked: "standing:blocked" },
              },
              { label: "Fees", value: "All", options: ["All", "Settled", "Outstanding"], match: { Settled: "fees:settled", Outstanding: "fees:owing" } },
              { label: "Portal", value: "All", options: ["All", "Active", "Not activated"], match: { Active: "portal:active", "Not activated": "portal:inactive" } },
            ],
            acts: [
              { label: "Export this roster", export: true },
              { label: "Move students out", drawer: moveOut },
              { label: "Add a student to this arm", primary: true, href: "/student-records/admissions" },
            ],
            selectable: true,
            bulkActs: [
              { label: "Message their guardians", href: "/communication-center/compose" },
              { label: "Move to another arm", drawer: moveSelected, selection: { key: "studentIds", noun: "student" } },
              { label: "Request consent", href: "/parents-guardians/consent" },
              { label: "Export selected", primary: true, export: true },
            ],
            head: ["Student", "Admission no", "Gender", "Guardian", "Att %", "Avg", "Pos", "Grade", "Fees", "State", ""],
            rows: rosterRows,
            per: 12,
            empty: "Nobody is on this arm’s roll.",
            foot: "A student with a blocked result is waiting on a score sheet, not on anything you can fix here.",
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: `Subjects taught in ${detail.name}`,
            tag: plural(detail.subjects.length, "subject"),
            sub: "Each subject, who teaches it here, and whether its scores are in.",
            meta: `${plural(detail.subjects.length, "subject")} · ${detail.subjects.length - uncovered.length} with a named teacher`,
            noun: "subject",
            nounPlural: "subjects",
            search: "Find a subject or teacher",
            filters: [
              { label: "Category", value: "All", options: ["All", ...categories], column: 2 },
              { label: "Teacher", value: "All", options: ["All", "Assigned", "Unassigned"], match: { Assigned: "teacher:assigned", Unassigned: "teacher:unassigned" } },
            ],
            acts: [{ label: "Register a subject for this arm", primary: true, drawer: register }],
            head: ["Subject", "Code", "Category", "Teacher", "Periods", "Takers", "Average", "Scores", ""],
            rows: subjectRows,
            per: 10,
            empty: "No subject is offered to this arm yet.",
            foot: "Opening a subject shows every child in this arm with all four components, their total, grade and position.",
          },
        ],
      },
      {
        cols: "1fr 1fr",
        panels: [
          {
            type: "bars",
            title: "How this arm compares",
            sub: haveAverages ? `Term average against the other arms in ${detail.level}.` : `How full each arm of ${detail.level} is — no results to compare yet.`,
            rows: compare,
          },
          {
            type: "list",
            title: "Recent activity in this arm",
            readOnly: true,
            sub: `Drawn from the audit log, scoped to ${detail.name}.`,
            items: detail.activity.length
              ? detail.activity.map((entry) => ({ label: entry.label, sub: entry.detail, pill: "Complete" }))
              : [{ label: "Nothing recorded on this arm yet", sub: "Edits and moves are listed here as they happen", pill: "Empty" }],
          },
        ],
      },
    ],
  } as TabContent & { heading: string };
}

export async function teacherPage(teacherId: string): Promise<(TabContent & { heading: string }) | null> {
  const [teaching, overview, timetables] = await Promise.all([loadTeaching(), loadOverview(), loadTimetables()]);
  const teacher = teaching.teachers.find((item) => item.id === teacherId);
  if (!teacher) return null;
  const running = timetables.versions.find((version) => version.state === "RUNNING");

  const mine = teaching.subjectArms.filter((row) => row.teacher?.id === teacher.id);
  const over = teacher.periods > teacher.ceiling;
  const students = mine.reduce((sum, row) => sum + row.takers, 0);
  const openings = teaching.subjectArms.filter(
    (row) => !row.teacher && (!teacher.department || row.department === teacher.department),
  );
  const mapDrawer = mapSubjectDrawer(teaching, overview.arms, { teacherId: teacher.id });
  const raise = ceilingDrawer(teacher, teaching.schoolCeiling);
  const subjectNames = Array.from(new Set(mine.map((row) => row.subject)));
  const arms = Array.from(new Set(mine.map((row) => row.arm)));

  const mappingRows: TableRow[] = mine.map((row) => {
    const drawer = subjectArmDrawer(row, teaching.teachers);
    return {
      id: row.id,
      cells: [
        text(row.subject, { strong: true }),
        text(row.code, { mono: true }),
        text(row.arm),
        text(row.category),
        text(String(row.periods)),
        text(String(row.takers)),
        pill(row.scores.state, SCORE_TONE[row.scores.state] ?? "neutral"),
        { kind: "action", label: "Edit", drawer },
      ],
      drawer,
      keywords: `armid:${row.classId}|`,
    };
  });
  const mineArms = Array.from(new Map(mine.map((row) => [row.classId, row.arm])).entries());

  const openingArms = Array.from(new Map(openings.map((row) => [row.classId, row.arm])).entries());
  const owed = mine.filter((row) => row.scores.state === "In progress" || row.scores.state === "Returned");
  const openingRows: TableRow[] = openings.map((row) => {
    const assign = mapSubjectDrawer(teaching, overview.arms, { teacherId: teacher.id, subjectId: row.subjectId, armIds: [row.classId] });
    return {
      cells: [
        text(row.subject, { strong: true }),
        text(row.arm),
        text(row.category),
        text(`${row.daysUnassigned} days`, { tone: "negative", strong: true }),
        text(`Blocks ${plural(row.takers, "report card")} — no scores can exist`),
        { kind: "action", label: `Assign to ${teacher.name.split(" ")[0]}`, drawer: assign },
      ],
      keywords: `armid:${row.classId}|`,
    };
  });

  return {
    heading: teacher.name,
    title: teacher.name,
    desc: `${teacher.department ?? "No department"} · every subject-arm this teacher holds, and what it costs them in periods.`,
    primary: { label: "Map another subject", drawer: mapDrawer },
    launchers: [
      ...(running ? [{ label: "See their timetable", href: `/class-timetable/timetable/${running.id}?teacher=${teacher.id}` }] : []),
      { label: "Open their staff record", href: "/staff-access/directory" },
    ],
    rows: [
      ...(over
        ? [
            {
              cols: "1fr",
              panels: [
                {
                  type: "note" as const,
                  tone: "negative" as PanelTone,
                  title: `${teacher.name} is over the ${teacher.ceiling}-period ceiling, at ${teacher.periods}`,
                  body: "Some of the mappings below will have to move to someone else, or the ceiling has to be raised for this teacher with a recorded reason.",
                  acts: [
                    { label: "Move a mapping", drawer: mapDrawer },
                    { label: "Raise the ceiling for them", drawer: raise },
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
            type: "kpi",
            title: "Teaching load",
            sub: `The ceiling ${teacher.raised ? "for this teacher is" : "for this school is"} ${teacher.ceiling} periods a week.`,
            per: 5,
            cards: [
              { label: "Subject-arms held", value: String(mine.length), sub: "Each one names an exact arm" },
              { label: "Distinct subjects", value: String(subjectNames.length), sub: subjectNames.slice(0, 3).join(", ") || "None" },
              {
                label: "Periods a week",
                value: String(teacher.periods),
                unit: `of ${teacher.ceiling}`,
                sub: teacher.load,
                tone: over ? "negative" : teacher.load === "Under-loaded" || teacher.load === "No assignment" ? "attention" : "positive",
              },
              { label: "Students taught", value: String(students), sub: `Across ${plural(arms.length, "arm")}` },
              {
                label: "Score sheets owed",
                value: String(owed.length),
                sub: owed.length ? owed.slice(0, 2).map((row) => `${row.subject} ${row.arm} · ${row.scores.state.toLowerCase()}`).join(", ") : "Nothing outstanding",
                tone: owed.length ? "negative" : "positive",
                link: owed.length ? "Open the score review" : undefined,
                href: owed.length ? "/score-entry-results/review" : undefined,
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
            title: "Subject-arm mappings",
            tag: `${mine.length} held`,
            sub: "Every mapping names one subject in one arm. Change or remove any of them here.",
            meta: "Mapped by you and by the head of department",
            search: "Find a subject or an arm",
            filters: [
              { label: "Arm", value: "All arms", options: ["All arms", ...mineArms.map(([, label]) => label)], match: Object.fromEntries(mineArms.map(([id, label]) => [label, `armid:${id}|`])) },
              { label: "Subject", value: "All subjects", options: ["All subjects", ...subjectNames], column: 0 },
            ],
            noun: "mapping",
            nounPlural: "mappings",
            acts: [
              { label: "Raise their ceiling", drawer: raise },
              { label: "Map another subject", primary: true, drawer: mapDrawer },
            ],
            head: ["Subject", "Code", "Arm", "Category", "Periods", "Takers", "Scores this term", ""],
            rows: mappingRows,
            per: 8,
            empty: "This teacher holds no subject yet.",
            foot: "Removing a mapping unregisters nobody — it leaves the subject-arm needing a teacher, and says so on the catalogue.",
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Arms where this teacher could take more",
            sub: teacher.department ? `Subject-arms in the ${teacher.department} department that nobody teaches yet.` : "Subject-arms that nobody teaches yet.",
            meta: `${plural(openings.length, "uncovered subject-arm")} in this department`,
            noun: "opening",
            nounPlural: "openings",
            filters: [{ label: "Arm", value: "All", options: ["All", ...openingArms.map(([, label]) => label)], match: Object.fromEntries(openingArms.map(([id, label]) => [label, `armid:${id}|`])) }],
            head: ["Subject", "Arm", "Category", "Unassigned for", "Effect", ""],
            rows: openingRows,
            per: 5,
            empty: "Nothing in this department is waiting for a teacher.",
            foot: "A subject nobody teaches cannot be scored, so every card in that arm is blocked by it.",
          },
        ],
      },
    ],
  } as TabContent & { heading: string };
}


function dateText(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** One child, read from the arm they sit in: attendance, results, fees and who to call. */
export async function studentPage(armId: string, studentId: string): Promise<(TabContent & { armName: string }) | null> {
  const student = await apiGet<StudentInArm>(`${BASE}/arms/${armId}/students/${studentId}`).catch(() => null);
  if (!student) return null;

  const { attendance, result, fees } = student;
  const armName = student.arm?.name ?? "their arm";
  const primary = student.guardians.find((guardian) => guardian.primary) ?? student.guardians[0];

  const resultRows: TableRow[] = (result?.subjects ?? []).map((subject) => ({
    cells: [
      text(subject.subject, { strong: true }),
      text(subject.code, { mono: true }),
      text(subject.components.map((component) => `${component.name} ${component.score}`).join(" · ") || "—"),
      text(String(subject.total), { mono: true, strong: true, tone: gradeTone(subject.total) === "negative" ? "negative" : undefined }),
    ],
    keywords: subject.subject,
  }));

  const invoiceRows: TableRow[] = fees.invoices.map((invoice) => ({
    cells: [
      text(invoice.number, { mono: true, strong: true }),
      text(money(invoice.total), { mono: true }),
      text(money(invoice.balance), { mono: true, tone: invoice.balance > 0 ? "attention" : undefined }),
      text(dateText(invoice.dueOn)),
      pill(invoice.status.replace(/_/g, " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase()), invoice.status === "PAID" ? "positive" : invoice.status === "OVERDUE" ? "negative" : "attention"),
    ],
  }));

  const share = (count: number) => (attendance.marked ? Math.round((count / attendance.marked) * 100) : 0);

  return {
    armName,
    title: student.name,
    desc: `${student.admissionNumber} · ${armName} · ${student.gender}${student.term ? ` · ${student.term.name} ${student.term.session}` : ""}.`,
    primary: { label: "Message a guardian", href: "/communication-center/compose", icon: "M5 12h13M13 6.5l5.5 5.5L13 17.5" },
    launchers: [
      { label: "Open in Student Records", href: "/student-records/registry" },
      { label: "Attendance history", href: "/attendance/log" },
    ],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "This term",
            sub: "Read from the same registers and result sheets the arm page uses.",
            per: 6,
            cards: [
              {
                label: "Attendance",
                value: attendance.rate === null ? "—" : `${attendance.rate}%`,
                sub: attendance.marked ? `${attendance.present} present of ${attendance.marked} marked days` : "No register marked yet",
                tone: attendance.rate === null ? "neutral" : attendance.rate < 75 ? "negative" : attendance.rate < 92 ? "attention" : "positive",
              },
              {
                label: "Term average",
                value: result ? String(result.average) : "—",
                unit: result ? "/ 100" : undefined,
                sub: result ? `Total ${result.total}` : "No result sheet yet",
                tone: result ? gradeTone(result.average) : "neutral",
              },
              {
                label: "Position",
                value: result?.position ? String(result.position) : "—",
                unit: result?.position ? `of ${result.outOf}` : undefined,
                sub: result?.position ? `In ${armName}` : "Not ranked yet",
              },
              { label: "Grade", value: result?.grade ?? "—", sub: result ? `Result ${result.status.toLowerCase().replace(/_/g, " ")}` : "Waiting on score sheets", tone: result ? gradeTone(result.average) : "neutral" },
              {
                label: "Fees outstanding",
                value: money(fees.outstanding),
                sub: fees.outstanding ? plural(fees.invoices.filter((invoice) => invoice.balance > 0).length, "invoice") + " unpaid" : "Settled",
                tone: fees.outstanding ? "attention" : "positive",
              },
              { label: "Portal", value: student.portal === "Active" ? "Active" : student.portal === "Not activated" ? "Off" : "Created", sub: student.portal, tone: student.portal === "Active" ? "positive" : "neutral" },
            ],
          },
        ],
      },
      {
        cols: "1.2fr 1fr",
        panels: [
          {
            type: "facts",
            title: "Profile",
            sub: "What the school holds on this child.",
            per: 2,
            acts: [{ label: "Open the full record", primary: true, href: "/student-records/registry" }],
            facts: [
              ["Admission number", student.admissionNumber],
              ["Date of birth", dateText(student.dateOfBirth)],
              ["Admitted", dateText(student.admissionDate)],
              ["Status", student.status.charAt(0) + student.status.slice(1).toLowerCase()],
              ["Nationality", student.nationality, student.stateOfOrigin ?? undefined],
              ["Class and arm", armName, student.arm?.level],
              ["Subject registration", student.registration ? `${student.registration.subjects} subjects` : "Not recorded", student.registration ? `${student.registration.track} track` : "Registered with the arm's offering"],
              ["Portal", student.portal],
            ] satisfies PanelFact[],
          },
          {
            type: "list",
            title: "Guardians",
            sub: primary ? `${primary.name} is the primary contact.` : "No guardian is on file for this child.",
            readOnly: true,
            items: student.guardians.length
              ? student.guardians.map((guardian) => ({
                  label: guardian.name,
                  sub: `${guardian.relationship} · ${guardian.phone}${guardian.email ? ` · ${guardian.email}` : ""}`,
                  pill: guardian.primary ? "Primary" : "Guardian",
                  tone: (guardian.primary ? "positive" : "neutral") as PanelTone,
                  viewLabel: "View",
                  facts: [
                    ["Name", guardian.name],
                    ["Relationship", guardian.relationship],
                    ["Phone", guardian.phone],
                    ["Email", guardian.email ?? "—"],
                    ["Primary contact", guardian.primary ? "Yes" : "No"],
                    ["Receives SMS", guardian.sms ? "Yes" : "No"],
                  ] satisfies PanelFact[],
                }))
              : [{ label: "No guardian on file", sub: "Add one in Parents & Guardians", pill: "Missing", tone: "attention" as PanelTone }],
          },
        ],
      },
      {
        cols: "1fr",
        panels: result
          ? [
              {
                type: "table",
                title: "Results this term",
                tag: result.grade ? `Grade ${result.grade}` : undefined,
                tagTone: gradeTone(result.average),
                sub: `Average ${result.average} · position ${result.position ?? "—"} of ${result.outOf} · ${result.status.toLowerCase().replace(/_/g, " ")}.`,
                noun: "subject",
                nounPlural: "subjects",
                search: "Find a subject",
                head: ["Subject", "Code", "Components", "Total"],
                rows: resultRows,
                per: 12,
                empty: "No scores have been entered yet.",
              },
            ]
          : [
              {
                type: "note",
                tone: "attention",
                title: "No result sheet yet",
                body: "Scores for this child have not been entered this term, so there is no average, position or grade to show.",
                acts: [{ label: "Open the score review", href: "/score-entry-results/review" }],
              },
            ],
      },
      {
        cols: "1.2fr 1fr",
        panels: [
          {
            type: "table",
            title: "Invoices",
            sub: "The most recent fee invoices raised for this child.",
            noun: "invoice",
            nounPlural: "invoices",
            head: ["Invoice", "Total", "Balance", "Due", "State"],
            rows: invoiceRows,
            empty: "No invoice has been raised for this child.",
            foot: "Fees are managed in Fee Management; this is a read-out.",
          },
          {
            type: "bars",
            title: "Attendance this term",
            sub: attendance.marked ? `${attendance.marked} marked days.` : "No register has been marked for this child.",
            rows: [
              { label: "Present", value: share(attendance.present), display: `${attendance.present}`, tone: "positive" },
              { label: "Late", value: share(attendance.late), display: `${attendance.late}`, tone: "attention" },
              { label: "Excused", value: share(attendance.excused), display: `${attendance.excused}`, tone: "neutral" },
              { label: "Absent", value: share(attendance.absent), display: `${attendance.absent}`, tone: "negative" },
            ],
          },
        ],
      },
    ],
  };
}
