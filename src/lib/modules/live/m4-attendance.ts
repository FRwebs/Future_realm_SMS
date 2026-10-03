import { apiGet } from "@/lib/api/server";
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
 * M04 Attendance, read from `GET /v1/attendance/summary` and `GET /v1/attendance`.
 *
 * Summary is one row per student with the term's totals already folded in, so
 * the register and the compliance tab come from one call rather than a query
 * per child. The log reads the raw marks, which is the only place the mark's
 * author and subject survive.
 */

type SummaryRow = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  classId: string;
  className: string;
  totalDays: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  percentage: number;
};

type MarkRow = {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  subjectId: string | null;
  subject: string | null;
  status: string;
  date: string;
  markedByName: string | null;
};

/** The mockup colours the rate, never the box around it. */
function rateTone(rate: number): PanelTone {
  if (rate >= 90) return "positive";
  if (rate >= 75) return "attention";
  return "negative";
}

function statusTone(status: string): PanelTone {
  switch (status.toUpperCase()) {
    case "PRESENT":
      return "positive";
    case "LATE":
      return "attention";
    case "EXCUSED":
      return "neutral";
    default:
      return "negative";
  }
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

/** Everything the three tabs need about a class, folded once. */
function byClass(rows: SummaryRow[]) {
  const classes = new Map<
    string,
    { className: string; students: number; present: number; marks: number; rateSum: number }
  >();
  for (const row of rows) {
    const entry = classes.get(row.className) ?? {
      className: row.className,
      students: 0,
      present: 0,
      marks: 0,
      rateSum: 0,
    };
    entry.students += 1;
    entry.present += row.present + row.late;
    entry.marks += row.totalDays;
    entry.rateSum += row.percentage;
    classes.set(row.className, entry);
  }
  return Array.from(classes.values())
    .map((entry) => ({
      ...entry,
      rate: entry.students ? Math.round((entry.rateSum / entry.students) * 10) / 10 : 0,
    }))
    .sort((a, b) => a.rate - b.rate);
}

function studentFacts(row: SummaryRow): PanelFact[] {
  return [
    ["Student", row.studentName],
    ["Admission number", row.admissionNumber],
    ["Class", row.className],
    ["Days recorded", String(row.totalDays)],
    ["Present", String(row.present)],
    ["Late", String(row.late)],
    ["Excused", String(row.excused)],
    ["Absent", String(row.absent)],
    ["Rate", `${row.percentage}%`],
  ];
}

/* ─────────────────────────── Register ─────────────────────────── */

function registerTab(rows: SummaryRow[]): TabContent {
  const classes = byClass(rows);
  const marks = rows.reduce((sum, row) => sum + row.totalDays, 0);
  const present = rows.reduce((sum, row) => sum + row.present + row.late, 0);
  const rate = marks ? Math.round((present / marks) * 1000) / 10 : 0;
  const below75 = rows.filter((row) => row.percentage < 75).length;

  const studentRows: TableRow[] = rows
    .slice()
    .sort((a, b) => a.percentage - b.percentage)
    .map((row) => ({
      cells: [
        nameCell(row.studentName, row.admissionNumber),
        text(row.className),
        text(String(row.totalDays)),
        text(`${row.present + row.late}`, { tone: "positive" }),
        text(String(row.absent), { tone: row.absent ? "negative" : undefined, strong: row.absent > 0 }),
        text(`${row.percentage}%`, { tone: rateTone(row.percentage), strong: true }),
        {
          kind: "action" as const,
          label: "View",
          drawer: {
            kicker: row.className,
            title: row.studentName,
            sub: `${row.percentage}% across ${row.totalDays} recorded days`,
            tone: rateTone(row.percentage),
            facts: studentFacts(row),
            readOnly: true,
            readOnlyNote:
              "This is what the register holds for this child. Marks are corrected on the day they were taken, not here.",
          },
        },
      ],
      keywords: `${row.studentName} ${row.admissionNumber} ${row.className}`,
    }));

  return {
    title: "Register",
    desc: "Every child on the roll, and how often they are in the room.",
    launchers: [{ label: "Compliance", href: "/attendance/compliance" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "Attendance as recorded",
            per: 4,
            cards: [
              { label: "Students on the roll", value: rows.length.toLocaleString(), sub: `Across ${classes.length} classes` },
              {
                label: "Attendance rate",
                value: `${rate}%`,
                sub: `${present.toLocaleString()} of ${marks.toLocaleString()} marks`,
                tone: rateTone(rate),
              },
              {
                label: "Below 75%",
                value: String(below75),
                sub: below75 ? "Each one needs a reason on file" : "Nobody is behind",
                tone: below75 ? "attention" : "positive",
              },
              {
                label: "Marks recorded",
                value: marks.toLocaleString(),
                sub: "Across the whole register",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "bars",
            title: "Rate by class",
            sub: "Weakest first — this is the order to walk the corridors in.",
            rows: classes.slice(0, 10).map((entry) => ({
              label: entry.className,
              value: entry.rate,
              display: `${entry.rate}%`,
              sub: `${entry.students} students`,
              tone: rateTone(entry.rate),
            })),
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "The roll",
            sub: "Lowest rate first, because that is the end that needs you.",
            meta: `${rows.length} students`,
            head: ["Student", "Class", "Days", "In", "Absent", "Rate", ""],
            per: 12,
            rows: studentRows,
          },
        ],
      },
    ],
  };
}

/* ─────────────────────────── Compliance ─────────────────────────── */

function complianceTab(rows: SummaryRow[]): TabContent {
  const classes = byClass(rows);
  const chronic = rows.filter((row) => row.percentage < 75).sort((a, b) => a.percentage - b.percentage);
  const watch = rows.filter((row) => row.percentage >= 75 && row.percentage < 85);
  const weakClasses = classes.filter((entry) => entry.rate < 90);

  return {
    title: "Compliance",
    desc: "Who is falling behind, and which rooms are letting it happen.",
    launchers: [{ label: "Open the register", href: "/attendance/register" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "Where attendance is failing",
            per: 4,
            cards: [
              {
                label: "Below 75%",
                value: String(chronic.length),
                sub: "Chronic — a reason belongs on file",
                tone: chronic.length ? "negative" : "positive",
              },
              {
                label: "75–85%",
                value: String(watch.length),
                sub: "Worth watching before it becomes chronic",
                tone: watch.length ? "attention" : "positive",
              },
              {
                label: "Classes under 90%",
                value: String(weakClasses.length),
                sub: `of ${classes.length} classes`,
                tone: weakClasses.length ? "attention" : "positive",
              },
              {
                label: "Fully attending",
                value: String(rows.filter((row) => row.percentage === 100).length),
                sub: "Never missed a recorded day",
                tone: "positive",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          chronic.length
            ? {
                type: "table",
                title: "Below 75%",
                sub: "Each of these needs a reason recorded, and somebody to carry it.",
                meta: `${chronic.length} student${chronic.length === 1 ? "" : "s"}`,
                head: ["Student", "Class", "Absent", "Excused", "Rate", ""],
                per: 10,
                rows: chronic.map((row) => ({
                  cells: [
                    nameCell(row.studentName, row.admissionNumber),
                    text(row.className),
                    text(String(row.absent), { tone: "negative", strong: true }),
                    text(String(row.excused)),
                    text(`${row.percentage}%`, { tone: rateTone(row.percentage), strong: true }),
                    {
                      kind: "action" as const,
                      label: "View",
                      drawer: {
                        kicker: row.className,
                        title: row.studentName,
                        sub: `${row.percentage}% — below the 75% threshold`,
                        tone: "negative",
                        facts: studentFacts(row),
                        readOnly: true,
                      },
                    },
                  ],
                  keywords: `${row.studentName} ${row.className}`,
                })),
              }
            : {
                type: "note",
                tone: "positive",
                icon: CHECK_ICON,
                title: "No child is below 75%",
                body: "Nothing on this register is chronic. The watch list below is the earlier warning.",
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Classes by rate",
            sub: "A room that is persistently low is usually a timetable problem, not a family one.",
            head: ["Class", "Students", "Marks", "Rate"],
            per: 10,
            rows: classes.map((entry) => ({
              cells: [
                text(entry.className, { strong: true }),
                text(String(entry.students)),
                text(entry.marks.toLocaleString()),
                text(`${entry.rate}%`, { tone: rateTone(entry.rate), strong: true }),
              ],
              keywords: entry.className,
            })),
          },
        ],
      },
    ],
  };
}

/* ─────────────────────────── Log ─────────────────────────── */

function logTab(marks: MarkRow[]): TabContent {
  const byStatus = new Map<string, number>();
  for (const mark of marks) byStatus.set(mark.status, (byStatus.get(mark.status) ?? 0) + 1);
  const days = new Set(marks.map((mark) => mark.date.slice(0, 10)));
  const markers = new Set(marks.map((mark) => mark.markedByName).filter(Boolean));

  const sorted = marks
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    title: "Log",
    desc: "Every mark as it was taken, and who took it.",
    launchers: [{ label: "Compliance", href: "/attendance/compliance" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "What the log holds",
            per: 5,
            cards: [
              { label: "Marks", value: marks.length.toLocaleString(), sub: `Across ${days.size} days` },
              {
                label: "Present",
                value: String(byStatus.get("PRESENT") ?? 0),
                sub: "On time",
                tone: "positive",
              },
              {
                label: "Late",
                value: String(byStatus.get("LATE") ?? 0),
                sub: "Counted as in the room",
                tone: (byStatus.get("LATE") ?? 0) > 0 ? "attention" : undefined,
              },
              {
                label: "Absent",
                value: String(byStatus.get("ABSENT") ?? 0),
                sub: "No reason recorded",
                tone: (byStatus.get("ABSENT") ?? 0) > 0 ? "negative" : undefined,
              },
              {
                label: "Staff marking",
                value: String(markers.size),
                sub: markers.size ? "Named on the marks" : "Nobody recorded",
                tone: markers.size ? undefined : "attention",
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
            title: "Marks",
            sub: "Most recent first. A mark is corrected on the day it was taken, never deleted.",
            meta: `${marks.length} marks · ${days.size} days`,
            head: ["Student", "Class", "Subject", "Status", "Taken", "By"],
            per: 15,
            rows: sorted.map((mark) => ({
              cells: [
                text(mark.studentName, { strong: true }),
                text(mark.className),
                text(mark.subject ?? "—"),
                pill(mark.status, statusTone(mark.status)),
                text(dayLabel(mark.date)),
                text(mark.markedByName ?? "—", {
                  tone: mark.markedByName ? undefined : "attention",
                }),
              ],
              keywords: `${mark.studentName} ${mark.className} ${mark.subject ?? ""} ${mark.status}`,
            })),
          },
        ],
      },
    ],
  };
}

const CHECK_ICON = "M20 6 9 17l-5-5";

export async function attendanceLiveTab(tabSlug: string): Promise<TabContent | null | undefined> {
  if (tabSlug === "register" || tabSlug === "compliance") {
    const rows = await apiGet<SummaryRow[]>("/api/v1/attendance/summary");
    if (!rows?.length) return undefined;
    return tabSlug === "register" ? registerTab(rows) : complianceTab(rows);
  }

  if (tabSlug === "log") {
    const marks = await apiGet<MarkRow[]>("/api/v1/attendance");
    if (!marks?.length) return undefined;
    return logTab(marks);
  }

  // Mark stays authored. Taking a register is a per-student grid of radio
  // buttons posted as one body, and the panel vocabulary has no control for
  // that — a table of triggers cannot express it. Wiring it means a dedicated
  // component, not a content builder.
  return undefined;
}
