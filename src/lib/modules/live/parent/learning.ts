import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import { name as nameCell, row, text } from "@/lib/modules/panels";
import type { ListItem, PanelFact, TableRow } from "@/lib/modules/panels";
import { PW, clocksOf, dDow, dShort, dayOf, loadMe } from "@/lib/modules/live/parent/shared";
import type { ParentContent, ParentMe } from "@/lib/modules/live/parent/shared";

type Slot = { day: number; n: number; from: string; to: string; kind: string; subject: string; teacher: string; lab: boolean };
export type Kid = {
  id: string; first: string; arm: string; published: boolean; slots: Slot[];
  /** The day and the clock at this child's school; a lesson is "now" by that clock. */
  today?: string; now?: string;
  periods: Array<{ n: number; from: string; to: string; kind: string }>;
  topics: Array<{ subject: string; teacher: string; now: string | null; next: string | null }>;
  exams: Array<{ id: string; subject: string; date: string; from: string; to: string; venue: string }>;
};
type Learning = {
  week: number; weeks: number; today: string; term?: { name: string; session: string };
  components: Array<{ code: string; name: string; weight: number; max: number }>;
  tests: Array<{ id: string; title: string; date: string; end: string; time: string; where: string }>;
  children: Kid[];
};

const TABS = ["Timetable", "This week in class", "Tests and exams"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export const loadLearning = (child: string) => apiGet(`${PW}/learning?child=${encodeURIComponent(child)}`, observe<Learning>(localContracts["src/lib/modules/live/parent/learning.ts#7a1f6efb"]));

export async function learningPage(child: string, query: Record<string, string | undefined>): Promise<ParentContent> {
  const [me, data] = await Promise.all([loadMe(), loadLearning(child)]);
  const one = child === "all" ? null : data.children.find((entry) => entry.id === child) ?? null;
  return one ? childLearning(one, data, me, query) : familyLearning(data, me);
}

/** The lesson running now for a child, and the next one today — read against the school's own clock. */
export function liveLesson(kid: Kid, me: ParentMe) {
  const clock = kid.now ?? me.now;
  const day = dayOf(kid.today ?? me.today).getUTCDay();
  const today = kid.slots.filter((slot) => slot.day === day && slot.kind === "lesson").sort((a, b) => a.from.localeCompare(b.from));
  const now = today.find((slot) => slot.from <= clock && clock < slot.to) ?? null;
  const next = today.find((slot) => slot.from > clock) ?? null;
  const onBreak = !now && kid.slots.some((slot) => slot.day === day && slot.kind === "break" && slot.from <= clock && clock < slot.to);
  return { now, next, onBreak };
}

const testItem = (event: { title: string; date: string; end: string; time: string; where: string }): ListItem => {
  const date = dayOf(event.date);
  return {
    lead: { top: MONTHS[date.getUTCMonth()]!, value: String(date.getUTCDate()), tone: "attention" },
    label: event.title,
    sub: [event.end !== event.date ? `${dShort(event.date)} – ${dShort(event.end)}` : dDow(event.date), event.time, event.where].filter(Boolean).join(" · "),
    pill: "Assessment", tone: "attention",
  };
};
const examItem = (exam: Kid["exams"][number], who: string): ListItem => {
  const date = dayOf(exam.date);
  return {
    lead: { top: MONTHS[date.getUTCMonth()]!, value: String(date.getUTCDate()), tone: "attention" },
    label: `${who ? `${who} · ` : ""}${exam.subject} examination`,
    sub: [dDow(exam.date), `${exam.from} – ${exam.to}`, exam.venue].filter(Boolean).join(" · "),
    pill: "Examination", tone: "attention",
  };
};

function familyLearning(data: Learning, me: ParentMe): ParentContent {
  const ahead = [
    ...data.tests.map((event) => ({ date: event.date, item: testItem(event) })),
    ...data.children.flatMap((kid) => kid.exams.map((exam) => ({ date: exam.date, item: examItem(exam, kid.first) }))),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8).map((entry) => entry.item);
  return {
    eyebrow: "Whole family", title: "Timetable and lessons",
    desc: "Where each child is right now, and every test ahead.",
    rows: [row("minmax(0,1.2fr) minmax(0,1fr)", [
      {
        type: "list", title: "Right now in class", sub: `${dDow(me.today)} · ${clocksOf(me)}.`,
        empty: "No child is in a class that has a published timetable yet.",
        items: data.children.map((kid): ListItem => {
          const live = liveLesson(kid, me);
          const where = live.now
            ? `${live.now.from}–${live.now.to}${live.now.teacher ? ` · ${live.now.teacher}` : ""}`
            : kid.published ? "Lessons have finished for today, or have not started" : "The timetable has not been published yet";
          return {
            label: `${kid.first} · ${live.now ? live.now.subject : live.onBreak ? "Break" : "Not in a lesson"}`,
            sub: `${where}${live.next ? ` · next, ${live.next.subject} at ${live.next.from}` : ""}`,
            pill: live.now ? "Now" : live.onBreak ? "Break" : "Done", tone: live.now ? "progress" : "neutral",
            href: `/portals/parent/learning?child=${kid.id}`,
          };
        }),
      },
      {
        type: "list", title: "Tests and exams ahead", sub: "In date order.",
        empty: "No test or examination has been set yet.", items: ahead,
        acts: [{ label: "Calendar", href: "/portals/parent/calendar" }],
      },
    ])],
  };
}

function childLearning(kid: Kid, data: Learning, me: ParentMe, query: Record<string, string | undefined>): ParentContent {
  const tab = TABS.includes(query.tab ?? "") ? query.tab! : TABS[0]!;
  const term = data.term ? `${data.term.name} ${data.term.session}` : "This term";
  const head = {
    eyebrow: `${kid.first} · ${kid.arm}`, title: "Timetable and lessons",
    tabs: TABS.map((label) => ({ label })), tab,
    desc: "Timetable, this week’s topics and tests ahead.",
  };

  if (tab === TABS[1]) {
    const monday = new Date(dayOf(me.today).getTime() - ((dayOf(me.today).getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
    const friday = new Date(dayOf(monday).getTime() + 4 * 86_400_000).toISOString().slice(0, 10);
    const rows: TableRow[] = kid.topics.map((topic) => ({
      keywords: topic.subject,
      cells: [nameCell(topic.subject, topic.teacher, { avatar: false }), text(topic.now ?? "Not set yet", { strong: Boolean(topic.now) }), text(topic.next ?? "Not set yet")],
    }));
    return {
      ...head,
      rows: [row("1fr", [kid.topics.length
        ? {
            type: "table", title: `Week ${data.week} · ${dShort(monday)} – ${dShort(friday)}`,
            sub: "The topic each teacher is teaching this week, and what comes next.",
            noun: "subject", nounPlural: "subjects", head: ["Subject", "This week", "Next week"], rows, dense: true, noRowOpen: true,
            foot: "From approved schemes of work. Next week can still change.",
          }
        : { type: "note", tone: "neutral", title: "No topics are published yet", body: `${kid.first}’s teachers have not had a scheme of work approved for ${term}. Each subject’s topic appears here the week it is taught.` }])],
    };
  }

  if (tab === TABS[2]) {
    const total = data.components.reduce((sum, component) => sum + component.weight, 0) || 100;
    const facts: PanelFact[] = data.components.map((component) => [component.name, `${Math.round((component.weight / total) * 1000) / 10}%`, `Out of ${component.max}`]);
    const items = [
      ...data.tests.map((event) => ({ date: event.date, item: testItem(event) })),
      ...kid.exams.map((exam) => ({ date: exam.date, item: examItem(exam, "") })),
    ].sort((a, b) => a.date.localeCompare(b.date)).map((entry) => entry.item);
    return {
      ...head,
      rows: [row("minmax(0,1.3fr) minmax(0,1fr)", [
        { type: "list", title: "Coming up", sub: `Every test the school has put on its calendar for ${kid.first}.`, items, empty: "No test or examination has been set yet." },
        { type: "facts", title: "How the term score is built", per: 1, facts: facts.length ? facts : [["Assessment", "Not set", "The school has not set its assessment components yet."]] },
      ])],
    };
  }

  const day = dayOf(me.today).getUTCDay();
  const live = liveLesson(kid, me);
  const grid = kid.periods.map((period) => {
    if (period.kind === "break") {
      return { brk: true as const, label: kid.slots.find((slot) => slot.kind === "break" && slot.from === period.from)?.subject ?? "Break", time: `${period.from}–${period.to}` };
    }
    return {
      brk: false as const, label: `Period ${period.n}`, time: `${period.from}–${period.to}`, from: period.from,
      cells: [1, 2, 3, 4, 5].map((d) => {
        const slot = kid.slots.find((entry) => entry.day === d && entry.from === period.from && entry.kind === "lesson");
        return slot ? { subject: slot.subject, who: slot.teacher, lab: slot.lab } : null;
      }),
    };
  });
  return {
    ...head,
    rows: kid.published
      ? [row("1fr", [{
          type: "embed", component: "student-week",
          props: {
            title: "Weekly timetable", sub: "Today is highlighted, and the lesson running now is ringed.",
            days: DAYS, today: day >= 1 && day <= 5 ? day : 0, now: live.now ? { day, from: live.now.from } : null, rows: grid,
            foot: `${term} timetable, as ${me.school} published it.`,
          },
        }])]
      : [row("1fr", [{ type: "note", tone: "attention", title: "The timetable has not been published yet", body: `${me.school} publishes each term’s timetable when it is ready. It appears here the moment it is.` }])],
  };
}

