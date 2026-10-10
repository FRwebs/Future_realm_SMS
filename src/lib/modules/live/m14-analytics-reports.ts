import { apiGet } from "@/lib/api/server";
import {
  pill,
  text,
  type PanelTone,
  type TabContent,
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

const CHECK_ICON = "M20 6 9 17l-5-5";

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

export async function analyticsReportsLiveTab(
  tabSlug: string,
): Promise<TabContent | null | undefined> {
  if (tabSlug === "insights") {
    const data = await apiGet<Analytics>("/api/v1/academics/analytics");
    if (!data) return undefined;
    return insightsTab(data);
  }

  // Reports and Compliance stay authored. Reports is a catalogue of generated
  // exports and nothing persists a generated report — /v1/reports streams a PDF
  // on request and keeps no record of it. Compliance wants regulator-facing
  // returns that this stack does not model.
  return undefined;
}
