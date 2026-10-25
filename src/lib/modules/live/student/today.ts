import type { CalEvent, Message } from "@/lib/modules/live/student/shared";
import {
  askDrawer, attTone, daysBetween, dDow, dFull, dLong, dShort, dueText, greeting, handInDrawer, loadAskable, loadAssignments, loadAttendance, loadCalendar, loadCards, loadMe, loadMessages,
  loadSubjects, loadTimetable, MON3, monday, ord, num, pctText, workPill, addDays, dayOf, orNone
} from "@/lib/modules/live/student/shared";
import type { StudentContent } from "@/lib/modules/live/student/shared";
import type { ListItem, PanelTone } from "@/lib/modules/panels";
import { row } from "@/lib/modules/panels";

const CAT_TONE: Record<string, PanelTone> = { Assessment: "attention", Due: "negative", Event: "progress", Results: "positive", Holiday: "neutral" };

export const eventItem = (event: CalEvent, href = "/portals/student/calendar"): ListItem => {
  const day = dayOf(event.date);
  return {
    label: event.title, sub: [event.end !== event.date ? `${dShort(event.date)} – ${dShort(event.end)}` : dDow(event.date), event.time, event.where].filter(Boolean).join(" · "),
    pill: event.cat, tone: CAT_TONE[event.cat] ?? "neutral", href, lead: { top: MON3[day.getUTCMonth()]!.toUpperCase(), value: String(day.getUTCDate()), tone: CAT_TONE[event.cat] ?? "neutral" },
  };
};

export const messageItem = (message: Message): ListItem => ({
  label: message.title, sub: `${message.from}${message.role ? ` · ${message.role}` : ""} · ${dDow(message.at.slice(0, 10))}`, pill: message.read ? "" : "New", tone: "progress", href: "/portals/student/messages",
});

