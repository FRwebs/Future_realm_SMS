import { apiGet } from "@/lib/api/server";
import type { TeacherWorkspaceView } from "@/lib/api/teacher-workspace";
import type { MarkerStudent, PanelRow, PanelTone, TabContent, TableCellKind, TableRow } from "@/lib/modules/panels";
import { pill, row, text } from "@/lib/modules/panels";

/**
 * M04 for a teaching person: the registers they hold, marked in under a minute, online or not — and the history of the arm they
 * answer for (or of the periods they took).
 *
 * A daily register and a period register are different records. The daily register is authoritative; a period register is
 * subordinate: absences are carried in from the daily register, so nobody is asked the same question twice, and a period
 * register never overwrites the daily figure.
 */

type RegistersView = {
  date: string;
  schoolDay: boolean;
  cutoff: string;
  clock: string;
  medianSeconds: number | null;
  registers: Array<{ kind: "daily" | "period"; classId: string; arm: string; subjectId: string | null; periodNumber: number | null; what: string; roll: number; state: "Marked" | "In progress" | "Not started" | "Not due"; markedAt: string | null; at: string | null; pastCutoff: boolean }>;
};

type ArmHistory = {
  kind: "arm";
  arm: { id: string; name: string; roll: number };
  term: { name: string; session: string };
  schoolDays: number;
  target: number;
  rate: number | null;
  marked: number;
  onTime: number;
  chronic: number;
  today: string;
  cutoff: string;
  recent: Array<{ date: string; label: string; roll: number; present: number; absent: number; late: number; excused: number; state: string; markedBy: string; onTime: boolean | null }>;
  otherArms: Array<{ id: string; name: string }>;
};
type PeriodHistory = {
  kind: "periods";
  arms: string[];
  term: { name: string; session: string };
  marked: number;
  inPeriod: number;
  assigned: number;
  recent: Array<{ date: string; label: string; arm: string; classId: string; subjectId: string; subject: string; period: number; present: number; absent: number; inPeriod: boolean }>;
};

export type PeriodState = {
  arm: { id: string; name: string };
  subject: { id: string; name: string };
  periodNumber: number;
  slot: { from: string; to: string; room: string | null } | null;
  date: string;
  label: string;
  mode: "new" | "draft" | "submitted";
  startedAt: string | null;
  markedAt: string | null;
  whyNot: string | null;
  carried: number;
  dailyMarked: boolean;
  students: MarkerStudent[];
  reasons: string[];
};

const CHECK = "M5 12.5l4.5 4.5 9-10";
const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";
const REG = "M4 5.5h16V20H4zM8 3v4M16 3v4M8.5 14l2 2 4-4.5";
const SHIELD = "M12 3.2 19.2 6v6.1c0 4.2-3 7.8-7.2 8.7-4.2-.9-7.2-4.5-7.2-8.7V6z";
const PEN = "M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z";
const API = "/api/v1/teacher-workspace";

const stateTone = (state: string): PanelTone => (state === "Marked" ? "positive" : state === "In progress" ? "progress" : state === "Not due" ? "neutral" : "attention");
const markHref = (entry: RegistersView["registers"][number]) => (entry.kind === "daily" ? `/attendance/mark/${entry.classId}` : `/attendance/mark/${entry.classId}/${entry.subjectId}/${entry.periodNumber}`);
const dayWords = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(iso));

export async function teacherAttendanceTab(tabSlug: string, me: TeacherWorkspaceView, permissions: string[], query: Record<string, string | undefined>): Promise<TabContent | null | undefined> {
  const held = new Set(permissions);
  if (tabSlug === "mark") return markTab(await apiGet<RegistersView>(`${API}/registers`), me, held);
  if (tabSlug === "register") return registerTab(await apiGet<ArmHistory | PeriodHistory>(`${API}/register-history${query.arm ? `?class=${encodeURIComponent(query.arm)}` : ""}`));
  return undefined;
}

