import { apiGet } from "@/lib/api/server";
import {
  name as nameCell,
  pill,
  text,
  type DrawerSpec,
  type KpiCard,
  type PanelRow,
  type PanelTone,
  type TabContent,
  type TableRow,
} from "@/lib/modules/panels";

/**
 * M14 Analytics & Reports · Insights, read from `GET /v1/academics/analytics`.
 *
 * The endpoint already aggregates by class, by subject and by student, so this
 * tab is a reading of one call rather than six. What it adds is an order: the
 * subjects that are failing come first, because a 27% pass rate is a teaching
 * problem the school can act on this term, and a league table of top performers
 * is not.
 */

type Analytics = {
  metrics: Array<{ label: string; value: string; tone: string }>;
  classSummaries: Array<{
    className: string;
    average: number;
    published: number;
    pending: number;
    missingScores: number;
  }>;
  subjectSummaries: Array<{ subject: string; average: number; passRate: number; entries: number }>;
  statusBreakdown: Array<{ status: string; count: number }>;
  missingScores: Array<{ studentName: string; className: string; subject: string }>;
  topPerformers: Array<{
    studentName: string;
    className: string;
    average: number;
    grade: string | null;
    position: number | null;
  }>;
};

function scoreTone(value: number): PanelTone {
  if (value >= 70) return "positive";
  if (value >= 50) return "attention";
  return "negative";
}

function passTone(rate: number): PanelTone {
  if (rate >= 75) return "positive";
  if (rate >= 50) return "attention";
  return "negative";
}

function readable(value: string): string {
  const words = value.replace(/_/g, " ").toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function insightsTab(data: Analytics): TabContent {
  const subjects = data.subjectSummaries.slice().sort((a, b) => a.passRate - b.passRate);
  const failing = subjects.filter((row) => row.passRate < 50);
  const classes = data.classSummaries.slice().sort((a, b) => a.average - b.average);
  const schoolAverage = data.classSummaries.length
    ? Math.round(
        (data.classSummaries.reduce((sum, row) => sum + row.average, 0) /
          data.classSummaries.length) *
          10,
      ) / 10
    : 0;
  const missing = data.missingScores.length;

  // The endpoint caps this list, so the page must not imply it is the total.
  const missingByClass = new Map<string, number>();
  for (const row of data.missingScores) {
    missingByClass.set(row.className, (missingByClass.get(row.className) ?? 0) + 1);
  }

  return {
    title: "Insights",
    desc: "What the term's results say, in the order worth acting on.",
    launchers: [
      { label: "Score review", href: "/score-entry-results/review" },
      { label: "Report cards", href: "/report-cards/completion" },
    ],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "The term in figures",
            per: 4,
            cards: [
              {
                label: "School average",
                value: `${schoolAverage}%`,
                sub: `Across ${data.classSummaries.length} classes`,
                tone: scoreTone(schoolAverage),
              },
              {
                label: "Subjects below 50% pass",
                value: String(failing.length),
                sub: failing.length
                  ? `Worst: ${failing[0]?.subject}`
                  : "Every subject passes half its entries",
                tone: failing.length ? "negative" : "positive",
              },
              {
                label: "Subjects measured",
                value: String(data.subjectSummaries.length),
                sub: `${data.subjectSummaries.reduce((sum, row) => sum + row.entries, 0)} score entries`,
              },
              {
                label: "Missing scores",
                value: String(missing),
                sub: missing
                  ? `Across ${missingByClass.size} classes`
                  : "Every entry accounted for",
                tone: missing ? "attention" : "positive",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          failing.length
            ? {
                type: "note",
                tone: "negative",
                title: `${failing.length} subject${failing.length === 1 ? "" : "s"} pass fewer than half the students who sat them`,
                body: `${failing
                  .slice(0, 4)
                  .map((row) => `${row.subject} (${row.passRate}%)`)
                  .join(", ")}${failing.length > 4 ? ", and others" : ""}. A pass rate this low across a whole cohort is usually the teaching or the paper, not the children — it is worth reading before the averages below, which hide it.`,
              }
            : {
                type: "note",
                tone: "positive",
                icon: CHECK_ICON,
                title: "Every subject passes at least half its entries",
                body: "No subject is failing as a cohort.",
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Subjects",
            sub: "Weakest pass rate first — the end that needs a decision.",
            meta: `${data.subjectSummaries.length} subjects`,
            head: ["Subject", "Entries", "Average", "Pass rate"],
            per: 12,
            rows: subjects.map((row) => ({
              cells: [
                text(row.subject, { strong: true }),
                text(String(row.entries)),
                text(`${row.average}%`, { tone: scoreTone(row.average) }),
                text(`${row.passRate}%`, { tone: passTone(row.passRate), strong: true }),
              ],
              keywords: row.subject,
            })),
          },
        ],
      },
      {
        cols: "1.1fr 1fr",
        panels: [
          {
            type: "bars",
            title: "Class averages",
            sub: "Weakest first.",
            rows: classes.map((row) => ({
              label: row.className,
              value: row.average,
              display: `${row.average}%`,
              sub: row.pending ? `${row.pending} pending` : undefined,
              tone: scoreTone(row.average),
            })),
          },
          {
            type: "list",
            title: "Top of the term",
            sub: "Highest average across every subject sat.",
            readOnly: true,
            items: data.topPerformers.map((row) => ({
              label: row.studentName,
              sub: `${row.className} · ${row.average}%${row.grade ? ` · grade ${row.grade}` : ""}`,
              pill: row.position ? `#${row.position}` : undefined,
              tone: "positive" as const,
            })),
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Result sheets by state",
            sub: "What has actually been published.",
            head: ["State", "Sheets"],
            per: 10,
            rows: data.statusBreakdown.map((row) => ({
              cells: [
                pill(readable(row.status), row.status.toUpperCase() === "PUBLISHED" ? "positive" : "attention"),
                text(String(row.count), { strong: true }),
              ],
              keywords: row.status,
            })),
          },
        ],
      },
    ],
  };
}