export async function todayPage(): Promise<StudentContent> {
  const [me, tt, subjects, work, att, cal, inbox, cards, askable] = await Promise.all([
    loadMe(),
    orNone(loadTimetable(), { slots: [], periods: [], exams: [], components: [], published: false }),
    orNone(loadSubjects(), { components: [], subjects: [] }),
    loadAssignments(),
    orNone(loadAttendance(), { current: null, terms: [], records: [], closed: [] }),
    loadCalendar(),
    orNone(loadMessages(), { formMaster: null, items: [] }),
    orNone(loadCards(), { cards: [] }),
    loadAskable(),
  ]);
  const today = me.today;
  const dow = dayOf(today).getUTCDay();
  const slots = tt.slots.filter((slot) => slot.day === dow).sort((a, b) => a.from.localeCompare(b.from));
  const current = slots.find((slot) => slot.from <= me.now && me.now < slot.to);
  const later = slots.filter((slot) => (current ? slot.from >= current.to : slot.from > me.now));
  const subjectOf = (name: string) => subjects.subjects.find((subject) => subject.name === name);
  const minsLeft = (to: string) => Number(to.slice(0, 2)) * 60 + Number(to.slice(3)) - (Number(me.now.slice(0, 2)) * 60 + Number(me.now.slice(3)));
  const lessons = current?.kind === "lesson";
  const topic = lessons ? subjectOf(current!.subject)?.topic ?? null : null;
  const canAsk = askable.people.length > 0;
  const ask = (to?: string) => askDrawer(askable.people, { to, topic: "A question about work", fmReads: askable.formMasterReads });
  const canHandIn = me.policy?.homework !== false;
  const teacherId = askable.people.find((person) => lessons && current!.teacher.startsWith(person.name))?.id;

  const todo = work.items.filter((item) => item.state === "todo" || item.state === "overdue").sort((a, b) => (a.state === b.state ? a.due.localeCompare(b.due) : a.state === "overdue" ? -1 : 1));
  const friday = addDays(monday(today), 4);
  const week = todo.filter((item) => item.due <= friday);
  const late = todo.filter((item) => item.state === "overdue");
  const nextTodo = todo.find((item) => item.state === "todo");
  const marked = work.items.filter((item) => item.state === "marked").sort((a, b) => (b.markedAt ?? "").localeCompare(a.markedAt ?? "")).slice(0, 4);

  const termRecords = att.records.filter((record) => record.term === att.current && record.date <= today && record.status !== "HOLIDAY");
  const presentDays = termRecords.filter((record) => record.status === "PRESENT" || record.status === "LATE").length;
  const pct = termRecords.length ? (presentDays / termRecords.length) * 100 : null;

  /* the first assessment of the term's framework that has been released, averaged over the subjects it was released for */
  const first = subjects.components[0];
  const released = first ? subjects.subjects.map((subject) => subject.parts.find((part) => part.code === first.code)?.score ?? null).filter((score): score is number => score !== null) : [];
  const caAvg = released.length ? released.reduce((sum, score) => sum + score, 0) / released.length : null;
  const card = cards.cards[0];

  const testTomorrow = cal.events.find((event) => event.date === addDays(today, 1) && event.cat === "Assessment");
  const sub = [
    current && lessons ? `You’re in ${current.subject} until ${current.to}.` : "",
    testTomorrow ? `The ${testTomorrow.title.toLowerCase()} is tomorrow${testTomorrow.time ? ` at ${testTomorrow.time.split(" – ")[0]}` : ""}.` : "",
    week.length ? `${week.length} ${week.length === 1 ? "piece of work is" : "pieces of work are"} due by Friday${late.length ? ` — ${late.length} of ${week.length === 1 ? "it" : "them"} ${late.length === 1 ? "is" : "are"} late.` : "."}` : "Nothing is due this week.",
  ].filter(Boolean).join(" ");
  const upcoming = cal.events.filter((event) => event.end >= today).slice(0, 5);

  return {
    eyebrow: `${dFull(today)} ${dayOf(today).getUTCFullYear()}${me.term ? ` · ${me.term.name}, week ${me.term.week}` : ""}`,
    title: `${greeting(me.now)}, ${me.first}`, desc: sub,
    primary: nextTodo ? { label: canHandIn ? "Hand in work" : "See your work", href: "/portals/student/assignments" } : undefined,
    launchers: canAsk ? [{ label: "Ask a teacher", drawer: ask() }] : [],
    rows: [
      row("1fr", [{
        type: "embed", component: "student-now",
        props: {
          live: Boolean(current), label: current ? (current.kind === "lesson" ? `Now · Period ${current.n}` : current.subject) : "Today",
          when: current ? `${current.from} – ${current.to} · ${minsLeft(current.to)} minutes left` : slots.length ? `Lessons run ${slots[0]!.from} – ${slots[slots.length - 1]!.to}` : "No lessons are published for today",
          subject: current ? current.subject : slots.length ? "No lesson right now" : "Nothing on your timetable today",
          who: lessons ? [current!.teacher, current!.venue].filter(Boolean).join(" · ") : "", topic,
          acts: lessons ? [{ label: `Open ${current!.subject}`, href: "/portals/student/subjects" }, ...(canAsk ? [{ label: `Ask ${current!.teacher.replace(/^(Mrs|Mr|Miss|Ms|Dr) /, "") || "your teacher"}`, drawer: ask(teacherId) }] : [])] : [],
          later: later.map((slot) => ({ time: slot.from, subject: slot.subject, who: slot.kind === "lesson" ? [slot.teacher, slot.lab ? "laboratory" : ""].filter(Boolean).join(" · ") : "", tag: slot.lab ? "Lab" : "", brk: slot.kind !== "lesson" })),
          laterEmpty: later.length ? "" : slots.length ? "That was the last lesson today." : "Enjoy the day.", laterTitle: "Rest of today",
        },
      }]),
      row("1fr", [{
        type: "kpi", bare: true, per: 4,
        cards: [
          { label: "Attendance this term", value: pctText(pct), sub: termRecords.length ? `${presentDays} of ${termRecords.length} school days` : "No school days yet", tone: attTone(pct), href: "/portals/student/attendance", icon: "calendar" },
          { label: "Due by Friday", value: String(week.length), sub: late.length ? `${late.length} late · ${late[0]!.subject}` : nextTodo ? `Next: ${nextTodo.subject}` : "Nothing to hand in", tone: late.length ? "negative" : week.length ? "attention" : "positive", href: "/portals/student/assignments", icon: "check" },
          { label: first ? `${first.name} average` : "First CA average", value: caAvg === null ? "Pending" : `${num(Math.round(caAvg * 10) / 10)} / ${first!.max}`, sub: caAvg === null ? "Not released yet" : `${released.length} ${released.length === 1 ? "subject" : "subjects"} released`, tone: "progress", href: "/portals/student/results", icon: "bars" },
          { label: "Last report card", value: card ? num(card.average) : "—", sub: card ? `${card.position ? ord(card.position) : "—"} of ${card.size} · ${card.term}` : "None published yet", tone: card ? "positive" : "neutral", href: "/portals/student/results?tab=Progress+over+time", icon: "trophy" },
        ],
      }]),
      row("minmax(0,1.25fr) minmax(0,1fr)", [
        {
          type: "list", title: "Due soon", sub: todo.length ? "Late work first, then by due date." : "Nothing to hand in.", empty: "You are all caught up.", acts: [{ label: "All work", href: "/portals/student/assignments" }],
          items: todo.slice(0, 6).map((item): ListItem => { const [label, tone] = workPill(item, today); const x = dayOf(item.due); return { lead: { top: MON3[x.getUTCMonth()]!.toUpperCase(), value: String(x.getUTCDate()), tone }, label: item.title, sub: `${item.subject} · due ${dueText(item, today).replace(/^(Today|Tomorrow)/, (m) => m.toLowerCase())}`, pill: label, tone, viewLabel: canHandIn ? "Hand in" : "Open", ...(canHandIn ? { drawer: handInDrawer(item) } : { href: "/portals/student/assignments" }) }; }),
        },
        { type: "list", title: "Coming up", sub: "From the school calendar.", acts: [{ label: "Calendar", href: "/portals/student/calendar" }], items: upcoming.map((event) => eventItem(event)), empty: "Nothing is on the calendar yet." },
      ]),
      row("minmax(0,1.25fr) minmax(0,1fr)", [
        { type: "list", title: "Messages", sub: inbox.items.some((m) => !m.read && m.cat !== "Sent") ? `${inbox.items.filter((m) => !m.read && m.cat !== "Sent").length} unread.` : "All read.", acts: [{ label: "Inbox", href: "/portals/student/messages" }], items: inbox.items.filter((m) => m.cat !== "Sent").slice(0, 3).map(messageItem), empty: "No messages yet." },
        { type: "list", title: "Recently marked", sub: "Homework your teachers have returned.", acts: [{ label: "Marked work", href: "/portals/student/assignments?tab=Marked" }], items: marked.map((item): ListItem => { const [label, tone] = workPill(item, today); return { label: item.title, sub: `${item.subject} · marked ${item.markedAt ? dShort(item.markedAt) : ""}`, pill: label, tone, href: "/portals/student/assignments?tab=Marked" }; }), empty: "Nothing has been marked yet." },
      ]),
    ],
  };
}

export { MON3, dLong, daysBetween, handInDrawer };
