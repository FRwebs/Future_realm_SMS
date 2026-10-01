import { apiGet } from "@/lib/api/server";
import type { StudentRecordView } from "@/lib/domain/types";
import { naira } from "@/lib/modules/fees-data";
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
 * M08 Student Records · Registry, read from `GET /v1/students`.
 *
 * That endpoint already folds attendance, result averages and invoice balances
 * into each row, so the registry's figures and the per-student drawer come from
 * one call rather than one call per student.
 */

/** The mockup colours a rate, never the box around it. */
function rateTone(rate: number): PanelTone {
  if (rate >= 90) return "positive";
  if (rate >= 75) return "attention";
  return "negative";
}

function statusTone(status: string): PanelTone {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "positive";
    case "GRADUATED":
    case "ALUMNI":
      return "neutral";
    case "SUSPENDED":
      return "attention";
    default:
      return "negative";
  }
}

function percent(value: number): string {
  return `${Number.isFinite(value) ? Math.round(value * 10) / 10 : 0}%`;
}

/**
 * The drawer behind a student row.
 *
 * Its command is a pastoral note, because that is the one thing about a student
 * a principal records from the registry itself — everything else (a transfer, a
 * promotion, a fee adjustment) belongs to the module that owns it. The note is
 * required and goes in as the log's description, which the API holds to eight
 * characters, so "ok" cannot be filed as a record of what happened.
 */
function studentDrawer(student: StudentRecordView): DrawerSpec {
  return {
    kicker: student.admissionNumber,
    title: student.fullName,
    sub: `${student.className} · ${student.status.toLowerCase()}`,
    tone: student.outstandingBalance > 0 ? "attention" : "neutral",
    facts: [
      ["Admission number", student.admissionNumber],
      ["Class and arm", student.className],
      ["Status", student.status],
      ["Primary guardian", student.guardianName],
      ["Attendance", percent(student.attendanceRate)],
      ["Average score", student.averageScore > 0 ? percent(student.averageScore) : "No results yet"],
      [
        "Fees outstanding",
        student.outstandingBalance > 0 ? naira(student.outstandingBalance) : "Nothing owed",
      ],
    ],
    mode: "commit",
    commitLabel: "File the note",
    commitNote: "A pastoral note is part of the student's record and cannot be deleted.",
    commitDone: "Note filed",
    commitDoneBody: `It is on ${student.fullName}'s record, against today's date.`,
    submit: {
      endpoint: `/api/v1/students/${student.id}/behavior-logs`,
      method: "POST",
      body: { category: "Pastoral note", severity: "LOW" },
      reasonKey: "description",
      reasonLabel: "What happened",
      reasonRequired: true,
    },
  };
}

function registryTab(students: StudentRecordView[]): TabContent {
  const active = students.filter((student) => student.status.toUpperCase() === "ACTIVE");
  const alumni = students.filter((student) =>
    ["GRADUATED", "ALUMNI"].includes(student.status.toUpperCase()),
  );
  const withdrawn = students.filter((student) => student.status.toUpperCase() === "WITHDRAWN");
  const unplaced = students.filter((student) => !student.classId);
  const owing = students.filter((student) => student.outstandingBalance > 0);
  const owed = owing.reduce((sum, student) => sum + student.outstandingBalance, 0);

  const rated = students.filter((student) => student.attendanceRate > 0);
  const meanAttendance = rated.length
    ? rated.reduce((sum, student) => sum + student.attendanceRate, 0) / rated.length
    : 0;

  const cards: KpiCard[] = [
    {
      label: "Enrolled",
      value: String(active.length),
      sub: `${students.length} on the register in all`,
    },
    {
      label: "Alumni and withdrawn",
      value: `${alumni.length} / ${withdrawn.length}`,
      sub: "A status filter, not a tab",
    },
    {
      label: "No class arm",
      value: String(unplaced.length),
      tone: unplaced.length > 0 ? "attention" : "positive",
      sub: unplaced.length ? "Cannot be marked or graded" : "Everybody is placed",
    },
    {
      label: "Fees outstanding",
      value: naira(owed),
      tone: owing.length > 0 ? "attention" : "positive",
      sub: `${owing.length} student${owing.length === 1 ? "" : "s"} owing`,
    },
    {
      label: "Attendance",
      value: rated.length ? percent(meanAttendance) : "—",
      tone: rated.length ? rateTone(meanAttendance) : "neutral",
      sub: rated.length ? `Mean across ${rated.length} marked` : "Nothing marked yet",
    },
  ];

  const rows: TableRow[] = students.map((student) => ({
    cells: [
      text(student.admissionNumber, { mono: true }),
      nameCell(student.fullName, student.guardianName),
      text(student.className),
      text(percent(student.attendanceRate), { tone: rateTone(student.attendanceRate) }),
      text(student.averageScore > 0 ? percent(student.averageScore) : "—"),
      text(student.outstandingBalance > 0 ? naira(student.outstandingBalance) : "—"),
      pill(student.status, statusTone(student.status)),
      { kind: "action" as const, label: "Open", drawer: studentDrawer(student) },
    ],
    drawer: studentDrawer(student),
    keywords: `${student.admissionNumber} ${student.guardianName} ${student.className}`,
  }));

  return {
    title: "Registry",
    desc: "Every student on this school's register, with what each one owes and how often they are here.",
    launchers: [{ label: "Admissions", href: "/student-records/admissions" }],
    rows: [
      {
        cols: "1fr",
        panels: [{ type: "kpi", title: "Who is on the register", per: 5, cards }],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Every student",
            sub: students.length
              ? `${students.length} record${students.length === 1 ? "" : "s"}, by admission number.`
              : "No student has been admitted yet.",
            head: [
              "Admission no.",
              "Student",
              "Class",
              "Attendance",
              "Average",
              "Outstanding",
              "Status",
              "",
            ],
            rows,
            per: 10,
            empty: "No student matches this filter.",
          },
        ],
      },
    ],
  };
}

export async function studentRecordsLiveTab(
  tabSlug: string,
): Promise<TabContent | undefined> {
  // Only Registry reads live so far; Admissions and Changes keep their authored
  // content rather than pretending to be wired.
  if (tabSlug !== "registry") return undefined;

  const students = await apiGet<StudentRecordView[]>("/api/v1/students");
  return registryTab(students ?? []);
}