type GeneratedReport = {
  id: string;
  kind: string;
  title: string;
  format: string;
  scope: string | null;
  rowCount: number | null;
  sizeBytes: number | null;
  generatedBy: string | null;
  generatedByRole: string | null;
  generatedAt: string;
};

type Compliance = {
  registration: {
    cacNumber: string | null;
    ministryApprovalNumber: string | null;
    verified: boolean;
    addressOnFile: boolean;
  };
  checks: Array<{
    label: string;
    have: number;
    need: number;
    complete: boolean;
    percent: number;
    note: string;
  }>;
};

const CHECK_ICON = "M20 6 9 17l-5-5";

function bytesLabel(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(bytes / 1000)} KB`;
}

function whenLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * M14 · Reports — what was actually produced, and by whom.
 *
 * /v1/reports streams a PDF and keeps no record of it, so the product could
 * not answer "who exported the whole student roll last term". Recording the
 * fact of a report is the point: an export of personal data that nobody can
 * account for is the gap, not the absence of a catalogue.
 */
function reportsTab(rows: GeneratedReport[]): TabContent {
  const people = new Set(rows.map((row) => row.generatedBy).filter(Boolean));
  const kinds = new Map<string, number>();
  for (const row of rows) kinds.set(readable(row.kind), (kinds.get(readable(row.kind)) ?? 0) + 1);
  const bulk = rows.filter((row) => (row.rowCount ?? 0) >= 100);

  return {
    title: "Reports",
    desc: "What has been generated out of this school's records, and by whom.",
    launchers: [{ label: "Audit log", href: "/audit-security/audit-log" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "Reports produced",
            per: 4,
            cards: [
              { label: "Reports", value: String(rows.length), sub: `${kinds.size} kinds` },
              { label: "People generating", value: String(people.size), sub: "With a name against the export" },
              {
                label: "Bulk exports",
                value: String(bulk.length),
                sub: bulk.length ? "100 rows or more" : "Nothing large exported",
                tone: bulk.length ? "attention" : "positive",
              },
              {
                label: "Most recent",
                value: rows[0] ? whenLabel(rows[0].generatedAt) : "—",
                sub: rows[0]?.title ?? "nothing generated",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          bulk.length
            ? {
                type: "note",
                tone: "attention",
                title: `${bulk.length} export${bulk.length === 1 ? "" : "s"} took out 100 rows or more`,
                body: `${bulk.map((row) => `${row.title} (${row.rowCount} rows)`).join(", ")}. A bulk export of personal data leaves the system entirely — once it is a file on somebody's laptop, nothing here governs it. That is worth a name against it, which is what this page is for.`,
              }
            : {
                type: "note",
                tone: "positive",
                icon: CHECK_ICON,
                title: "No bulk export has been taken",
                body: "Nothing large has left the system.",
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          rows.length
            ? {
                type: "table",
                title: "Generated",
                sub: "Most recent first.",
                meta: `${rows.length} report${rows.length === 1 ? "" : "s"}`,
                head: ["Report", "Kind", "Format", "Rows", "Size", "By", "When"],
                per: 12,
                rows: rows.map((row) => ({
                  cells: [
                    text(row.title, { strong: true }),
                    text(readable(row.kind)),
                    pill(row.format.toLowerCase(), "neutral"),
                    text(row.rowCount === null ? "—" : row.rowCount.toLocaleString(), {
                      tone: (row.rowCount ?? 0) >= 100 ? "attention" : undefined,
                    }),
                    text(bytesLabel(row.sizeBytes)),
                    text(row.generatedBy ?? "—"),
                    text(whenLabel(row.generatedAt)),
                  ],
                  keywords: `${row.title} ${row.kind} ${row.generatedBy ?? ""}`,
                })),
              }
            : {
                type: "note",
                tone: "neutral",
                title: "No report has been generated",
                body: "Nothing has been exported out of this school's records.",
              },
        ],
      },
    ],
  };
}

