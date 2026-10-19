import { apiGet } from "@/lib/api/server";
import { AR } from "@/lib/modules/live/m14-forms";
import type { Insights } from "@/lib/modules/live/m14-types";
import { plural } from "@/lib/modules/live/m7-format";
import { text, type PanelRow, type PanelTone, type TabContent } from "@/lib/modules/panels";

/** Insights — four segments: academic, attendance, financial, engagement. Every figure read from the school's own records. */

export const loadInsights = () => apiGet<Insights>(`${AR}/insights`);

const DOWNLOAD = "M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 19.5h15";
const CHART = "M3.5 20.5h17M7 20.5v-6M11.6 20.5V8.5M16.2 20.5v-9M20.5 20.5V5.5";
const naira = (value: number) => (value >= 1_000_000 ? `₦${(value / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}m` : `₦${Math.round(value).toLocaleString("en-NG")}`);
const move = (value: number | null, unit = "") => (value === null ? null : `${value > 0 ? "Up" : value < 0 ? "Down" : "Level"} ${Math.abs(value)}${unit}`);
const gradeTone = (index: number, total: number): PanelTone => (index <= 1 ? "positive" : index === total - 1 ? "negative" : index >= total - 2 ? "attention" : "progress");
const rateTone = (rate: number | null): PanelTone => (rate === null ? "neutral" : rate >= 94 ? "positive" : rate >= 90 ? "attention" : "negative");

