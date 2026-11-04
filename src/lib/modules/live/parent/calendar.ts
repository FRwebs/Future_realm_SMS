import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import { row } from "@/lib/modules/panels";
import type { DrawerSpec, ListItem, Panel, PanelFact, PanelRow, PanelTone } from "@/lib/modules/panels";
import { PW, absolute, dDow, dShort, dayOf } from "@/lib/modules/live/parent/shared";
import type { ParentContent } from "@/lib/modules/live/parent/shared";

type Ev = { id: string; date: string; end: string; title: string; cat: string; time: string; where: string; note: string; kids: Array<{ id: string; first: string }> };
type Calendar = { today: string; term: { name: string; start: string; end: string } | null; events: Ev[] };

const TABS = ["Month", "List"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const TONE: Record<string, PanelTone> = { Assessment: "attention", Holiday: "offline", Meeting: "progress", Fees: "negative", Trip: "submitted", Results: "positive", Event: "progress", Term: "neutral", Notice: "negative" };
const WHEN = [["up", "Coming up"], ["past", "Earlier"], ["all", "Whole term"]] as const;

const sameDay = (event: Ev, day: string) => day >= event.date && day <= event.end;
const rangeText = (event: Ev) => (event.end !== event.date ? `${dShort(event.date)} – ${dShort(event.end)}` : dDow(event.date));

export function item(event: Ev, withChild: boolean): ListItem {
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

export const loadCalendar = (child: string) => apiGet(`${PW}/calendar?child=${encodeURIComponent(child)}`, observe<Calendar>(localContracts["src/lib/modules/live/parent/calendar.ts#2c4d6a3a"]));

export async function calendarPage(child: string, query: Record<string, string | undefined>): Promise<ParentContent> {
  const [data, link] = await Promise.all([
    loadCalendar(child),
    apiGet(`${PW}/calendar-link`, observe<{ path: string }>(localContracts["src/lib/modules/live/parent/calendar.ts#7f3a91c2"])).catch(() => null),
  ]);
  const feed = link ? await absolute(link.path) : null;
  const phone: DrawerSpec | null = feed ? {
    kicker: "Calendar", title: "Add to my phone’s calendar", mode: "info", sub: "A private link that keeps your phone’s calendar up to date by itself.",
    facts: [
      ["Your link", feed, "Anyone who has it can read your family’s calendar, so keep it to yourself."],
      ["How to add it", "Subscribe to a calendar from a link", "In Google Calendar: Other calendars → From URL. On an iPhone: Settings → Calendar → Accounts → Add Subscribed Calendar."],
      ["What it shows", "School events, tests and examinations, results days, meetings and when fees fall due — for every child", "New ones appear on their own; your phone refreshes it every few hours."],
    ],
  } : null;
  const replace: DrawerSpec = {
    kicker: "Calendar", title: "Get a new calendar link", mode: "commit", sub: "The old link stops working at once. Use this if you shared it, or lost the phone it was on.",
    commitLabel: "Replace the link", commitDone: "New link ready", commitDoneBody: "Open “Add to my phone’s calendar” for the new link, and add it to your phone again.",
    submit: { endpoint: `${PW}/calendar-link/reset`, method: "POST" },
  };
  const events = data.events;
  const tab = TABS.includes(query.tab ?? "") ? query.tab! : TABS[0]!;
  const one = child === "all" ? null : events.flatMap((event) => event.kids).find((kid) => kid.id === child) ?? null;
  const head = {
    eyebrow: one ? one.first : "Whole family", title: "Calendar",
    tabs: TABS.map((label) => ({ label })), tab,
    desc: "Term dates, tests, trips and meetings.",
    ...(phone ? { primary: { label: "Add to my phone’s calendar", drawer: phone }, launchers: [{ label: "Get a new link", drawer: replace }] } : {}),
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
        weekend,
        ...(on.length ? { drawer: { kicker: "Calendar", title: dDow(day), mode: "view" as const, readOnly: true, sub: `${on.length} on this day`, facts: on.flatMap((event): PanelFact[] => [[event.title, [event.cat, event.time].filter(Boolean).join(" · "), [event.where, event.kids.length < 2 ? "" : event.kids.map((kid) => kid.first).join(" and ")].filter(Boolean).join(" · ")]]) } satisfies DrawerSpec } : {}),
      };
    }),
  ];
  const inMonth = (month: string) => events.filter((event) => event.date.slice(0, 7) <= month && event.end.slice(0, 7) >= month);
  const monthEvents = inMonth(wanted);
  const phoneOnly = (panel: Panel): PanelRow => ({ ...row("1fr", [panel]), show: "phone" as const });
  return {
    ...head,
    phoneEyebrow: one ? one.first : "Whole family", phoneTitle: `${MONTHS[monthIndex]} ${year}`, phoneDesc: "",
    rows: [
      // The phone reads the month as chips with how much is in each, the grid, and then the month's events under their own heading.
      phoneOnly({ type: "embed", component: "phone-chips", props: { chips: chips.map((month) => ({ label: MONTHS[Number(month.slice(5)) - 1]!, href: `${base}month=${month}`, on: month === wanted, count: inMonth(month).length || undefined })) } }),
      row("1fr", [{
      type: "calendar", title: `${MONTHS[monthIndex]} ${year}`, sub: "Tap a day to see what is on it.", per: 7,
      dow: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      acts: chips.map((month) => ({ label: MONTHS[Number(month.slice(5)) - 1]!.slice(0, 3), href: `${base}month=${month}`, on: month === wanted })),
      legend: [{ label: "Tests and exams", tone: "attention" }, { label: "Meetings", tone: "progress" }, { label: "Results", tone: "positive" }, { label: "Fees", tone: "negative" }, { label: "Holidays", tone: "offline" }],
      cells,
    }]),
      phoneOnly({
        type: "list", noFind: true, title: `All of ${MONTHS[monthIndex]}`, empty: "Nothing is on the calendar this month.",
        items: monthEvents.map((event) => item(event, child === "all")),
      }),
    ],
  };
}
