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
 * M05 Score Entry & Results, read from `GET /v1/academics/*`.
 *
 * Review reads the approval queue and the broadsheets behind it; Results reads
 * the report cards that came out the other end. The queue's two decisions are
 * real commands — `POST /v1/academics/score-sheets/approve` and `/reject` —
 * so confirming one moves the sheet rather than only closing the drawer.
 */

type ApprovalRow = {
  id: string;
  resultSheetId: string;
  studentName: string;
  className: string;
  status: string;
  action: string;
  actorName: string;
  note?: string;
  createdAt: string;
};

type BroadsheetRow = {
  id: string;
  className: string;
  classLevel: string;
  classArm: string;
  classTeacherName: string | null;
  term: string;
  session: string;
  status: string;
  approvalStage: string;
  rankingEnabled: boolean;
  missingScoreWarnings: string[];
  metrics: {
    studentCount: number;
    subjectCount: number;
    completeStudents: number;
    incompleteStudents: number;
    missingEntries: number;
    classAverage: number;
    published: boolean;
  };
};

type ReportCardRow = {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  broadsheetId: string;
  term: string;
  session: string;
  status: string;
  total: number;
  average: number;
  grade: string | null;
  publishedAt: string | null;
  lockedAt: string | null;
  classTeacherRemark: string | null;
  principalRemark: string | null;
};

const CHECK_ICON = "M20 6 9 17l-5-5";

function statusTone(status: string): PanelTone {
  switch (status.toUpperCase()) {
    case "PUBLISHED":
    case "APPROVED":
      return "positive";
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return "attention";
    case "RETURNED":
    case "REJECTED":
      return "negative";
    default:
      return "neutral";
  }
}

function gradeTone(average: number): PanelTone {
  if (average >= 70) return "positive";
  if (average >= 50) return "attention";
  return "negative";
}

