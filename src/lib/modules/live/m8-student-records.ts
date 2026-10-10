import { apiGet } from "@/lib/api/server";
import type { StudentRecordView } from "@/lib/domain/types";
import { naira } from "@/lib/modules/fees-data";
import {
  name as nameCell,
  pill,
  text,
  type DrawerSpec,
  type KpiCard,
  type PanelFact,
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


const CHECK_ICON = "M20 6 9 17l-5-5";

type AdmissionRow = {
  id: string;
  applicationNo: string;
  studentName: string;
  gender: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  desiredClass: string | null;
  status: string;
  submittedAt: string | null;
  applicationFeeStatus: string | null;
  feeWaived: boolean;
  duplicateFlag: boolean;
  duplicateReason: string | null;
  reviewNotes: string | null;
  decidedAt: string | null;
};

function admissionTone(status: string): PanelTone {
  switch (status.toUpperCase()) {
    case "ENROLLED":
      return "positive";
    case "SUBMITTED":
    case "SCREENING_SCHEDULED":
    case "REVIEWING":
      return "attention";
    case "REJECTED":
    case "WITHDRAWN":
      return "negative";
    default:
      return "neutral";
  }
}

function readableStatus(value: string): string {
  const words = value.replace(/_/g, " ").toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function admissionDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * M08 · Admissions, read from `GET /v1/admissions`.
 *
 * The pipeline is a funnel, so the tab counts it as one: how many are in, how
 * many are waiting on the school, and how many were flagged as a possible
 * duplicate before anybody spent time on them.
 */
function admissionsTab(rows: AdmissionRow[]): TabContent {
  const byStatus = new Map<string, number>();
  for (const row of rows) byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);

  const waiting = rows.filter((row) =>
    ["SUBMITTED", "REVIEWING", "SCREENING_SCHEDULED", "OFFER_SENT"].includes(row.status.toUpperCase()),
  );
  const duplicates = rows.filter((row) => row.duplicateFlag);
  const enrolled = rows.filter((row) => row.status.toUpperCase() === "ENROLLED");
  const feeUnpaid = rows.filter(
    (row) => !row.feeWaived && (row.applicationFeeStatus ?? "").toUpperCase() !== "VERIFIED",
  );

  const tableRows: TableRow[] = rows
    .slice()
    .sort((a, b) => new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime())
    .map((row) => ({
      cells: [
        nameCell(row.studentName, row.applicationNo),
        text(row.desiredClass ?? "—"),
        text(row.guardianName ?? "—", { tone: row.guardianName ? undefined : "attention" }),
        pill(readableStatus(row.status), admissionTone(row.status)),
        text(row.duplicateFlag ? "Possible duplicate" : "—", {
          tone: row.duplicateFlag ? "negative" : undefined,
          strong: row.duplicateFlag,
        }),
        text(admissionDate(row.submittedAt)),
        {
          kind: "action" as const,
          label: "View",
          drawer: {
            kicker: row.applicationNo,
            title: row.studentName,
            sub: row.desiredClass ? `Applying for ${row.desiredClass}` : undefined,
            tone: admissionTone(row.status),
            readOnly: true,
            facts: [
              ["Application", row.applicationNo],
              ["Applicant", row.studentName],
              ["Gender", row.gender ? readableStatus(row.gender) : "—"],
              ["Desired class", row.desiredClass ?? "—"],
              ["Guardian", row.guardianName ?? "—"],
              ["Guardian phone", row.guardianPhone ?? "—"],
              ["Status", readableStatus(row.status)],
              ["Submitted", admissionDate(row.submittedAt)],
              ["Decided", admissionDate(row.decidedAt)],
              ["Application fee", row.feeWaived ? "waived" : readableStatus(row.applicationFeeStatus ?? "unknown")],
              ["Duplicate flag", row.duplicateFlag ? (row.duplicateReason ?? "flagged") : "none"],
              ["Review notes", row.reviewNotes?.trim() || "none"],
            ],
          },
        },
      ],
      keywords: `${row.studentName} ${row.applicationNo} ${row.guardianName ?? ""} ${row.status}`,
    }));

  return {
    title: "Admissions",
    desc: "Who is trying to get in, and what is holding each one up.",
    launchers: [{ label: "Registry", href: "/student-records/registry" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "The admissions funnel",
            per: 4,
            cards: [
              { label: "Applications", value: String(rows.length), sub: `${byStatus.size} distinct states` },
              {
                label: "Waiting on the school",
                value: String(waiting.length),
                sub: waiting.length ? "Submitted, screening or reviewing" : "Nothing outstanding",
                tone: waiting.length ? "attention" : "positive",
              },
              {
                label: "Enrolled",
                value: String(enrolled.length),
                sub: rows.length
                  ? `${Math.round((enrolled.length / rows.length) * 100)}% of applicants`
                  : "—",
                tone: "positive",
              },
              {
                label: "Possible duplicates",
                value: String(duplicates.length),
                sub: duplicates.length ? "Flagged before anyone reviewed them" : "None flagged",
                tone: duplicates.length ? "negative" : "positive",
              },
            ],
          },
        ],
      },
      {
        cols: "1.1fr 1fr",
        panels: [
          {
            type: "bars",
            title: "By state",
            sub: "Where the funnel is widest.",
            rows: Array.from(byStatus.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => ({
                label: readableStatus(status),
                value: count,
                display: String(count),
                tone: admissionTone(status),
              })),
          },
          feeUnpaid.length
            ? {
                type: "note",
                tone: "attention",
                title: `${feeUnpaid.length} application${feeUnpaid.length === 1 ? "" : "s"} without a verified fee`,
                body: "An application whose fee is neither verified nor waived has not really entered the pipeline, however far down the list it appears.",
              }
            : {
                type: "note",
                tone: "positive",
                title: "Every application's fee is settled",
                body: "Each one is either verified or explicitly waived.",
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Applications",
            sub: "Most recently submitted first.",
            meta: `${rows.length} applications · ${duplicates.length} flagged`,
            head: ["Applicant", "Class", "Guardian", "Status", "Flag", "Submitted", ""],
            per: 12,
            rows: tableRows,
          },
        ],
      },
    ],
  };
}