export function insightsTab(d: Insights): TabContent {
  const k = d.kpis;
  const prev = d.term?.previous ? ` from ${d.term.previous}` : "";
  const rows: PanelRow[] = [];
  rows.push({
    cols: "1fr",
    panels: [{
      type: "kpi", per: 5,
      cards: [
        { label: "School average", value: k.average === null ? "—" : String(k.average), sub: k.average === null ? "No result has been computed yet" : `${k.averageMove === null ? "No earlier term to compare" : `${move(k.averageMove)}${prev}`} · using this school's own bands`, tone: k.averageMove === null ? "neutral" : k.averageMove >= 0 ? "positive" : "attention" },
        { label: "Attendance", value: k.attendance === null ? "—" : `${k.attendance}%`, sub: k.attendance === null ? "No register has been marked this term" : k.attendanceMove === null ? "No earlier term to compare" : `${move(k.attendanceMove)}${prev}`, tone: k.attendance === null ? "neutral" : k.attendanceMove !== null && k.attendanceMove < 0 ? "attention" : "positive" },
        { label: "Collection rate", value: k.collection === null ? "—" : `${k.collection}%`, sub: k.collection === null ? "Nothing has been billed" : `${naira(k.billed)} billed${k.collectionMove === null ? "" : ` · ${move(k.collectionMove, " points")}`}`, tone: k.collection === null ? "neutral" : k.collection >= 75 ? "positive" : "attention" },
        { label: "Portal activation", value: `${k.portal.activated} of ${k.portal.guardians}`, sub: `${k.portal.pct ?? 0}% of families · ${k.portal.never} never activated`, tone: (k.portal.pct ?? 0) >= 80 ? "positive" : "attention" },
        { label: "Net enrolment growth", value: `${k.growth.net > 0 ? "+" : ""}${k.growth.net}`, sub: `${k.growth.admitted} admitted · ${k.growth.left} withdrawn this term`, tone: k.growth.net >= 0 ? "positive" : "attention" },
      ],
    }],
  });
  const fail = d.failing;
  const best = d.correlation[0];
  const next = d.correlation[1];
  rows.push({
    cols: "1.15fr 1fr",
    panels: [
      {
        type: "bars", title: "Academic · grade distribution", sub: `${d.scheme || "The school's own bands"} — not a generic scale.`,
        rows: d.grades.map((band, index) => ({ label: `${band.label} · ${band.remark} · ${band.min}–${band.max}`, value: band.pct, display: plural(band.count, "student"), tone: gradeTone(index, d.grades.length) })),
        foot: fail && fail.count ? `${fail.label}: ${fail.count} ${fail.count === 1 ? "student" : "students"} (${fail.pct}% of those with a computed result).` : d.grades.length ? undefined : "No grading scheme is set up for this school.",
      },
      {
        type: "note", tone: best?.average !== null && next?.average !== null && best?.average !== undefined && (best.average ?? 0) > ((next?.average ?? 0)) ? "positive" : "neutral", icon: CHART,
        title: "Attendance and performance",
        body: d.correlation.some((bucket) => bucket.students) ? d.correlation.filter((bucket) => bucket.students).map((bucket) => `Students at ${bucket.label.toLowerCase()} attendance average ${bucket.average} (${plural(bucket.students, "student")})`).join(". ") + ". Read it with the weekday pattern below." : "There are not yet attendance marks and results for the same children to compare.",
        acts: [{ label: "See students below 75%", href: "/attendance/compliance" }, { label: "Open the registers", href: "/attendance/register" }],
      },
    ],
  });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "table", title: "Academic · subject comparison", sub: "Difficulty, pass and credit rates, and movement against the last term.", meta: `${plural(d.subjects.length, "examinable subject")} · every arm together`,
      head: ["Subject", "Average", "Difficulty", "Pass rate", "Credit", "Movement", "Teaching insight"], noun: "subject", nounPlural: "subjects", per: 7, noRowOpen: true, search: "Find a subject",
      rows: d.subjects.map((subject) => ({ keywords: subject.name, cells: [text(subject.name, { strong: true }), subject.average === null ? text("No data", { tone: "negative", strong: true }) : text(String(subject.average), { mono: true }), subject.difficulty ? text(subject.difficulty) : text("—"), subject.pass === null ? text("—") : text(`${subject.pass}%`, { mono: true }), subject.credit === null ? text("—") : text(`${subject.credit}%`, { mono: true }), subject.movement === null ? text("—") : text(`${subject.movement > 0 ? "+" : subject.movement < 0 ? "−" : ""}${Math.abs(subject.movement)}`, { tone: subject.movement >= 0 ? "positive" : "attention", strong: true }), text(subject.insight)] })),
      empty: "No scores have been entered this term.",
    }],
  });
  const f = d.financial;
  const e = d.engagement;
  rows.push({
    cols: "1fr 1fr 1fr",
    panels: [
      {
        type: "bars", title: "Attendance & enrolment", sub: "By weekday — the pattern a school can actually act on.",
        rows: d.weekdays.map((day) => ({ label: day.label, value: day.rate ?? 0, display: day.rate === null ? "—" : `${day.rate}%`, tone: rateTone(day.rate), sub: day.rate !== null && day.rate === Math.min(...d.weekdays.map((entry) => entry.rate ?? 101)) ? "The weakest day this term" : undefined })),
      },
      {
        type: "list", title: "Financial", sub: "Ageing, exposure and what is still to come in.",
        items: [
          { label: "Billed and outstanding", sub: `${naira(f.outstanding)} still owed of ${naira(f.billed)} billed across the school`, pill: f.billed ? `${Math.round(((f.billed - f.outstanding) / f.billed) * 100)}%` : "—" },
          { label: "Ageing · past 90 days", sub: f.aged ? `${naira(f.aged)} across ${plural(f.agedFamilies, "family", "families")} · the hardest money to recover` : "Nothing is overdue by more than 90 days", pill: f.aged ? naira(f.aged) : "Clear", tone: f.aged ? ("attention" as const) : ("positive" as const) },
          { label: "Discount exposure", sub: `${naira(f.discounts)} given through ${plural(f.discountRules, "kind")} of adjustment${f.discountPct === null ? "" : ` · ${f.discountPct}% of what was billed`}`, pill: f.discountPct === null ? "—" : `${f.discountPct}%` },
          { label: "Income against expense", sub: "Expense figures are entered by the school, not computed from these records", pill: "Not kept" },
        ],
      },
      {
        type: "list", title: "Engagement", sub: "Portal, delivery and who cannot be reached.",
        items: [
          { label: "Portal sign-ins", sub: `${e.signedIn30} of ${e.activated} activated families signed in during the last 30 days`, pill: e.signedInPct === null ? "—" : `${e.signedInPct}%` },
          ...e.channels.map((channel) => ({ label: `Messages by ${channel.channel.toLowerCase()}`, sub: `${channel.sent} of ${channel.total} marked sent — a queued message has not left the system`, pill: channel.total ? `${Math.round((channel.sent / channel.total) * 100)}%` : "—" })),
          { label: "Announcement acknowledgement", sub: "Nothing records who read an announcement, so this is not measured", pill: "Not kept" },
          { label: "Unreachable families", sub: e.unreachable ? `${e.worst ? `${e.worst.arm} has ${e.worst.count} of the ${e.unreachable}` : `${e.unreachable} have no phone consent and no portal account`}` : "Every primary guardian can be reached", pill: String(e.unreachable), tone: e.unreachable ? ("attention" as const) : ("positive" as const) },
        ],
      },
    ],
  });
  return { title: "Insights", desc: "Four segments: academic, attendance, financial, engagement.", primary: { label: "Export board", icon: DOWNLOAD, href: `${AR}/reports/generate/standard/term-performance` }, launchers: [{ label: "Reports", href: "/analytics-reports/reports" }, { label: "Compliance", href: "/analytics-reports/compliance" }], rows };
}