function readable(value: string): string {
  const words = value.replace(/_/g, " ").toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function whenLabel(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

/* ─────────────────────────── Review ─────────────────────────── */

function reviewTab(queue: ApprovalRow[], sheets: BroadsheetRow[]): TabContent {
  const totals = sheets.reduce(
    (acc, sheet) => ({
      students: acc.students + sheet.metrics.studentCount,
      complete: acc.complete + sheet.metrics.completeStudents,
      missing: acc.missing + sheet.metrics.missingEntries,
    }),
    { students: 0, complete: 0, missing: 0 },
  );
  const blocked = sheets.filter((sheet) => sheet.metrics.incompleteStudents > 0);
  const waiting = queue.filter((row) => ["SUBMITTED", "UNDER_REVIEW"].includes(row.status.toUpperCase()));

  const queuePanel = waiting.length
    ? {
        type: "table" as const,
        title: "Waiting on a decision",
        sub: "A sheet approved here is locked; one returned goes back to the teacher with your reason.",
        meta: `${waiting.length} sheet${waiting.length === 1 ? "" : "s"}`,
        head: ["Student", "Class", "State", "Last action", "Decide"],
        per: 10,
        rows: waiting.map((row) => ({
          cells: [
            nameCell(row.studentName, row.className),
            text(row.className),
            pill(readable(row.status), statusTone(row.status)),
            text(`${readable(row.action)} · ${row.actorName}`),
            {
              kind: "action" as const,
              label: "Decide",
              drawer: {
                kicker: row.className,
                title: row.studentName,
                sub: `${readable(row.status)} — approving locks this sheet.`,
                mode: "commit" as const,
                commitLabel: "Approve",
                commitNote: "Approving records you as the approver, with a timestamp.",
                commitDone: "Approved",
                commitDoneBody: "The sheet is locked and the queue has been re-read.",
                facts: [
                  ["Student", row.studentName],
                  ["Class", row.className],
                  ["State", readable(row.status)],
                  ["Last action", `${readable(row.action)} by ${row.actorName}`],
                  ["Note on file", row.note || "none"],
                ] as PanelFact[],
                submit: {
                  endpoint: "/api/v1/academics/score-sheets/approve",
                  method: "POST" as const,
                  body: { resultSheetId: row.resultSheetId },
                  reasonKey: "note",
                  reasonLabel: "Note (kept against the decision)",
                },
              },
            },
          ],
          keywords: `${row.studentName} ${row.className} ${row.status}`,
        })),
      }
    : {
        type: "note" as const,
        tone: "positive" as const,
        icon: CHECK_ICON,
        title: "Nothing is waiting on a decision",
        body:
          queue.length === 0
            ? "No sheet is in a reviewable state. Every result on this school is already published, so there is nothing to approve or return."
            : `All ${queue.length} sheets in the queue have been decided. Approved and returned sheets stay listed below for the record.`,
      };

  return {
    title: "Review",
    desc: "What is waiting on you before results can be published.",
    launchers: [{ label: "Results", href: "/score-entry-results/results" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "Where the term's results stand",
            per: 4,
            cards: [
              {
                label: "Waiting on you",
                value: String(waiting.length),
                sub: waiting.length ? "Submitted or under review" : "Nothing to decide",
                tone: waiting.length ? "attention" : "positive",
              },
              {
                label: "Broadsheets",
                value: String(sheets.length),
                sub: `${sheets.filter((sheet) => sheet.metrics.published).length} published`,
              },
              {
                label: "Students complete",
                value: totals.students ? `${totals.complete} of ${totals.students}` : "—",
                sub: blocked.length ? `${blocked.length} class(es) incomplete` : "Every student has a full sheet",
                tone: blocked.length ? "attention" : "positive",
              },
              {
                label: "Missing entries",
                value: String(totals.missing),
                sub: totals.missing ? "Scores not yet entered" : "Nothing missing",
                tone: totals.missing ? "negative" : "positive",
              },
            ],
          },
        ],
      },
      { cols: "1fr", panels: [queuePanel] },
      {
        cols: "1fr",
        panels: [
          sheets.length
            ? {
                type: "table",
                title: "Broadsheets",
                sub: "One per class per term — the sheet a report card is cut from.",
                meta: `${sheets.length} broadsheet${sheets.length === 1 ? "" : "s"}`,
                head: ["Class", "Teacher", "Students", "Subjects", "Average", "Stage", ""],
                per: 10,
                rows: sheets.map((sheet) => ({
                  cells: [
                    nameCell(sheet.className, `${sheet.term} · ${sheet.session}`),
                    text(sheet.classTeacherName ?? "—", {
                      tone: sheet.classTeacherName ? undefined : "attention",
                    }),
                    text(
                      `${sheet.metrics.completeStudents}/${sheet.metrics.studentCount}`,
                      {
                        tone: sheet.metrics.incompleteStudents ? "attention" : "positive",
                        strong: sheet.metrics.incompleteStudents > 0,
                      },
                    ),
                    text(String(sheet.metrics.subjectCount)),
                    text(`${sheet.metrics.classAverage}%`, { tone: gradeTone(sheet.metrics.classAverage), strong: true }),
                    pill(readable(sheet.approvalStage), statusTone(sheet.approvalStage)),
                    {
                      kind: "action" as const,
                      label: "View",
                      drawer: {
                        kicker: `${sheet.term} · ${sheet.session}`,
                        title: sheet.className,
                        sub: `Class average ${sheet.metrics.classAverage}%`,
                        tone: statusTone(sheet.approvalStage),
                        readOnly: true,
                        facts: [
                          ["Class", sheet.className],
                          ["Class teacher", sheet.classTeacherName ?? "none assigned"],
                          ["Students", String(sheet.metrics.studentCount)],
                          ["Complete", String(sheet.metrics.completeStudents)],
                          ["Incomplete", String(sheet.metrics.incompleteStudents)],
                          ["Subjects", String(sheet.metrics.subjectCount)],
                          ["Missing entries", String(sheet.metrics.missingEntries)],
                          ["Class average", `${sheet.metrics.classAverage}%`],
                          ["Stage", readable(sheet.approvalStage)],
                          ["Ranking", sheet.rankingEnabled ? "on" : "off"],
                          [
                            "Warnings",
                            sheet.missingScoreWarnings.length
                              ? sheet.missingScoreWarnings.join(" · ")
                              : "none",
                          ],
                        ] as PanelFact[],
                      },
                    },
                  ],
                  keywords: `${sheet.className} ${sheet.classTeacherName ?? ""} ${sheet.approvalStage}`,
                })),
              }
            : {
                type: "note",
                tone: "attention",
                title: "No broadsheet has been compiled",
                body: "Until a class is compiled, there is nothing to review and no report card can be cut.",
              },
        ],
      },
    ],
  };
}

/* ─────────────────────────── Results ─────────────────────────── */

