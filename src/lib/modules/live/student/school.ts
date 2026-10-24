import type { CalEvent, Message } from "@/lib/modules/live/student/shared";
import { headers } from "next/headers";

import { apiGet } from "@/lib/api/server";
import { SW } from "@/lib/api/student-workspace";
import { addDays, askDrawer, dShort, loadAskable, loadAssignments, loadAttendance, loadCalendar, loadMe, loadMessages, MONTHS } from "@/lib/modules/live/student/shared";
import type { StudentContent } from "@/lib/modules/live/student/shared";
import type { DrawerSpec, ListItem } from "@/lib/modules/panels";
import { row } from "@/lib/modules/panels";
import { eventItem } from "@/lib/modules/live/student/today";

/* ───────────────────────── calendar ───────────────────────── */

/** The address a phone is given. It is built from the address this page was opened at, so it works wherever the school is hosted. */
async function absolute(path: string): Promise<string> {
  try {
    const list = await headers();
    const host = list.get("x-forwarded-host") ?? list.get("host");
    const proto = list.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
    return host ? `${proto}://${host}${path}` : path;
  } catch {
    return path;
  }
}

export async function calendarPage(query: Record<string, string | undefined>): Promise<StudentContent> {
  const [me, cal, work, link] = await Promise.all([loadMe(), loadCalendar(), loadAssignments(), apiGet<{ path: string }>(`${SW}/calendar-link`).catch(() => null)]);
  const feed = link ? await absolute(link.path) : null;
  const phone: DrawerSpec | null = feed ? {
    kicker: "Calendar", title: "Add to my phone’s calendar", mode: "info", sub: "A private link that keeps your phone’s calendar up to date by itself.",
    facts: [
      ["Your link", feed, "Anyone who has it can read your calendar, so keep it to yourself."],
      ["How to add it", "Subscribe to a calendar from a link", "In Google Calendar: Other calendars → From URL. On an iPhone: Settings → Calendar → Accounts → Add Subscribed Calendar."],
      ["What it shows", "School events, your tests and examinations, and when each piece of work is due", "New ones appear on their own; your phone refreshes it every few hours."],
    ],
  } : null;
  const replace: DrawerSpec = {
    kicker: "Calendar", title: "Get a new calendar link", mode: "commit", sub: "The old link stops working at once. Use this if you shared it, or lost the phone it was on.",
    commitLabel: "Replace the link", commitDone: "New link ready", commitDoneBody: "Open “Add to my phone’s calendar” for the new link, and add it to your phone again.",
    submit: { endpoint: `${SW}/calendar-link/reset`, method: "POST" },
  };
  const tabs = [{ label: "Month" }, { label: "List" }];
  const tab = tabs.some((entry) => entry.label === query.tab) ? query.tab! : "Month";
  const dues: CalEvent[] = work.items.filter((item) => item.state === "todo" || item.state === "overdue").map((item) => ({ id: `due-${item.id}`, date: item.due, end: item.due, title: `${item.subject} due · ${item.title}`, cat: "Due", time: "", where: "", note: "" }));
  const all = [...cal.events, ...dues].sort((a, b) => a.date.localeCompare(b.date));
  const head = { eyebrow: me.term ? `${me.term.name} ${me.term.session}` : me.school, title: "Calendar", desc: "School events, tests and the dates your work is due.", tabs, tab, launchers: phone ? [{ label: "Add to my phone’s calendar", drawer: phone }, { label: "Get a new link", drawer: replace }] : [] };

  if (tab === "List") {
    const ahead = all.filter((event) => event.end >= me.today);
    return {
      ...head,
      rows: [row("1fr", [{
        type: "list", title: "From today", sub: "Everything ahead this term, in date order.", empty: "Nothing is on the calendar yet.",
        items: ahead.map((event): ListItem => (event.cat === "Due" ? { ...eventItem(event, "/portals/student/assignments"), href: "/portals/student/assignments" } : eventItem(event))),
      }])],
    };
  }

  const first = me.term?.start ?? me.today;
  const last = me.term?.end ?? me.today;
  const yms = new Set<string>();
  for (let cursor = `${first.slice(0, 7)}-01`; cursor.slice(0, 7) <= last.slice(0, 7); cursor = addDays(`${cursor.slice(0, 7)}-28`, 5).slice(0, 7) + "-01") yms.add(cursor.slice(0, 7));
  yms.add(me.today.slice(0, 7));
  for (const event of all) { yms.add(event.date.slice(0, 7)); }
  const months = [...yms].sort().map((ym) => ({ ym, label: `${MONTHS[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}` }));
  return {
    ...head,
    rows: [row("1fr", [{
      type: "embed", component: "student-calendar",
      props: {
        today: me.today, months, legend: [["Test or assessment", "Assessment"], ["Work due", "Due"], ["Event", "Event"], ["Results", "Results"], ["No school", "Holiday"]].map(([label, cat]) => ({ label, cat })),
        items: all.map((event) => ({ ...event, href: event.cat === "Due" ? "/portals/student/assignments" : undefined })),
      },
    }])],
  };
}

