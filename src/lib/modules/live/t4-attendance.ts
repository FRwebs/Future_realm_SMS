import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import type { TeacherWorkspaceView } from "@/lib/api/teacher-workspace";
import type { MarkerStudent, PanelRow, PanelTone, TabContent, TableCellKind, TableRow } from "@/lib/modules/panels";
import { pill, row, text } from "@/lib/modules/panels";
import { formatDay } from "@/lib/date-format";

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
const dayWords = (iso: string) => formatDay(new Date(iso), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export async function teacherAttendanceTab(tabSlug: string, me: TeacherWorkspaceView, permissions: string[], query: Record<string, string | undefined>): Promise<TabContent | null | undefined> {
  const held = new Set(permissions);
  if (tabSlug === "mark") return markTab(await apiGet(`${API}/registers`, observe<RegistersView>(localContracts["src/lib/modules/live/t4-attendance.ts#9e919aae"])), me, held);
  // A head of department reviews their department's period registers; they do not mark them, and
  // the administrator's whole-school breach page is not theirs. Anyone else keeps the admin page.
  if (tabSlug === "compliance" && me.persona === "head-of-department") {
    const view = await apiGet(`${API}/register-compliance`, observe<Compliance>(localContracts["src/lib/modules/live/t4-attendance.ts#compliance"])).catch(() => null);
    if (view) return complianceTab(view);
    return undefined;
  }
  if (tabSlug === "register") {
    // Without an arm named, the tab is the index of every register held; naming one
    // opens that register's own history, which is what the index links to.
    if (!query.arm) {
      // An API that predates the index still serves the per-arm history, so fall back
      // to it rather than failing the whole tab during a rolling deploy.
      const index = await apiGet(`${API}/register-index`, observe<RegisterIndex>(localContracts["src/lib/modules/live/t4-attendance.ts#bc3e7357"])).catch(() => null);
      if (index) return registerIndexTab(index);
    }
    return registerTab(await apiGet(`${API}/register-history${query.arm ? `?class=${encodeURIComponent(query.arm)}` : ""}`, observe<ArmHistory | PeriodHistory>(localContracts["src/lib/modules/live/t4-attendance.ts#5d679d9e"])));
  }
  return undefined;
}

type Compliance = {
  department: string;
  day: string;
  kpis: { taught: number; onTime: number; teachers: number; unmarked: number; truancy: number };
  rows: Array<{ teacher: string; role: string; subjects: string; taught: number; onTime: number; late: number; state: string }>;
};

/**
 * The department's period registers today — who marked, and who marked after the period had ended.
 *
 * Review only, and it says so: a head of department is answerable for the registers being taken,
 * and for nothing inside them. There is no mark on this page and no way to change one.
 */
function complianceTab(v: Compliance): TabContent {
  const late = v.kpis.taught - v.kpis.onTime;
  const rows: TableRow[] = v.rows.map((entry) => ({
    keywords: `${entry.teacher} ${entry.subjects} ${entry.state}`,
    cells: [
      { kind: "name", name: entry.teacher, sub: entry.role },
      text(entry.subjects),
      text(String(entry.taught), { mono: true }),
      text(String(entry.onTime), { mono: true }),
      entry.late ? text(String(entry.late), { strong: true, tone: "attention" }) : text("—", { tone: "neutral" }),
      pill(entry.state, entry.late ? "attention" : entry.taught ? "positive" : "neutral"),
    ] as TableCellKind[],
  }));
  return {
    title: "Compliance",
    desc: `${v.department} period registers today. Review only — you do not mark them.`,
    rows: [
      row("1fr", [{
        type: "kpi", per: 4, sub: `Granted because you head ${v.department}. A subject teacher does not audit their colleagues.`,
        cards: [
          { label: "Periods taught so far", value: String(v.kpis.taught), },
          { label: "Marked in the period", value: String(v.kpis.onTime), unit: `of ${v.kpis.taught}`, tone: late ? "attention" : "positive" },
          { label: "Unmarked", value: String(v.kpis.unmarked), tone: v.kpis.unmarked ? "negative" : "positive" },
          { label: "Truancy alerts", value: String(v.kpis.truancy), tone: v.kpis.truancy ? "attention" : "positive" },
        ],
      }]),
      row("1fr", [{
        type: "table", title: "By teacher", sub: "Period registers only — the daily register belongs to form masters.",
        meta: `${v.rows.length} ${v.rows.length === 1 ? "teacher" : "teachers"} · ${v.day}`, noun: "teacher", nounPlural: "teachers",
        head: ["Teacher", "Subjects", "Taught", "On time", "Late", "State"], rows, per: 12, noRowOpen: true,
        empty: `No subject is mapped to ${v.department} yet.`,
      }]),
    ],
  };
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
        { label: "Registers to mark", value: String(open.length), unit: `of ${live.length}`, tone: open.length && v.schoolDay ? "negative" : "positive" },
        { label: "Children unaccounted for", value: String(waiting), tone: waiting ? "attention" : "positive" },
        { label: "Your median time", value: median ? `${median}s` : "—", unit: median ? "per register" : undefined, tone: median ? "positive" : "neutral" },
        { label: "Works offline", value: "Yes", tone: "positive" },
      ],
    }]),
    { ...row("1fr", [{
      type: "table", title: "Your registers today", sub: "A daily register and a period register are different records.", meta: `${v.registers.length} register${v.registers.length === 1 ? "" : "s"} · ${open.length} outstanding`, noun: "register", nounPlural: "registers",
      search: v.registers.length > 2 ? "Find an arm or a register" : undefined,
      // The mockup filters this list by arm, by register kind and by state. With one
      // register they are noise, so they appear once there is something to narrow.
      filters: v.registers.length > 2
        ? [
            { label: "Arm", value: "All", options: ["All", ...new Set(v.registers.map((entry) => entry.arm))] },
            { label: "Register", value: "All", options: ["All", "Daily register", "Period register"] },
            { label: "State", value: "All", options: ["All", ...new Set(v.registers.map((entry) => entry.state))] },
          ]
        : undefined,
      head: ["Arm", "Register", "Roll", "Why it is yours", "State", "Note", ""], rows: tableRows, noRowOpen: true,
      empty: v.schoolDay ? "No register is yours today. Daily registers belong to form masters; period registers appear on the days you teach." : "Today is not a school day in this term — there is no register to take.",
    }]), show: "desktop" as const },
    // The phone reads the same registers as rows: an icon for the kind of register, who it is yours as, and how many children are in it.
    {
      ...row("1fr", [{
        type: "list", title: "Your registers today", tag: open.length ? `${open.length} to mark` : undefined, tagTone: "attention",
        sub: "A daily register and a period register are different records.",
        empty: v.schoolDay ? "No register is yours today. Daily registers belong to form masters; period registers appear on the days you teach." : "Today is not a school day in this term — there is no register to take.",
        items: v.registers.map((entry) => ({
          icon: REG, label: `${entry.arm} · ${entry.what}`, pill: entry.state, tone: stateTone(entry.state), side: `${entry.roll} ${entry.roll === 1 ? "child" : "children"}`,
          sub: `${entry.kind === "daily" ? (me.persona === "early-years" ? "Class Teacher" : "Form Master") : "Subject Teacher"} · ${entry.kind === "daily" ? "report cards are built from it" : `never overwrites the daily figure${entry.at ? ` · ${entry.state === "Marked" ? `marked ${entry.markedAt ?? ""}` : `starts ${entry.at}`}` : ""}`}`,
          href: markHref(entry),
        })),
        foot: "Where the daily register already exists, a period register opens against it — absences are carried in, so you are never asked the same question twice.",
      }]),
      show: "phone" as const,
    },
    row("1fr 1fr", [
      me.formArms.length
        ? { type: "note", show: "desktop", tone: "neutral", icon: REG, title: "Your daily register is authoritative", body: `${me.formArms.map((arm) => arm.name).join(" and ")} ${me.formArms.length === 1 ? "is" : "are"} yours to mark. Report cards are built from the daily register, so it is the one that has to be right.` }
        : { type: "note", show: "desktop", tone: "neutral", icon: REG, title: "You hold no daily register", body: "Daily registers belong to form masters. Yours are period registers, and each one opens against the daily register already marked for that arm." },
      {
        type: "facts", title: "How marking behaves", tuck: "How marking behaves", tuckIcon: "M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2zM12 6.5v13", tuckKicker: "How this works", per: 1, phoneFold: true,
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
    phoneEyebrow: `Attendance · ${dayWords(v.date)}`,
    primary: first ? { label: open.length ? `Mark ${first.arm} · ${first.roll} children` : `Open ${first.arm}`, phoneLabel: open.length ? "Mark register" : "Open register", icon: CHECK, href: markHref(first) } : undefined,
    launchers: held.has("attendance.register.view") ? [{ label: "Register history", href: "/attendance/register" }] : [],
    rows: rows.filter((entry): entry is PanelRow => Boolean(entry)),
  };
}

type RegisterIndex = {
  term: { id: string; name: string } | null; date: string | null; schoolDays: number; markedToday: number; correctionsPending: number;
  registers: Array<{ classId: string; subjectId: string | null; periodNumber: number | null; arm: string; what: string; kind: "daily" | "period"; roll: number; why: string; today: string; termRate: number | null }>;
};

/**
 * Every register this person holds, in one list.
 *
 * The daily register for an arm and a period register for a subject are
 * different records, so the list says which each row is and why it is theirs.
 * Only a daily register carries a term figure — a period register is
 * subordinate to it and would be reporting the same children twice.
 */
function registerIndexTab(v: RegisterIndex): TabContent {
  const daily = v.registers.filter((entry) => entry.kind === "daily");
  // The API boundary is not type-checked, so a shape change on the server reaches
  // the page as whatever it is. A count that is not a number is shown as unknown
  // rather than stringified into the card.
  const schoolDays = typeof v.schoolDays === "number" ? String(v.schoolDays) : "—";
  const rows: TableRow[] = v.registers.map((entry) => ({
    keywords: `${entry.arm} ${entry.what} ${entry.why}`,
    cells: [
      text(entry.arm, { strong: true }),
      text(entry.what),
      text(entry.why, { tone: "neutral" }),
      pill(entry.today, entry.today === "Marked" ? "positive" : entry.today === "Not due" ? "neutral" : "attention"),
      entry.termRate === null ? text("—", { tone: "neutral" }) : text(`${entry.termRate}%`, { mono: true }),
      text(entry.roll ? String(entry.roll) : "—", { mono: true }),
      { kind: "action", label: "Open", href: `/attendance/register?arm=${entry.classId}` },
    ] as TableCellKind[],
  }));
  return {
    title: "Register", desc: "Every register you hold. Open one to see each day you marked and what was missed.",
    phoneTitle: "Your registers", phoneDesc: "Every register you hold. Open one for its days, who was away, and who marked it.",
    phonePrimary: daily[0] ? { label: "Request correction", icon: PEN, href: `/attendance/register/${daily[0].classId}` } : undefined,
    rows: [
      // The phone: two figures, then one row for each register with where it stands today.
      { ...row("1fr", [{
        type: "kpi", bare: true,
        cards: [
          { label: "Registers you hold", value: String(v.registers.length), },
          { label: "Registers marked today", value: String(v.markedToday), unit: `of ${v.registers.length}`, tone: v.registers.length && v.markedToday === v.registers.length ? "positive" : "attention" },
        ],
      }]), show: "phone" as const },
      { ...row("1fr", [{
        type: "list", title: "Choose a register", tag: `${v.registers.length} register${v.registers.length === 1 ? "" : "s"}`, tagTone: "neutral",
        sub: "A daily register and a period register are different records.",
        empty: "You hold no register. Daily registers belong to form masters; period registers appear on the days you teach.",
        items: v.registers.map((entry) => ({
          icon: REG, label: `${entry.arm} · ${entry.what}`, pill: entry.today, tone: entry.today === "Marked" ? ("positive" as const) : entry.today === "Not due" ? ("neutral" as const) : ("attention" as const),
          sub: `${entry.why}${entry.roll ? ` · ${entry.roll} ${entry.roll === 1 ? "child" : "children"}` : ""}`,
          href: `/attendance/register?arm=${entry.classId}`,
        })),
        foot: "Never overwrites the daily figure. Present at 08:00 but missing your period raises a truancy alert.",
      }]), show: "phone" as const },
      { ...row("1fr", [{
        // Named here rather than left to the shared KPI titles, which title this tab
        // after the teacher's own arm — right for one arm's history, wrong above cards
        // that count every register they hold.
        type: "kpi", title: "Your registers this term", per: 4,
        cards: [
          { label: "Registers you hold", value: String(v.registers.length), },
          { label: "Marked today", value: String(v.markedToday), unit: `of ${v.registers.length}`, tone: v.registers.length && v.markedToday === v.registers.length ? "positive" : "attention" },
          { label: "School days so far", value: schoolDays, },
          { label: "Corrections pending", value: String(v.correctionsPending), tone: v.correctionsPending ? "attention" : "positive" },
        ],
      }]), show: "desktop" as const },
      { ...row("1fr", [{
        type: "table", title: "Your registers", sub: "Open each for its days, its children and every change made.",
        meta: `${v.registers.length} register${v.registers.length === 1 ? "" : "s"}`, noun: "register", nounPlural: "registers",
        search: v.registers.length > 2 ? "Find an arm or a register" : undefined,
        head: ["Arm", "Register", "Why you have it", "Today", "Term", "Roll", ""], rows, noRowOpen: true,
        empty: "You hold no register. Daily registers belong to form masters; period registers appear on the days you teach.",
      }]), show: "desktop" as const },
    ],
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
            { label: "Term attendance", value: h.rate === null ? "—" : `${h.rate}%`, tone: h.rate === null ? "neutral" : h.rate >= target ? "positive" : "attention" },
            { label: "Days marked", value: String(h.marked), unit: `of ${h.schoolDays}`, tone: h.marked === h.schoolDays ? "positive" : "attention" },
            { label: `Marked before ${h.cutoff}`, value: String(h.onTime), unit: `of ${h.marked}`, tone: h.onTime === h.marked ? "positive" : "attention" },
            { label: "Below the chronic line", value: String(h.chronic), unit: h.chronic === 1 ? "child" : "children", tone: h.chronic ? "negative" : "positive" },
          ],
        }]),
        row("1fr", [{
          type: "table", title: `${h.arm.name}, day by day`, sub: "Open a day to see the register exactly as it was marked.", meta: `Last ${h.recent.length} school days`, noun: "day", nounPlural: "days",
          head: ["Date", "Roll", "Pres", "Abs", "Late", "State", "Marked by", ""], rows, noRowOpen: true,
          empty: "No school day has passed in this term yet.",         }]),
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
          { label: "Periods marked this term", value: String(h.marked), tone: "positive" },
          { label: "Marked in the period", value: h.marked ? `${Math.round((h.inPeriod / h.marked) * 100)}%` : "—", tone: h.marked && h.inPeriod === h.marked ? "positive" : "neutral" },
          { label: "Arms", value: String(h.arms.length), },
        ],
      }]),
      row("1fr", [{
        type: "table", title: "Your period registers", sub: "Each one as you marked it.", meta: `Last ${h.recent.length} period${h.recent.length === 1 ? "" : "s"}`, noun: "period", nounPlural: "periods",
        head: ["Day", "Arm", "Period", "Pres", "Abs", "Subject", "Timing", ""], rows, noRowOpen: true,
        empty: "You have not taken a period register this term. Mark one from the Mark tab on a day you teach.",
      }]),
    ],
  };
}

export const loadPeriodState = (classId: string, subjectId: string, period: string, date?: string) =>
  apiGet(`${API}/period-registers/${encodeURIComponent(classId)}/${encodeURIComponent(subjectId)}/${encodeURIComponent(period)}${date ? `?date=${encodeURIComponent(date)}` : ""}`, observe<PeriodState>(localContracts["src/lib/modules/live/t4-attendance.ts#ce7d8c71"]));

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
