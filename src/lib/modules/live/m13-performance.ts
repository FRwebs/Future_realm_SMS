import { apiGet } from "@/lib/api/server";
import { HUB } from "@/lib/modules/live/m13-forms";
import type { PerformanceData } from "@/lib/modules/live/m13-types";
import { plural } from "@/lib/modules/live/m7-format";
import { name as nameCell, text, type PanelRow, type PanelTone, type TabContent, type TableRow } from "@/lib/modules/panels";

/** Performance — are decisions actually being made? Time to a decision, never a score or a rating. */

export const loadPerformance = () => apiGet<PerformanceData>(`${HUB}/performance`);

const DOWNLOAD = "M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 19.5h15";
const speed = (days: number | null): PanelTone | undefined => (days === null ? undefined : days >= 4 ? "negative" : days >= 2 ? "attention" : "positive");
const dayText = (days: number | null) => (days === null ? "—" : `${days} ${days === 1 ? "day" : "days"}`);

export function performanceTab(d: PerformanceData): TabContent {
  const k = d.kpis;
  const trend = k.previousAvgDays === null || k.avgDays === null ? "No earlier session to compare with" : k.avgDays <= k.previousAvgDays ? `Down from ${dayText(k.previousAvgDays)} last session` : `Up from ${dayText(k.previousAvgDays)} last session`;
  const rows: PanelRow[] = [];
  rows.push({
    cols: "1fr",
    panels: [{
      type: "kpi", title: "How decisions are going", sub: d.session, per: 4,
      cards: [
        { label: "Decided this session", value: String(k.decided), sub: `Across ${plural(k.types, "approval type")}`, tone: "positive" },
        { label: "Outstanding", value: String(k.outstanding), sub: `${k.waitingOnMe} waiting on you · ${k.escalated} escalated`, tone: k.outstanding ? "attention" : "positive", link: "Open the queue", href: "/approvals-workflow/queue" },
        { label: "Average time to decide", value: dayText(k.avgDays), sub: trend, tone: speed(k.avgDays) ?? "neutral" },
        { label: "Blocked work", value: String(k.blocked), unit: k.blocked === 1 ? "decision" : "decisions", sub: k.blockedText || "Nothing is held up", tone: k.blocked ? "negative" : "positive", link: k.blocked ? "See what is blocked" : undefined, href: k.blocked ? "/approvals-workflow/queue" : undefined },
      ],
    }],
  });
  const approvers: TableRow[] = d.approvers.map((row) => ({
    keywords: `${row.name} ${row.role}`,
    cells: [nameCell(row.name, `${row.role}${row.you ? " · you" : ""}`), text(String(row.decided), { mono: true, strong: true }), text(String(row.open), { mono: true }), text(row.oldest === null ? "—" : dayText(row.oldest), { tone: row.oldest !== null && row.oldest > 10 ? "negative" : row.oldest !== null && row.oldest > 5 ? "attention" : undefined, strong: row.oldest !== null && row.oldest > 5 }), text(dayText(row.avgDays), { tone: speed(row.avgDays) }), text(String(row.escalated), { mono: true, tone: row.escalated ? "negative" : undefined })],
  }));
  rows.push({
    cols: "1fr",
    panels: [{
      type: "table", title: "By approver", sub: "Time to decision, never a score or a rating.", meta: d.term || d.session,
      head: ["Approver", "Decided", "Open to them", "Oldest", "Average time", "Escalated past them"], noun: "approver", nounPlural: "approvers", noRowOpen: true,
      acts: [{ label: "Export for review", export: true }], rows: approvers, empty: "Nobody has decided anything this session yet.",
      foot: "“Open to them” is what the routes let each person decide today. Where a role is shared, each of them is counted.",
    }],
  });
  rows.push({
    cols: "1fr 1fr",
    panels: [
      {
        type: "bars", title: "By type · which categories move and which stall", sub: "Average days to decision this session.",
        rows: d.byType.slice().sort((a, b) => (b.avgDays ?? 0) - (a.avgDays ?? 0)).map((row) => ({ label: row.name, value: row.pct, display: dayText(row.avgDays), sub: `${plural(row.count, "decision")} · escalates after ${plural(row.escalateDays, "day")}`, tone: speed(row.avgDays) })),
        foot: d.byType.length ? undefined : "Nothing has been decided this session, so no category has a time yet.",
      },
      {
        type: "list", title: "By requester", sub: "Who has had decisions sent back, and why.",
        items: d.requesters.map((row) => ({ label: `${row.name} · ${row.returned} of ${row.total} returned`, sub: row.returned ? (row.reason ? `“${row.reason}”` : "No reason was recorded") : "Nothing returned this session", pill: `${row.pct}% returned`, tone: row.pct >= 30 ? ("attention" as const) : ("positive" as const) })),
        foot: d.requesters.length ? undefined : "Nobody has had a decision made on something they raised yet.",
      },
    ],
  });
  return { title: "Performance", desc: "Are decisions actually being made?", primary: { label: "Export for review", icon: DOWNLOAD, href: "/approvals-workflow/performance/export" }, launchers: [{ label: "Open the queue", href: "/approvals-workflow/queue" }, { label: "See the routes", href: "/approvals-workflow/workflow" }], rows };
}