/* ───────────────────────── messages ───────────────────────── */

const whenOf = (at: string, today: string) => (at.slice(0, 10) === today ? at.slice(11, 16) : dShort(at.slice(0, 10)));

export async function messagesPage(query: Record<string, string | undefined>): Promise<StudentContent> {
  const [me, inbox, askable] = await Promise.all([loadMe(), loadMessages(), loadAskable()]);
  const received = inbox.items.filter((message) => message.cat !== "Sent");
  const unread = received.filter((message) => !message.read);
  const sent = inbox.items.filter((message) => message.cat === "Sent");
  const tabs = [{ label: "All" }, { label: "Unread", count: unread.length }, { label: "From teachers" }, { label: "School" }, { label: "Sent", count: sent.length }];
  const tab = tabs.some((entry) => entry.label === query.tab) ? query.tab! : "All";
  const shown = tab === "All" ? received : tab === "Unread" ? unread : tab === "Sent" ? sent : received.filter((message) => message.cat === tab);
  const people = (message: Message) => (askable.people.some((person) => person.id === message.fromId) ? askable.people : [{ id: message.fromId, name: message.from, role: message.role }, ...askable.people]);
  const markAll: DrawerSpec = {
    kicker: "Messages", title: "Mark everything as read", mode: "commit", sub: `${unread.length} ${unread.length === 1 ? "message is" : "messages are"} unread. Nothing is deleted.`, commitLabel: "Mark all as read", commitDone: "All read", commitDoneBody: "Your inbox is up to date.",
    submit: { endpoint: `${SW}/messages/read-all`, method: "POST" },
  };
  return {
    eyebrow: "Inbox", title: "Messages", desc: "Messages from your teachers and the school, and the questions you have asked.", tabs, tab,
    primary: { label: "Ask a teacher", drawer: askDrawer(askable.people, {}) },
    launchers: unread.length ? [{ label: "Mark all as read", drawer: markAll }] : [],
    rows: [row("1fr", [{
      type: "embed", component: "student-inbox",
      props: {
        base: SW, empty: tab === "Sent" ? "Questions you send to teachers appear here." : "No messages here.",
        messages: shown.map((message) => ({
          id: message.id, cat: message.cat, from: message.from, role: message.role, title: message.title, preview: message.body[0] ?? "", body: message.body, when: whenOf(message.at, me.today), read: message.read, to: message.to,
          reply: message.cat === "From teachers" && message.fromId ? askDrawer(people(message), { to: message.fromId, topic: `Re: ${message.title}` }) : null,
        })),
      },
    }])],
  };
}

/* ───────────────────────── attendance ───────────────────────── */

export async function attendancePage(): Promise<StudentContent> {
  const [me, data] = await Promise.all([loadMe(), loadAttendance()]);
  const first = data.terms[0] ? `${MONTHS[Number(data.terms[0].start.slice(5, 7)) - 1]} ${data.terms[0].start.slice(0, 4)}` : "the start";
  return {
    eyebrow: `${me.name} · ${me.arm}`, title: "Attendance", desc: "The morning register decides the day. Late still counts as present. Look at any week, month, term or session, and how it has moved over time.",
    rows: data.records.length
      ? [row("1fr", [{ type: "embed", component: "student-attendance", props: { terms: data.terms, records: data.records, today: me.today, current: data.current, first, guardian: me.guardian?.name ?? null } }])]
      : [row("1fr", [{ type: "note", tone: "neutral", title: "No register has been taken for you yet", body: "Your attendance appears here the day your form master marks the first register of the term." }])],
  };
}