/**
 * M14 · Compliance — whether this school could file a return today.
 *
 * Derived rather than modelled. A compliance table records what somebody
 * claimed; the useful question is what the records can actually support, which
 * is a different thing and the only one worth putting on a page.
 */
function complianceTab(data: Compliance): TabContent {
  const failing = data.checks.filter((check) => !check.complete);
  const registration = data.registration;
  const registrationGaps = [
    !registration.cacNumber && "CAC number",
    !registration.ministryApprovalNumber && "ministry approval",
    !registration.addressOnFile && "registered address",
    !registration.verified && "platform verification",
  ].filter(Boolean) as string[];

  return {
    title: "Compliance",
    desc: "Whether the records could support a return today.",
    launchers: [{ label: "Data protection", href: "/audit-security/data-protection" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "Readiness",
            per: 4,
            cards: [
              {
                label: "Checks passing",
                value: `${data.checks.length - failing.length} of ${data.checks.length}`,
                sub: failing.length ? "Some records are incomplete" : "Every field is on file",
                tone: failing.length ? "attention" : "positive",
              },
              {
                label: "Registration gaps",
                value: String(registrationGaps.length),
                sub: registrationGaps.length ? registrationGaps.join(" · ") : "Fully registered",
                tone: registrationGaps.length ? "negative" : "positive",
              },
              {
                label: "CAC number",
                value: registration.cacNumber ? "On file" : "Missing",
                sub: registration.cacNumber ?? "Required to operate",
                tone: registration.cacNumber ? "positive" : "negative",
              },
              {
                label: "Ministry approval",
                value: registration.ministryApprovalNumber ? "On file" : "Missing",
                sub: registration.ministryApprovalNumber ?? "Required to operate",
                tone: registration.ministryApprovalNumber ? "positive" : "negative",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          registrationGaps.length
            ? {
                type: "note",
                tone: "negative",
                title: `${registrationGaps.length} registration detail${registrationGaps.length === 1 ? " is" : "s are"} not on file`,
                body: `${registrationGaps.join(", ")}. These are asked for on every return a school files, and none of them can be derived — somebody has to enter them in School Configuration.`,
              }
            : {
                type: "note",
                tone: "positive",
                icon: CHECK_ICON,
                title: "Registration details are complete",
                body: "Everything a return asks for about the school itself is on file.",
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "What the records support",
            sub: "Each row is a field a return asks for, counted against what is held.",
            head: ["Check", "Held", "Needed", "Complete", "Why it is asked"],
            per: 12,
            rows: data.checks.map((check) => ({
              cells: [
                text(check.label, { strong: true }),
                text(check.have.toLocaleString()),
                text(check.need.toLocaleString()),
                text(`${check.percent}%`, {
                  tone: check.complete ? "positive" : check.percent >= 80 ? "attention" : "negative",
                  strong: true,
                }),
                text(check.note),
              ],
              keywords: check.label,
            })),
          },
        ],
      },
    ],
  };
}


/* ─────────── Compliance returns · the records half of this tab ─────────── */

type TrackedReturn = {
  id: string;
  name: string;
  body: string;
  period: string;
  dueOn: string;
  days: number;
  format: string;
  covers: string;
  status: string;
  filedOn: string | null;
  ownerRole: string | null;
  ready: boolean;
  blocker: string | null;
};

type ReturnsPayload = {
  stats: {
    tracked: number;
    bodies: number;
    dueSoon: number;
    blocked: number;
    ready: number;
    filed: number;
    nextDays: number | null;
  };
  returns: TrackedReturn[];
  gaps: Array<{ what: string; count: number; blocks: string; fix: string }>;
};

const RETURN_TONE: Record<string, PanelTone> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "progress",
  BLOCKED: "negative",
  FILED: "positive",
  AMENDED: "attention",
};

function returnLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function dueLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * A return reads as a record, not a report: who it goes to, by when, in what
 * format, and whether the data on file can actually produce it today.
 */
function returnDrawer(item: TrackedReturn): DrawerSpec {
  const filed = item.status === "FILED";
  return {
    kicker: `Compliance · ${item.body}`,
    title: item.name,
    sub: item.ready
      ? "Built from live data at the moment you file it."
      : "This return cannot be produced yet.",
    tone: RETURN_TONE[item.status] ?? "neutral",
    facts: [
      ["Return", item.name, item.body],
      ["Period", item.period],
      ["Due", dueLabel(item.dueOn), filed ? "Filed" : `${item.days} days`],
      ["Format", item.format, "Exactly as the recipient requires"],
      ["Covers", item.covers],
      ["Source", "Live data at the moment you generate", "Never a cached figure"],
      [
        "State",
        item.ready ? "Ready to file" : "Blocked",
        item.blocker ?? "Everything it needs is on file",
      ],
      ["Responsible", item.ownerRole ?? "Not assigned"],
      ["Kept", "Every filed return is archived", "With who filed it and when"],
    ],
    ...(filed
      ? {
          readOnly: true as const,
          readOnlyNote: "This return has been filed. A refiling is versioned; the original is never overwritten.",
        }
      : {
          mode: "commit" as const,
          commitLabel: item.ready ? "File this return" : "See what is missing",
          commitNote: item.ready
            ? "Filing records it against this school with the data it was built from."
            : `Filing is refused until the gap is closed — ${item.blocker}.`,
          commitDone: "Return filed",
          commitDoneBody: `${item.name} is recorded as filed with ${item.body}.`,
          submit: {
            endpoint: `/api/v1/governance/compliance-returns/${item.id}`,
            method: "PATCH" as const,
            body: { action: "FILE" },
          },
        }),
  };
}