function resultsTab(cards: ReportCardRow[]): TabContent {
  const published = cards.filter((card) => card.status.toUpperCase() === "PUBLISHED");
  const locked = cards.filter((card) => card.lockedAt);
  const average = cards.length
    ? Math.round((cards.reduce((sum, card) => sum + card.average, 0) / cards.length) * 100) / 100
    : 0;
  const noRemark = cards.filter((card) => !card.classTeacherRemark?.trim());

  const grades = new Map<string, number>();
  for (const card of cards) grades.set(card.grade ?? "—", (grades.get(card.grade ?? "—") ?? 0) + 1);

  const rows: TableRow[] = cards
    .slice()
    .sort((a, b) => b.average - a.average)
    .map((card) => ({
      cells: [
        nameCell(card.studentName, card.className),
        text(card.term),
        text(card.total.toLocaleString()),
        text(`${card.average}%`, { tone: gradeTone(card.average), strong: true }),
        pill(card.grade ?? "—", gradeTone(card.average)),
        pill(readable(card.status), statusTone(card.status)),
        {
          kind: "action" as const,
          label: "View",
          drawer: {
            kicker: card.className,
            title: card.studentName,
            sub: `${card.average}% · grade ${card.grade ?? "—"}`,
            tone: gradeTone(card.average),
            readOnly: true,
            readOnlyNote:
              "A published report card is a record. Corrections are made on the sheet it was cut from, which reissues it.",
            facts: [
              ["Student", card.studentName],
              ["Class", card.className],
              ["Term", `${card.term} · ${card.session}`],
              ["Total", card.total.toLocaleString()],
              ["Average", `${card.average}%`],
              ["Grade", card.grade ?? "—"],
              ["Status", readable(card.status)],
              ["Published", whenLabel(card.publishedAt)],
              ["Locked", card.lockedAt ? whenLabel(card.lockedAt) : "not locked"],
              ["Class teacher's remark", card.classTeacherRemark?.trim() || "none written"],
              ["Principal's remark", card.principalRemark?.trim() || "none written"],
            ] as PanelFact[],
          },
        },
      ],
      keywords: `${card.studentName} ${card.className} ${card.grade ?? ""}`,
    }));

  return {
    title: "Results",
    desc: "What came out the other end, and what families can see.",
    launchers: [{ label: "Review", href: "/score-entry-results/review" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "Report cards cut this term",
            per: 4,
            cards: [
              { label: "Report cards", value: String(cards.length), sub: `${published.length} published` },
              {
                label: "Class average",
                value: cards.length ? `${average}%` : "—",
                sub: "Across every card",
                tone: cards.length ? gradeTone(average) : undefined,
              },
              {
                label: "Locked",
                value: String(locked.length),
                sub: locked.length ? "Cannot be edited" : "None locked yet",
              },
              {
                label: "No teacher remark",
                value: String(noRemark.length),
                sub: noRemark.length ? "A card without one reads as unfinished" : "Every card carries one",
                tone: noRemark.length ? "attention" : "positive",
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
            title: "Grade spread",
            sub: "What the term actually produced.",
            rows: Array.from(grades.entries())
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([grade, count]) => ({
                label: grade,
                value: count,
                display: String(count),
              })),
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          rows.length
            ? {
                type: "table",
                title: "Report cards",
                sub: "Highest average first.",
                meta: `${cards.length} card${cards.length === 1 ? "" : "s"}`,
                head: ["Student", "Term", "Total", "Average", "Grade", "Status", ""],
                per: 12,
                rows,
              }
            : {
                type: "note",
                tone: "attention",
                title: "No report card has been cut",
                body: "Compile a broadsheet and approve its sheets, and the cards appear here.",
              },
        ],
      },
    ],
  };
}

export async function scoreEntryResultsLiveTab(
  tabSlug: string,
): Promise<TabContent | null | undefined> {
  if (tabSlug === "review") {
    const [queue, sheets] = await Promise.all([
      apiGet<ApprovalRow[]>("/api/v1/academics/approval-queue").catch(() => [] as ApprovalRow[]),
      apiGet<BroadsheetRow[]>("/api/v1/academics/broadsheets"),
    ]);
    return reviewTab(queue ?? [], sheets ?? []);
  }

  if (tabSlug === "results") {
    const cards = await apiGet<ReportCardRow[]>("/api/v1/academics/report-cards");
    if (!cards) return undefined;
    return resultsTab(cards);
  }

  // Enter stays authored for the same reason Attendance's Mark does: entering
  // scores is a per-student, per-assessment grid posted as one body, and the
  // panel vocabulary has no control that can express it.
  return undefined;
}