function markTab(v: RegistersView, me: TeacherWorkspaceView, held: Set<string>): TabContent {
  const live = v.registers.filter((entry) => entry.state !== "Not due" || entry.kind === "daily");
  const open = live.filter((entry) => entry.state === "Not started" || entry.state === "In progress");
  const waiting = open.reduce((sum, entry) => sum + entry.roll, 0);
  const first = open[0] ?? v.registers.find((entry) => entry.kind === "daily");
  const median = v.medianSeconds;

  const tableRows: TableRow[] = v.registers.map((entry) => ({
    keywords: `${entry.arm} ${entry.what}`,
    cells: [
      text(entry.arm, { strong: true }), text(entry.what), text(String(entry.roll), { mono: true }),
      text(entry.kind === "daily" ? (me.persona === "early-years" ? "Class Teacher" : "Form Master") : "Subject Teacher", { tone: "neutral" }),
      pill(entry.state, stateTone(entry.state)),
      text(entry.kind === "daily" ? "Authoritative · report cards are built from it" : `Subordinate · never overwrites the daily figure${entry.at ? ` · ${entry.state === "Marked" ? `marked ${entry.markedAt ?? ""}` : `starts ${entry.at}`}` : ""}`, { tone: "neutral" }),
      { kind: "action", label: entry.state === "Marked" ? "Open" : entry.state === "In progress" ? "Continue" : "Mark", href: markHref(entry) },
    ] as TableCellKind[],
  }));

  const rows: Array<PanelRow | null> = [
    row("1fr", [{
      type: "kpi", sub: `${dayWords(v.date)} · the cutoff is ${v.cutoff}.`, per: 4,
      cards: [
        { label: "Registers to mark", value: String(open.length), unit: `of ${live.length}`, sub: !v.schoolDay ? "Today is not a school day" : open.length ? (open.some((entry) => entry.pastCutoff) ? "Past the cutoff" : "Still open") : "Nothing outstanding", tone: open.length && v.schoolDay ? "negative" : "positive" },
        { label: "Children unaccounted for", value: String(waiting), sub: waiting ? "Until you mark them" : "Everyone is accounted for", tone: waiting ? "attention" : "positive" },
        { label: "Your median time", value: median ? `${median}s` : "—", unit: median ? "per register" : undefined, sub: median ? "Over this term, from opening to submitting" : "Marked after you take your first register", tone: median ? "positive" : "neutral" },
        { label: "Works offline", value: "Yes", sub: "Marking never needs a connection", tone: "positive" },
      ],
    }]),
    row("1fr", [{
      type: "table", title: "Your registers today", sub: "A daily register and a period register are different records.", meta: `${v.registers.length} register${v.registers.length === 1 ? "" : "s"} · ${open.length} outstanding`, noun: "register", nounPlural: "registers",
      search: v.registers.length > 2 ? "Find an arm or a register" : undefined, head: ["Arm", "Register", "Roll", "Why it is yours", "State", "Note", ""], rows: tableRows, noRowOpen: true,
      empty: v.schoolDay ? "No register is yours today. Daily registers belong to form masters; period registers appear on the days you teach." : "Today is not a school day in this term — there is no register to take.",
      foot: "Where the daily register already exists, a period register opens against it — absences are carried in, so you are never asked the same question twice.",
    }]),
    row("1fr 1fr", [
      me.formArms.length
        ? { type: "note", tone: "neutral", icon: REG, title: "Your daily register is authoritative", body: `${me.formArms.map((arm) => arm.name).join(" and ")} ${me.formArms.length === 1 ? "is" : "are"} yours to mark. Report cards are built from the daily register, so it is the one that has to be right.` }
        : { type: "note", tone: "neutral", icon: REG, title: "You hold no daily register", body: "Daily registers belong to form masters. Yours are period registers, and each one opens against the daily register already marked for that arm." },
      {
        type: "facts", title: "How marking behaves", per: 1,
        facts: [
          ["Opens", "With every child unmarked", "Set the exceptions, then mark the rest present in one tap"],
          ["Offline", "Full write", "The queue survives a closed tab and a dead battery"],
          ["An absence", "Can carry a reason", "A reason on an absence travels to that child’s register"],
          ["Submitting", "Needs a connection", "A submission must not fork across two devices"],
          ["A same-day correction", "Free", "Anything earlier is a request that reaches the Principal"],
        ],
      },
    ]),
  ];

  return {
    title: "Mark a register", desc: "Only the registers you hold. Choose one and it opens with every child in it.",
    primary: first ? { label: open.length ? `Mark ${first.arm} · ${first.roll} children` : `Open ${first.arm}`, icon: CHECK, href: markHref(first) } : undefined,
    launchers: held.has("attendance.register.view") ? [{ label: "Register history", href: "/attendance/register" }] : [],
    rows: rows.filter((entry): entry is PanelRow => Boolean(entry)),
  };
}

