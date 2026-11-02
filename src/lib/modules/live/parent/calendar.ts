import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import { row } from "@/lib/modules/panels";
import type { DrawerSpec, ListItem, PanelFact, PanelTone } from "@/lib/modules/panels";
import { PW, dDow, dShort, dayOf } from "@/lib/modules/live/parent/shared";
import type { ParentContent } from "@/lib/modules/live/parent/shared";

type Ev = { id: string; date: string; end: string; title: string; cat: string; time: string; where: string; note: string; kids: Array<{ id: string; first: string }> };
type Calendar = { today: string; term: { name: string; start: string; end: string } | null; events: Ev[] };

const TABS = ["Month", "List"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const TONE: Record<string, PanelTone> = { Assessment: "attention", Holiday: "offline", Meeting: "progress", Fees: "negative", Trip: "submitted", Results: "positive", Event: "progress", Term: "neutral", Notice: "negative" };
const WHEN = [["up", "Coming up"], ["past", "Earlier"], ["all", "Whole term"]] as const;

const sameDay = (event: Ev, day: string) => day >= event.date && day <= event.end;
const rangeText = (event: Ev) => (event.end !== event.date ? `${dShort(event.date)} – ${dShort(event.end)}` : dDow(event.date));

function item(event: Ev, withChild: boolean): ListItem {
  const date = dayOf(event.date);
  const tone = TONE[event.cat] ?? "neutral";
  return {
    lead: { top: MONTHS[date.getUTCMonth()]!.slice(0, 3).toUpperCase(), value: String(date.getUTCDate()), tone },
    label: `${event.title}${withChild && event.kids.length === 1 ? ` · ${event.kids[0]!.first}` : ""}`,
    sub: [rangeText(event), event.time, event.where].filter(Boolean).join(" · "), pill: event.cat, tone,
    ...(event.note ? { drawer: eventDrawer(event) } : {}),
  };
}

function eventDrawer(event: Ev): DrawerSpec {
  const facts: PanelFact[] = [
    ["When", rangeText(event), event.time], ...(event.where ? [["Where", event.where] as PanelFact] : []),
    ...(event.kids.length ? [["For", event.kids.map((kid) => kid.first).join(" and ")] as PanelFact] : []),
    ...(event.note ? [["Note", event.note] as PanelFact] : []),
  ];
  return { kicker: event.cat, title: event.title, mode: "view", readOnly: true, facts };
}

export async function calendarPage(child: string, query: Record<string, string | undefined>): Promise<ParentContent> {
  const data = await apiGet(`${PW}/calendar?child=${encodeURIComponent(child)}`, observe<Calendar>(localContracts["src/lib/modules/live/parent/calendar.ts#2c4d6a3a"]));
  const events = data.events;
  const tab = TABS.includes(query.tab ?? "") ? query.tab! : TABS[0]!;
  const one = child === "all" ? null : events.flatMap((event) => event.kids).find((kid) => kid.id === child) ?? null;
  const head = {
    eyebrow: one ? one.first : "Whole family", title: "Calendar",
    tabs: TABS.map((label) => ({ label })), tab,
    desc: "Term dates, tests, trips and meetings.",
  };
  const base = `/portals/parent/calendar?${child === "all" ? "" : `child=${child}&`}`;

  if (tab === TABS[1]) {
    const when = WHEN.some(([key]) => key === query.when) ? query.when! : "up";
    const shown = events.filter((event) => (when === "all" ? true : when === "up" ? event.end >= data.today : event.end < data.today));
    const ordered = when === "past" ? [...shown].reverse() : shown;
    return {
      ...head,
      rows: [row("1fr", [{
        type: "list", title: { up: "Coming up", past: "Earlier this term", all: "The whole term" }[when]!,
        sub: `${shown.length} ${shown.length === 1 ? "event" : "events"} · ${when === "past" ? "most recent first" : "in date order"}.`,
        acts: WHEN.map(([key, label]) => ({ label: key === when ? `${label} ·` : label, href: `${base}tab=List&when=${key}` })),
        empty: "Nothing matches.", items: ordered.map((event) => item(event, child === "all")),
      }])],
    };
  }

  // The month: the one asked for, else this one.
  const wanted = /^\d{4}-\d{2}$/.test(query.month ?? "") ? query.month! : data.today.slice(0, 7);
  const year = Number(wanted.slice(0, 4));
  const monthIndex = Number(wanted.slice(5)) - 1;
  const last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() + 6) % 7;
  const chips = [...new Set([data.today.slice(0, 7), ...events.flatMap((event) => [event.date.slice(0, 7), event.end.slice(0, 7)])])].sort().slice(0, 8);
  const cells = [
    ...Array.from({ length: lead }, () => ({ label: "", blank: true })),
    ...Array.from({ length: last }, (_, index) => {
      const day = `${wanted}-${String(index + 1).padStart(2, "0")}`;
      const on = events.filter((event) => sameDay(event, day));
      const weekend = [0, 6].includes(dayOf(day).getUTCDay());
      return {
        label: String(index + 1),
        note: on.length ? `${on[0]!.title}${on.length > 1 ? ` +${on.length - 1}` : ""}` : weekend ? "" : "",
        tone: on.length ? TONE[on[0]!.cat] ?? "neutral" : undefined,
        today: day === data.today,
        ...(on.length ? { drawer: { kicker: "Calendar", title: dDow(day), mode: "view" as const, readOnly: true, sub: `${on.length} on this day`, facts: on.flatMap((event): PanelFact[] => [[event.title, [event.cat, event.time].filter(Boolean).join(" · "), [event.where, event.kids.length < 2 ? "" : event.kids.map((kid) => kid.first).join(" and ")].filter(Boolean).join(" · ")]]) } satisfies DrawerSpec } : {}),
      };
    }),
  ];
  return {
    ...head,
    rows: [row("1fr", [{
      type: "calendar", title: `${MONTHS[monthIndex]} ${year}`, sub: "Tap a day to see what is on it.", per: 7,
      dow: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      acts: chips.map((month) => ({ label: MONTHS[Number(month.slice(5)) - 1]!.slice(0, 3), href: `${base}month=${month}`, on: month === wanted })),
      legend: [{ label: "Tests and exams", tone: "attention" }, { label: "Meetings", tone: "progress" }, { label: "Results", tone: "positive" }, { label: "Fees", tone: "negative" }, { label: "Holidays", tone: "offline" }],
      cells,
    }])],
  };
}