type EditRequest = {
  id: string;
  targetUserId: string;
  targetName: string;
  requestedBy: string;
  reviewedBy: string | null;
  fields: Record<string, unknown>;
  reason: string | null;
  status: string;
  reviewComment: string | null;
  createdAt: string;
  reviewedAt?: string | null;
};

function editTone(status: string): PanelTone {
  switch (status.toUpperCase()) {
    case "APPROVED":
      return "positive";
    case "PENDING":
      return "attention";
    default:
      return "negative";
  }
}

function fieldSummary(fields: Record<string, unknown>): string {
  const entries = Object.entries(fields ?? {});
  if (!entries.length) return "no fields named";
  return entries
    .map(([key, value]) => {
      const label = key
        .replace(/([A-Z])/g, (char) => ` ${char.toLowerCase()}`)
        .replace(/^./, (char) => char.toUpperCase());
      return `${label} → ${String(value)}`;
    })
    .join(" · ");
}

function editWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function editAgeDays(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

/**
 * The two decisions the API accepts on an edit request.
 *
 * Approving does not just mark a row — it writes the requested fields onto the
 * user record, which is why the drawer says so before it is pressed.
 */
function editDecision(row: EditRequest, action: "APPROVED" | "REJECTED") {
  const approving = action === "APPROVED";
  return {
    kind: "action" as const,
    label: approving ? "Approve" : "Reject",
    drawer: {
      kicker: row.status.toLowerCase(),
      title: row.targetName,
      sub: fieldSummary(row.fields),
      mode: "commit" as const,
      commitLabel: approving ? "Approve the change" : "Reject",
      commitNote: approving
        ? "Approving writes these fields onto the person's record straight away."
        : "Rejecting leaves the record untouched. Say why, so they know what to fix.",
      commitDone: approving ? "Applied" : "Rejected",
      commitDoneBody: approving
        ? "The record has been updated and the page re-read."
        : "The request is closed with your reason against it.",
      facts: [
        ["Person", row.targetName],
        ["Requested by", row.requestedBy],
        ["Change", fieldSummary(row.fields)],
        ["Reason given", row.reason || "none"],
        ["Raised", editWhen(row.createdAt)],
        ["Waiting", `${editAgeDays(row.createdAt)} day(s)`],
      ] as PanelFact[],
      submit: {
        endpoint: `/api/v1/profiles/edit-requests/${row.id}/review`,
        method: "PATCH" as const,
        body: { status: action },
        reasonKey: "reviewComment",
        reasonLabel: approving ? "Note (optional)" : "Why (required)",
        reasonRequired: !approving,
      },
    },
  };
}

function editRequestPanels(rows: EditRequest[], heading: string, blurb: string) {
  const pending = rows.filter((row) => row.status.toUpperCase() === "PENDING");
  const decided = rows.filter((row) => row.status.toUpperCase() !== "PENDING");
  const stale = pending.filter((row) => editAgeDays(row.createdAt) >= 3);

  const queue = pending.length
    ? {
        type: "table" as const,
        title: heading,
        sub: blurb,
        meta: `${pending.length} waiting · ${stale.length} over three days`,
        head: ["Person", "Change", "Raised", "Waiting", "", ""],
        per: 10,
        rows: pending.map((row) => ({
          cells: [
            nameCell(row.targetName, `asked by ${row.requestedBy}`),
            text(fieldSummary(row.fields)),
            text(editWhen(row.createdAt)),
            text(`${editAgeDays(row.createdAt)}d`, {
              tone: editAgeDays(row.createdAt) >= 3 ? "negative" : undefined,
              strong: editAgeDays(row.createdAt) >= 3,
            }),
            editDecision(row, "APPROVED"),
            editDecision(row, "REJECTED"),
          ],
          keywords: `${row.targetName} ${row.requestedBy}`,
        })),
      }
    : {
        type: "note" as const,
        tone: "positive" as const,
        icon: CHECK_ICON,
        title: "Nothing is waiting on a decision",
        body:
          rows.length === 0
            ? "Nobody has asked for a correction to their record."
            : `All ${rows.length} requests have been decided. They stay listed below.`,
      };

  const history = decided.length
    ? {
        type: "table" as const,
        title: "Decided",
        sub: "What was changed, by whom, and why.",
        meta: `${decided.length} decided`,
        head: ["Person", "Change", "Outcome", "Reviewed by", "Comment"],
        per: 10,
        rows: decided.map((row) => ({
          cells: [
            nameCell(row.targetName, `asked by ${row.requestedBy}`),
            text(fieldSummary(row.fields)),
            pill(row.status.toLowerCase(), editTone(row.status)),
            text(row.reviewedBy ?? "—"),
            text(row.reviewComment || "—", {
              tone: row.reviewComment ? undefined : "attention",
            }),
          ],
          keywords: `${row.targetName} ${row.status}`,
        })),
      }
    : {
        type: "note" as const,
        tone: "neutral" as const,
        title: "Nothing has been decided yet",
        body: "Once a request is approved or rejected it stays here with its reason.",
      };

  return { pending, decided, stale, queue, history };
}

/** M08 · Changes — corrections asked for on a person's record. */
function changesTab(rows: EditRequest[]): TabContent {
  const { pending, decided, stale, queue, history } = editRequestPanels(
    rows,
    "Waiting on a decision",
    "Approving writes the change onto the record immediately.",
  );

  return {
    title: "Changes",
    desc: "Corrections people have asked for on their own records.",
    launchers: [{ label: "Registry", href: "/student-records/registry" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "Record corrections",
            per: 4,
            cards: [
              { label: "Requests", value: String(rows.length), sub: "All time" },
              {
                label: "Waiting",
                value: String(pending.length),
                sub: pending.length ? "Nobody has answered" : "Nothing outstanding",
                tone: pending.length ? "attention" : "positive",
              },
              {
                label: "Over three days",
                value: String(stale.length),
                sub: stale.length ? "Somebody is waiting on this" : "All answered promptly",
                tone: stale.length ? "negative" : "positive",
              },
              { label: "Decided", value: String(decided.length), sub: "Approved or rejected" },
            ],
          },
        ],
      },
      { cols: "1fr", panels: [queue] },
      { cols: "1fr", panels: [history] },
    ],
  };
}

export async function studentRecordsLiveTab(
  tabSlug: string,
): Promise<TabContent | undefined> {
  if (tabSlug === "registry") {
    const students = await apiGet<StudentRecordView[]>("/api/v1/students");
    return registryTab(students ?? []);
  }

  if (tabSlug === "admissions") {
    const applications = await apiGet<AdmissionRow[]>("/api/v1/admissions");
    return admissionsTab(applications ?? []);
  }

  if (tabSlug === "changes") {
    const rows = await apiGet<EditRequest[]>("/api/v1/profiles/edit-requests");
    return changesTab(rows ?? []);
  }

  return undefined;
}