function returnsRows(payload: ReturnsPayload): PanelRow[] {
  const { stats, returns, gaps } = payload;
  const blocked = returns.filter((item) => !item.ready);

  const cards: KpiCard[] = [
    { label: "Returns tracked", value: String(stats.tracked), sub: `Across ${stats.bodies} bodies` },
    {
      label: "Due within 35 days",
      value: String(stats.dueSoon),
      tone: stats.dueSoon ? "attention" : "positive",
      sub: stats.nextDays === null ? "Nothing outstanding" : `Soonest in ${stats.nextDays} days`,
    },
    {
      label: "Blocked",
      value: String(stats.blocked),
      tone: stats.blocked ? "negative" : "positive",
      sub: stats.blocked ? "Missing data on file" : "Nothing is blocked",
    },
    { label: "Ready to file", value: String(stats.ready), tone: "positive", sub: "One decision each" },
    { label: "Filed", value: String(stats.filed), tone: "positive", sub: "Archived with its evidence" },
  ];

  const rows: TableRow[] = returns.map((item) => ({
    cells: [
      nameCell(item.name, item.covers),
      text(item.body),
      text(dueLabel(item.dueOn), {
        tone: item.status === "FILED" ? "positive" : item.days <= 14 ? "negative" : item.days <= 35 ? "attention" : "neutral",
      }),
      text(item.status === "FILED" ? "—" : String(item.days), { mono: true }),
      text(item.ownerRole ?? "—"),
      pill(returnLabel(item.status), RETURN_TONE[item.status] ?? "neutral"),
      { kind: "action" as const, label: item.status === "FILED" ? "Open" : item.ready ? "File" : "What is missing", drawer: returnDrawer(item) },
    ],
    drawer: returnDrawer(item),
    keywords: `${item.body} ${item.period}`,
  }));

  const gapRows: TableRow[] = gaps.map((gap) => ({
    cells: [
      text(gap.what, { strong: true }),
      text(String(gap.count), { mono: true, tone: "negative" }),
      text(gap.blocks),
      text(gap.fix),
    ],
    keywords: gap.blocks,
  }));

  return [
    { cols: "1fr", panels: [{ type: "kpi", title: "Returns this school owes", per: 5, cards }] },
    ...(blocked.length
      ? [
          {
            cols: "1fr",
            panels: [
              {
                type: "note" as const,
                tone: "negative" as PanelTone,
                title: `${blocked.length} return${blocked.length === 1 ? "" : "s"} cannot be produced from the data on file today`,
                body: `${blocked.map((item) => `${item.name} — ${item.blocker}`).join(". ")}. None of this is a reporting problem; it is missing data, and it is fixable now rather than the week the return is due.`,
                acts: [
                  { label: "Fix the record gaps", href: "/student-records/registry" },
                  { label: "Fix the staff gaps", href: "/staff-access/directory" },
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
          title: "Compliance returns",
          tag: `${stats.tracked} tracked`,
          sub: "Each one names its recipient, its deadline, its format and whether it can be produced today.",
          meta: `${stats.tracked} returns · ${stats.filed} filed · ${stats.blocked} blocked${stats.nextDays === null ? "" : ` · next due in ${stats.nextDays} days`}`,
          search: "Find a return or a body",
          head: ["Return", "Goes to", "Due", "Days", "Responsible", "State", ""],
          rows,
          per: 10,
          empty: "No return matches this filter.",
          foot: "A return is built from live data at the moment you file it, never from a cached figure — and every filed copy is archived with who produced it.",
        },
      ],
    },
    ...(gapRows.length
      ? [
          {
            cols: "1fr",
            panels: [
              {
                type: "table" as const,
                title: "What is missing before a return can be filed",
                sub: "Each row names the return it blocks, so the gap has a consequence.",
                meta: `${gaps.reduce((sum, gap) => sum + gap.count, 0)} record gaps`,
                head: ["What is missing", "Count", "Blocks", "Where to fix it"],
                rows: gapRows,
                per: 8,
                empty: "Nothing is missing.",
                foot: "A missing photograph is not a filing problem — it is a record problem that only becomes urgent the week a return is due.",
              },
            ],
          },
        ]
      : []),
  ];
}

export async function analyticsReportsLiveTab(
  tabSlug: string,
): Promise<TabContent | null | undefined> {
  if (tabSlug === "insights") {
    const data = await apiGet<Analytics>("/api/v1/academics/analytics");
    if (!data) return undefined;
    return insightsTab(data);
  }

  if (tabSlug === "reports") {
    const rows = await apiGet<GeneratedReport[]>("/api/v1/audit/reports");
    return reportsTab(rows ?? []);
  }

  if (tabSlug === "compliance") {
    const [data, tracked] = await Promise.all([
      apiGet<Compliance>("/api/v1/audit/compliance"),
      apiGet<ReturnsPayload>("/api/v1/governance/compliance-returns"),
    ]);
    if (!data) return undefined;
    const base = complianceTab(data);
    // The returns this school owes come first; the readiness checks that were
    // already here stay underneath, because they are what makes a return
    // produceable in the first place.
    return tracked
      ? {
          ...base,
          desc: "Every return this school owes, and whether it can be filed today.",
          rows: [...returnsRows(tracked), ...base.rows],
        }
      : base;
  }

  return undefined;
}