function registerTab(h: ArmHistory | PeriodHistory): TabContent {
  if (h.kind === "arm") {
    const target = h.target;
    const rows: TableRow[] = h.recent.map((day) => ({
      cells: [
        text(day.label, { strong: true }), text(String(day.roll), { mono: true }),
        day.state === "Marked" ? text(String(day.present), { mono: true }) : text("—", { tone: "neutral" }),
        day.state === "Marked" ? text(String(day.absent), day.absent > 2 ? { tone: "negative", strong: true } : {}) : text("—", { tone: "neutral" }),
        day.state === "Marked" ? text(String(day.late), { mono: true }) : text("—", { tone: "neutral" }),
        pill(day.state, day.state === "Marked" ? "positive" : day.state === "Not started" ? "attention" : "negative"),
        text(day.markedBy, { tone: "neutral" }),
        { kind: "action", label: day.state === "Marked" ? "Open" : "Mark", href: day.state === "Marked" ? `/attendance/register/${h.arm.id}?date=${day.date}` : `/attendance/mark/${h.arm.id}?date=${day.date}` },
      ] as TableCellKind[],
    }));
    return {
      title: `${h.arm.name} · register`, desc: `The history of ${h.arm.name}, the arm you hold.`,
      primary: { label: "Request a correction", icon: PEN, href: `/attendance/register/${h.arm.id}` },
      launchers: [{ label: "Mark today’s register", href: `/attendance/mark/${h.arm.id}` }],
      rows: [
        row("1fr", [{
          type: "kpi", sub: `${h.arm.name} · ${h.term.name} ${h.term.session} · ${h.schoolDays} school day${h.schoolDays === 1 ? "" : "s"} so far.`, per: 4,
          cards: [
            { label: "Term attendance", value: h.rate === null ? "—" : `${h.rate}%`, sub: `School target is ${target}%`, tone: h.rate === null ? "neutral" : h.rate >= target ? "positive" : "attention" },
            { label: "Days marked", value: String(h.marked), unit: `of ${h.schoolDays}`, sub: h.today === "Marked" ? "Today is in" : "Today is still open", tone: h.marked === h.schoolDays ? "positive" : "attention" },
            { label: `Marked before ${h.cutoff}`, value: String(h.onTime), unit: `of ${h.marked}`, sub: "By whoever held the register that day", tone: h.onTime === h.marked ? "positive" : "attention" },
            { label: "Below the chronic line", value: String(h.chronic), unit: h.chronic === 1 ? "child" : "children", sub: h.chronic ? "An absence case may be open" : "Nobody", tone: h.chronic ? "negative" : "positive" },
          ],
        }]),
        row("1fr", [{
          type: "table", title: `${h.arm.name}, day by day`, sub: "Open a day to see the register exactly as it was marked.", meta: `Last ${h.recent.length} school days`, noun: "day", nounPlural: "days",
          head: ["Date", "Roll", "Pres", "Abs", "Late", "State", "Marked by", ""], rows, noRowOpen: true,
          empty: "No school day has passed in this term yet.", foot: "An unmarked day is not 0% — it is unknown, and it is counted as unknown.",
        }]),
        row("1fr", [{ type: "note", tone: "withheld", icon: SHIELD, title: "You cannot backdate or correct a saved register", body: "A same-day correction is yours to make. Anything earlier is a request with a reason, and it reaches the Principal.", acts: [{ label: "Request a correction", href: `/attendance/register/${h.arm.id}` }] }]),
      ],
    };
  }
  const rows: TableRow[] = h.recent.map((entry) => ({
    cells: [
      text(entry.label, { strong: true }), text(entry.arm), text(`Period ${entry.period}`), text(String(entry.present), { mono: true }), text(String(entry.absent), { mono: true }),
      text(entry.subject, { tone: "neutral" }), pill(entry.inPeriod ? "In the period" : "After the period", entry.inPeriod ? "positive" : "attention"),
      { kind: "action", label: "Open", href: `/attendance/mark/${entry.classId}/${entry.subjectId}/${entry.period}?date=${entry.date}` },
    ] as TableCellKind[],
  }));
  return {
    title: "Register", desc: "The history of the arms you teach — your periods, not the daily register.",
    rows: [
      row("1fr", [{
        type: "kpi", sub: "Period registers are subordinate: they feed truancy alerts and never overwrite the daily figure.", per: 3,
        cards: [
          { label: "Periods marked this term", value: String(h.marked), sub: h.assigned ? `${h.assigned} periods a week on your assignments` : "Marked the day you teach them", tone: "positive" },
          { label: "Marked in the period", value: h.marked ? `${Math.round((h.inPeriod / h.marked) * 100)}%` : "—", sub: h.marked ? `${h.inPeriod} of ${h.marked} before the period ended` : "After your first period register", tone: h.marked && h.inPeriod === h.marked ? "positive" : "neutral" },
          { label: "Arms", value: String(h.arms.length), sub: h.arms.join(" · ") || "None assigned" },
        ],
      }]),
      row("1fr", [{
        type: "table", title: "Your period registers", sub: "Each one as you marked it.", meta: `Last ${h.recent.length} period${h.recent.length === 1 ? "" : "s"}`, noun: "period", nounPlural: "periods",
        head: ["Day", "Arm", "Period", "Pres", "Abs", "Subject", "Timing", ""], rows, noRowOpen: true,
        empty: "You have not taken a period register this term. Mark one from the Mark tab on a day you teach.",
        foot: "A child present on the daily register and absent from your period raises a truancy alert to their form master.",
      }]),
    ],
  };
}

