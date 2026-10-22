import { apiGet } from "@/lib/api/server";
import type { PanelRow, TableCellKind, TableRow } from "@/lib/modules/panels";
import { pill, row, text } from "@/lib/modules/panels";

type Warning =
  | { entitled: false; why: string }
  | { entitled: true; why: string; term: { name: string; session: string } | null; counts: { flagged: number; children: number }; rows: Array<{ id: string; name: string; adm: string; arm: string; points: number; drivers: string[]; average: number | null; attendance: number | null }> };

const LOCK = "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z";

/** The plan-gated early-warning panel at the foot of Insights. A school without it is told so, and what it would get. */
export async function earlyWarningRows(): Promise<PanelRow[]> {
  const v = await apiGet<Warning>("/api/v1/analytics-reports/early-warning").catch(() => null);
  if (!v) return [];
  if (!v.entitled) {
    return [row("1fr", [{ type: "note", tone: "neutral", icon: LOCK, title: "Early warning is not part of this school’s plan", body: `${v.why} It names the children likely to fall behind this term — from attendance, results and how both are moving — with the reason for each. It turns on with a plan that includes predictive analytics.` }])];
  }
  const rows: TableRow[] = v.rows.map((entry) => ({
    keywords: `${entry.name} ${entry.adm} ${entry.arm}`,
    cells: [
      { kind: "name", name: entry.name, sub: `${entry.arm} · ${entry.adm}`, avatar: false }, pill(entry.points >= 5 ? "Act now" : "Watch", entry.points >= 5 ? "negative" : "attention"), text(entry.average === null ? "—" : String(entry.average), { mono: true }), text(entry.attendance === null ? "—" : `${entry.attendance}%`, { mono: true }), text(entry.drivers.join(" · ")),
    ] as TableCellKind[],
  }));
  return [
    row("1fr", [{
      type: "table", title: "Early warning", tag: `${v.counts.flagged} of ${v.counts.children}`, tagTone: v.counts.flagged ? "attention" : "positive",
      sub: v.term ? `${v.term.name}, ${v.term.session}. Four plain rules over attendance and results — each flagged child shows which fired. It says who may fall behind; it does not say why they should or what to do.` : "No term is current.",
      meta: `${v.counts.flagged} children flagged`, noun: "child", nounPlural: "children", search: "Find a child", head: ["Child", "Level", "Average", "Attendance", "Why"], rows, per: 10, noRowOpen: true, empty: "Nobody meets two or more of the rules right now.",
      foot: "A rule-based early warning, not a forecast model. Rules: average well below the class, below the pass mark in several subjects, low attendance, a sharp recent fall in attendance.",
    }]),
  ];
}
