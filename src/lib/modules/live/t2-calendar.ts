import { apiGet } from "@/lib/api/server";
import type { PanelFact, PanelTone, TabContent, TableRow } from "@/lib/modules/panels";
import { pill, row, text } from "@/lib/modules/panels";

/**
 * M02 for a teaching person: the school calendar, read-only, with every date said in terms of their own work. Every deadline a
 * teacher has is driven by these dates — set once by the school, never typed for them.
 */

type CalendarView = {
  term: { name: string; order: number; of: number; startsOn: string; endsOn: string; week: number; weeks: number; schoolDaysSoFar: number; session: string };
  window: { label: string; closes: string; daysLeft: number; opens: string } | null;
  release: { date: string; daysAway: number } | null;
  closedAhead: { days: number; label: string | null; from: string | null; to: string | null };
  dates: Array<{ from: string; to: string | null; what: string; kind: "Assessment" | "Closed" | "Event" | "Deadline" | "Attention"; means: string; days: number }>;
  early: boolean;
  rules: { cutoff: string; components: Array<{ name: string; max: number }>; bandRange: { top: string; bottom: string; scheme: string } | null; schoolDays: boolean };
};

const DOWNLOAD = "M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 19.5h15";
const ORDINAL = ["", "First", "Second", "Third", "Fourth"];

const fmt = (value: string, long = false) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: long ? "long" : "short", timeZone: "UTC" }).format(new Date(value));
const span = (from: string, to: string | null) => (to && to !== from ? `${fmt(from)} – ${fmt(to)}` : fmt(from));
const tone = (kind: string): PanelTone => (kind === "Attention" ? "attention" : kind === "Closed" ? "neutral" : kind === "Assessment" ? "progress" : "submitted");

export async function teacherCalendarTab(tabSlug: string): Promise<TabContent | null | undefined> {
  if (tabSlug !== "calendar") return undefined;
  const c = await apiGet<CalendarView>("/api/v1/teacher-workspace/calendar");
  const t = c.term;

  const rows: TableRow[] = c.dates.map((entry) => ({
    cells: [text(span(entry.from, entry.to), { strong: true }), text(entry.what, { strong: entry.kind === "Attention" }), pill(entry.kind, tone(entry.kind)), text(entry.means, { tone: "neutral" })],
    keywords: `${entry.kind} ${entry.from}`,
  }));

  const facts: PanelFact[] = [
    ["Register cutoff", c.rules.cutoff, "An unmarked register notifies you, then the Principal"],
    c.early
      ? ["Early years assessment", "Seven learning areas", "Described, never scored"]
      : ["Assessment components", c.rules.components.length ? c.rules.components.map((column) => `${column.name} /${column.max}`).join(" · ") : "Not set yet", "Pinned to the sheet you enter against"],
    ...(c.early ? [] : [["Grading scale", c.rules.bandRange ? `${c.rules.bandRange.top} – ${c.rules.bandRange.bottom}` : "Not set yet", "Visible to you, adjustable by nobody but the school"] as PanelFact]),
    ["A late submission", "Needs the school to reopen the window", "After the window closes, entry is locked"],
  ];

  return {
    title: "School Calendar", desc: "Every deadline you have is driven by these dates.",
    primary: { label: "Add to my phone calendar", icon: DOWNLOAD, href: "/api/v1/teacher-workspace/calendar/export" },
    rows: [
      row("1fr", [{
        type: "kpi", sub: `${t.name} ${t.session} · set by the school, read-only to every staff role.`, per: 5,
        cards: [
          { label: "Term", value: ORDINAL[t.order] ?? String(t.order), unit: `of ${t.of}`, sub: `${fmt(t.startsOn)} – ${fmt(t.endsOn)}` },
          { label: "Week", value: String(t.week), unit: `of ${t.weeks}`, sub: `${t.schoolDaysSoFar} school day${t.schoolDaysSoFar === 1 ? "" : "s"} so far` },
          c.window
            ? { label: c.early ? "Observation window" : "Score window", value: c.window.daysLeft ? `${c.window.daysLeft} day${c.window.daysLeft === 1 ? "" : "s"} left` : "Closes today", sub: `Closes ${fmt(c.window.closes, true)}`, tone: "attention" as const }
            : { label: c.early ? "Observation window" : "Score window", value: "None", sub: "No window is set for this term" },
          c.release
            ? { label: "Report cards published", value: fmt(c.release.date), sub: c.release.daysAway > 0 ? `${c.release.daysAway} days away` : "Published", tone: "progress" as const }
            : { label: "Report cards published", value: "Not set", sub: "The school has not set a publication date" },
          { label: "Closed days ahead", value: String(c.closedAhead.days), sub: c.closedAhead.label ? `${c.closedAhead.label}${c.closedAhead.from ? ` · ${span(c.closedAhead.from, c.closedAhead.to)}` : ""}` : "None before the term ends" },
        ],
      }]),
      row("1.3fr 1fr", [
        {
          type: "table", title: "Key dates", sub: "What each one means for your own work.", meta: `${c.dates.length} dates · yours are included`, noun: "date", nounPlural: "dates",
          search: "Find a date or an event", filters: [{ label: "Kind", value: "All", options: ["All", "Assessment", "Closed", "Event", "Deadline", "Attention"], column: 2 }],
          head: ["Date", "What", "Kind", "What it means for you"], rows, per: 10, noRowOpen: true, empty: "The school has not put any dates on this term’s calendar yet.", foot: "Nothing on this page is editable by any staff role.",
        },
        { type: "facts", title: "The rules your deadlines run on", sub: "Set once by the school, visible so you can plan.", per: 1, facts },
      ]),
    ],
  };
}