export const loadPeriodState = (classId: string, subjectId: string, period: string, date?: string) =>
  apiGet<PeriodState>(`${API}/period-registers/${encodeURIComponent(classId)}/${encodeURIComponent(subjectId)}/${encodeURIComponent(period)}${date ? `?date=${encodeURIComponent(date)}` : ""}`);

/** One period's register, taken: the same marker a daily register uses, pointed at the period's own endpoints. */
export function periodMarkPage(s: PeriodState): TabContent & { crumb: { label: string; href: string } } {
  const base = `${API}/period-registers/${encodeURIComponent(s.arm.id)}/${encodeURIComponent(s.subject.id)}/${s.periodNumber}`;
  const rows: PanelRow[] = [
    {
      cols: "1fr",
      panels: [
        s.mode === "submitted"
          ? { type: "note", tone: "positive", icon: CHECK, title: `The period register for ${s.arm.name} is submitted`, body: `It was taken${s.markedAt ? ` at ${s.markedAt}` : ""}. It sits beside the daily register and never overwrites it.` }
          : { type: "note", tone: "progress", icon: WARN, title: s.carried ? `${s.carried} absence${s.carried === 1 ? "" : "s"} carried in from the daily register` : s.dailyMarked ? "Nobody is present until you say so" : "The daily register has not been marked yet", body: s.carried ? "They begin as absent here, so you are never asked the same question twice. Change one only if the child really is in your room." : "Tap a status on each row, then preview and submit. The register will not submit until every child is set — use Mark the rest present once the exceptions are in." },
      ],
    },
    {
      cols: "1fr",
      panels: [{
        type: "marker", classId: s.arm.id, arm: `${s.arm.name} · ${s.subject.name}`, date: s.date, label: `${s.label} · period ${s.periodNumber}${s.slot ? ` · ${s.slot.from}–${s.slot.to}` : ""}`, students: s.students, reasons: s.reasons, mode: s.mode,
        whyNot: s.whyNot, backdated: false, cutoff: s.slot?.to ?? "the end of the period", startedAt: s.startedAt, markedAt: s.markedAt, draftEndpoint: `${base}/draft`, submitEndpoint: `${base}/submit`, overviewHref: "/attendance/mark",
      }],
    },
  ];
  return {
    crumb: { label: "Back to my registers", href: "/attendance/mark" },
    title: `${s.subject.name} · ${s.arm.name}`, desc: `${s.label} · period ${s.periodNumber}${s.slot?.room ? ` · ${s.slot.room}` : ""}. ${s.mode === "submitted" ? "Submitted." : "A period register is subordinate to the daily register."}`,
    rows,
  };
}
