import { apiGet } from "@/lib/api/server";
import type { TeacherWorkspaceView } from "@/lib/api/teacher-workspace";
import { teacherModules, teacherNavigation } from "@/lib/modules/teacher-workspace";
import type { KpiCard, Panel, PanelRow, PanelTone, TabContent, TableRow, TrackerRow } from "@/lib/modules/panels";
import { pill, row, text } from "@/lib/modules/panels";

/**
 * M01 for a teaching person: "My Day" — what they owe and by when, counted from their own assignments and nobody else's — and,
 * for a head of department, "Oversight" of the department and nothing outside it.
 *
 * Every figure is read from the same registers, sheets and remarks the other modules are built on, by
 * `/api/v1/teacher-workspace/day`, so this page cannot say something the module behind it does not.
 */

type DayView = {
  date: string;
  label: string;
  weekday: string;
  clock: string;
  schoolDay: boolean;
  cutoff: string;
  week: number;
  weeks: number;
  termName: string;
  registers: Array<{ classId: string; arm: string; role: string; state: "Marked" | "In progress" | "Not started"; markedAt: string | null; roll: number; pastCutoff: boolean }>;
  sheets: Array<{ classId: string; subjectId: string; subject: string; arm: string; state: string; roll: number; entered: number; blanks: number }>;
  returned: Array<{ label: string; classId: string; subjectId: string; by: string; byRole: string; at: string | null; note: string }>;
  closes: string | null;
  remarks: { classId: string; arm: string; written: number; roll: number; due: string | null; days: number | null } | null;
  periods: Array<{ from: string; to: string; what: string; where: string; note: string; state: "done" | "now" | "next" | "later" }>;
  queue: Array<{ work: string; what: string; due: string; urgent: boolean; state: string; href: string; action: string; kind: string }>;
  sync: { pending: number; lastSyncedAt: string | null; items: Array<{ kind: string; at: string }> };
};

type OversightView = {
  department: string;
  term: string;
  reportsTo: { name: string; title: string } | null;
  kpis: { submitted: number; sheets: number; withTeacher: number; returnedByMe: number; mineSubmitted: number; mine: number; waitingOnMe: number };
  closes: string | null;
  rows: Array<{ classId: string; subjectId: string; unit: string; sub: string; owner: string; ownerId: string | null; state: string; age: string; overdue: boolean }>;
};

const ARROW = "M5 12h13M13 6.5l5.5 5.5L13 17.5";
const ICON = {
  reg: "M4 5.5h16V20H4zM8 3v4M16 3v4M8.5 14l2 2 4-4.5",
  score: "M6 3.5h12v17H6zM9.5 8.5h5M9.5 12.5h5M9.5 16.5h3",
  msg: "M4 5.5h16v10.5H9l-5 4zM8 9.5h8M8 12.8h5",
  clock: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17M12 7.5V12l3 2",
  pen: "M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z",
  shield: "M12 3.2 19.2 6v6.1c0 4.2-3 7.8-7.2 8.7-4.2-.9-7.2-4.5-7.2-8.7V6z",
};

const stateTone = (state: string): PanelTone =>
  state === "Returned" ? "negative"
  : state === "Not started" || state === "New" || state === "Waiting on you" || state === "Attention" ? "attention"
  : state === "In progress" || state === "Draft" ? "progress"
  : state === "Submitted" ? "submitted"
  : state === "Approved" || state === "Marked" || state === "Done" ? "positive"
  : "neutral";

const dayWords = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(iso));
const shortDay = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(iso));
const clockOf = (iso: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" }).format(new Date(iso));

export async function teacherMyDayTab(tabSlug: string, me: TeacherWorkspaceView, permissions: string[]): Promise<TabContent | null | undefined> {
  if (tabSlug === "oversight") return oversightTab(await apiGet<OversightView>("/api/v1/teacher-workspace/oversight"));
  if (tabSlug !== "today") return undefined;
  return todayTab(await apiGet<DayView>("/api/v1/teacher-workspace/day"), me, permissions);
}

function todayTab(d: DayView, me: TeacherWorkspaceView, permissions: string[]): TabContent {
  const held = new Set(permissions);
  const early = me.persona === "early-years";
  const open = d.registers.filter((entry) => entry.state !== "Marked");
  const dueSheets = d.sheets.filter((sheet) => sheet.state !== "Submitted" && sheet.state !== "Approved");
  const first = d.queue[0];

  const cards: KpiCard[] = [];
  if (d.registers.length) {
    cards.push({
      label: "Registers to mark", value: String(open.length), unit: `of ${d.registers.length}`,
      sub: !d.schoolDay ? "Today is not a school day" : open.length ? `The cutoff was ${d.cutoff}` : "Every register is in",
      tone: open.length && d.schoolDay ? "negative" : "positive",
      link: open.length ? "Mark one now" : "Open the registers",
      href: open.length ? `/attendance/mark/${open[0].classId}` : "/attendance/mark",
    });
  }
  if (d.sheets.length && !early) {
    cards.push({
      label: "Score sheets due", value: String(dueSheets.length), unit: `of ${d.sheets.length}`,
      sub: d.closes ? `The window closes ${shortDay(d.closes)}` : "No closing date has been set",
      tone: dueSheets.length ? "attention" : "positive", link: "Open your sheets", href: "/score-entry-results/enter",
    });
  }
  if (d.returned.length) {
    cards.push({ label: "Returned to you", value: String(d.returned.length), sub: "A return is a conversation, not a task", tone: "negative", link: "Read the comment", href: `/score-entry-results/enter/${d.returned[0].classId}/${d.returned[0].subjectId}` });
  }
  if (d.remarks && held.has("report-cards.remarks.view")) {
    const left = d.remarks.roll - d.remarks.written;
    cards.push({
      label: "Remarks outstanding", value: String(left), unit: `of ${d.remarks.roll}`,
      sub: d.remarks.due ? `Due ${shortDay(d.remarks.due)}${d.remarks.days !== null ? ` · ${Math.max(0, d.remarks.days)} days` : ""}` : "No publication date is set",
      tone: left ? "neutral" : "positive", link: d.remarks.written ? "Continue writing" : "Start writing", href: "/report-cards/remarks",
    });
  }
  cards.push({
    label: "Waiting to sync", value: String(d.sync.pending), unit: d.sync.pending === 1 ? "item" : "items",
    sub: d.sync.pending ? `Saved on this device since ${clockOf(d.sync.items[0].at)}` : "Nothing is waiting",
    tone: d.sync.pending ? "offline" : "positive", link: "What is queued", href: "/sync-support/sync",
  });
  const kpis = cards.slice(0, 5);

  const queueRows: TableRow[] = d.queue.map((item) => ({
    cells: [
      text(item.work, { strong: true }),
      text(item.what, { tone: "neutral" }),
      text(item.due, item.urgent ? { tone: "negative", strong: true } : {}),
      pill(item.state, stateTone(item.state)),
      { kind: "action", label: "Open", href: item.href },
    ],
  }));

  const periodRows: TableRow[] = d.periods.map((period) => ({
    cells: [
      text(`${period.from}–${period.to}`, { mono: true, strong: period.state === "next" || period.state === "now" }),
      text(period.what, { strong: true, tone: period.state === "done" ? "neutral" : undefined }),
      text(period.where),
      period.state === "next" ? pill("Next", "progress") : period.state === "now" ? pill("Now", "submitted") : text(period.note, { tone: "neutral" }),
    ],
  }));
  const nextPeriod = d.periods.find((period) => period.state === "next");

  const quick: Array<{ label: string; sub: string; icon: string; href: string; tone?: PanelTone }> = [];
  if (d.registers.length && held.has("attendance.mark.view")) {
    const target = open[0] ?? d.registers[0];
    quick.push({ label: "Mark a register", sub: `${target.arm} · about 60 seconds`, icon: ICON.reg, href: `/attendance/mark/${target.classId}`, tone: open.length ? "attention" : undefined });
  }
  if (d.sheets.length && held.has("score-entry-results.enter.view")) quick.push({ label: early ? "Add an observation" : "Enter scores", sub: `${d.sheets.length} sheet${d.sheets.length === 1 ? "" : "s"} · keyboard only`, icon: ICON.score, href: "/score-entry-results/enter" });
  if (d.registers.length && held.has("communication-center.compose.view")) quick.push({ label: `Message ${d.registers[0].arm} guardians`, sub: "Cost shown before it sends", icon: ICON.msg, href: "/communication-center/compose" });
  if (held.has("class-timetable.timetable.view")) quick.push({ label: "My timetable", sub: nextPeriod ? `Next: ${nextPeriod.what.split(" · ")[0]} at ${nextPeriod.from}` : "Your week at a glance", icon: ICON.clock, href: "/class-timetable/timetable" });

  const rail = teacherNavigation(me.persona, permissions);
  const hats = me.hats.map((hat) => [hat.role, hat.scope, hat.detail] as [string, string, string]);
  const approvalFor = me.persona === "head-of-department" ? `${me.department?.name ?? "Department"} submissions, never your own` : "None";
  const reportsTo = me.reportsTo?.name ?? "the Principal";

  const rows: Array<PanelRow | null> = [
    d.registers.some((entry) => entry.pastCutoff)
      ? row("1fr", [{ type: "note", tone: "negative", icon: ICON.clock, title: `Past the ${d.cutoff} cutoff`, body: `${open.filter((entry) => entry.pastCutoff).map((entry) => entry.arm).join(", ")} ${open.filter((entry) => entry.pastCutoff).length === 1 ? "has" : "have"} no register yet — nobody counts as present until you say so.`, acts: [{ label: "Mark it now", href: `/attendance/mark/${open[0].classId}` }] }])
      : null,
    row("1fr", [{ type: "kpi", sub: "Counted from your own assignments — nobody else’s.", per: kpis.length, cards: kpis }]),
    d.returned.length
      ? row("1fr", [{
          type: "list", title: "Returned to you", tag: `${d.returned.length} item${d.returned.length === 1 ? "" : "s"}`, tagTone: "negative",
          sub: "Kept apart from the queue, because a return is a conversation.", meta: d.returned[0].at ? clockOf(d.returned[0].at) : undefined,
          items: d.returned.map((entry) => ({
            label: entry.label, pill: "Returned", tone: "negative" as const, viewLabel: "Open it", href: `/score-entry-results/enter/${entry.classId}/${entry.subjectId}`,
            sub: `${entry.by}${entry.byRole ? `, ${entry.byRole}` : ""}: “${entry.note || "Returned for correction"}”`,
            facts: [
              ["Returned by", entry.by, entry.byRole],
              ["What to fix", entry.note || "See the comment", ""],
              ["Your work", "Editable again", "Nothing you entered has been changed"],
              ["After you resubmit", `It goes back to ${entry.by}`, "For a decision"],
            ] as Array<[string, string, string]>,
          })),
        } as Panel])
      : null,
    row("1.35fr 1fr", [
      {
        type: "table", title: "Your queue", tag: `${d.queue.length} ${d.queue.length === 1 ? "item" : "items"}`, tagTone: d.queue.length ? "attention" : "positive",
        sub: "In deadline order. One tap opens the screen that clears it.", meta: `${dayWords(d.date)} · nothing here belongs to anybody else`,
        noun: "item", nounPlural: "items", search: "Find something you owe", head: ["Work", "What it is", "Due", "State", ""], rows: queueRows, per: 8, noRowOpen: true,
        empty: "Nothing is waiting on you. An item appears here the moment something is yours to do.",
        foot: "An item leaves this list when the work is done — never because you looked at it.",
      },
      {
        type: "table", title: early ? "Today’s sessions" : "Today", sub: "In order. What is happening now and what is next are marked.",
        meta: d.schoolDay ? `${d.periods.length} period${d.periods.length === 1 ? "" : "s"}${nextPeriod ? ` · next is ${nextPeriod.what.split(" · ")[0]}` : ""}` : "Not a school day",
        noun: "period", nounPlural: "periods", head: ["Time", "What", "Where", "Note"], rows: periodRows, noRowOpen: true,
        empty: d.schoolDay ? "No period is timetabled for you today." : "Today is not a school day in this term.",
        foot: "A cover period is marked as cover, and leaves this page when the cover ends.",
      },
    ]),
    row("1fr 1fr", [
      { type: "tiles", title: "Quick actions", sub: "Four at most, chosen by what you hold.", per: 2, tiles: quick.slice(0, 4).map((tile) => ({ label: tile.label, sub: tile.sub, icon: tile.icon, tone: tile.tone, href: tile.href })) },
      { type: "device", title: "Sync", sub: "Never behind a menu, on any screen." },
    ]),
    row("1fr", [{
      type: "facts", title: "Why you see what you see", tuck: "Why you see what you see",
      sub: hats.length > 1 ? `${hats.length} concurrent grants, resolved into one set of permissions.` : "One grant, and everything it allows.", per: 2,
      facts: [
        ...hats,
        ["Modules visible", `${rail.items.length} of ${teacherModules.length}`, "The rest are absent from your navigation, not greyed out"],
        ["Fee visibility", held.has("fee-management.collections.view") ? "Granted by your school" : "None", "You will never see what a family owes unless your school grants it"],
        ["Approval", approvalFor, `Your own submissions go to ${reportsTo}`],
        ["Reach", "Your own arms and subject-arms", `This term · ${d.termName}, week ${d.week} of ${d.weeks}`],
      ],
    }]),
  ];

  return {
    title: early ? "Today’s sessions" : "My Day",
    desc: `${dayWords(d.date)} · everything you owe, in deadline order.`,
    primary: first ? { label: first.action, icon: ARROW, href: first.href } : { label: "Open my timetable", icon: ICON.clock, href: "/class-timetable/timetable" },
    rows: rows.filter((entry): entry is PanelRow => Boolean(entry)),
  };
}

function oversightTab(o: OversightView): TabContent {
  const k = o.kpis;
  const rows: Array<PanelRow | null> = [
    row("1fr", [{
      type: "kpi", per: 4, sub: `${o.term} · you hold this because you head ${o.department}.`,
      cards: [
        { label: "Sheets submitted", value: `${k.submitted} of ${k.sheets}`, sub: `${k.withTeacher} still with their teacher`, tone: k.submitted < k.sheets ? "attention" : "positive", link: "Open the queue", href: "/score-entry-results/review" },
        { label: "Waiting on you", value: String(k.waitingOnMe), sub: k.waitingOnMe ? "Submitted and not yet decided" : "Nothing is waiting for your decision", tone: k.waitingOnMe ? "attention" : "positive", link: k.waitingOnMe ? "Decide them" : undefined, href: k.waitingOnMe ? "/score-entry-results/review" : undefined },
        { label: "Returned by you", value: String(k.returnedByMe), sub: k.returnedByMe ? "Sent back for correction" : "Nothing sent back this term" },
        { label: "Your own sheets", value: `${k.mineSubmitted} of ${k.mine}`, sub: "You are counted like everyone else", tone: k.mine && k.mineSubmitted < k.mine ? "negative" : k.mine ? "positive" : "neutral" },
      ],
    }]),
    row("1fr", [{
      type: "tracker", title: `Score sheets · ${o.department}`, sub: "The unit of work is a subject-arm.", meta: `${k.sheets} sheet${k.sheets === 1 ? "" : "s"} · ${k.sheets - k.submitted} outstanding`, noun: "sheets submitted",
      clear: { title: "Every sheet is in", body: `All ${k.sheets} ${o.department} sheets have been submitted for this component.` },
      rows: o.rows.filter((entry) => entry.state !== "Submitted" && entry.state !== "Approved").concat(o.rows.filter((entry) => entry.state === "Submitted" || entry.state === "Approved")).map((entry): TrackerRow => ({
        unit: entry.unit, sub: entry.sub, owner: entry.owner, role: "Subject teacher", state: entry.state, age: entry.age, overdue: entry.overdue,
        count: entry.state === "Submitted" || entry.state === "Approved" ? 0 : 1,
        href: entry.state === "Submitted" || entry.state === "Approved" ? `/score-entry-results/review` : `/score-entry-results/enter/${entry.classId}/${entry.subjectId}`,
        act: entry.state === "Submitted" ? "Review" : "Open",
      })),
    }]),
    k.mine
      ? row("1fr", [{
          type: "note", tone: "withheld", icon: ICON.shield, title: `You cannot approve your own ${k.mine === 1 ? "sheet" : `${k.mine} sheets`}`,
          body: `A sheet you entered or submitted is never approved by you — ${o.reportsTo ? `${o.reportsTo.name} decides it instead` : "someone else decides it"}. The rule is enforced at the moment of approval, not afterwards.`,
          acts: [{ label: "See where they go", href: "/score-entry-results/review" }],
        }])
      : null,
  ];
  return {
    title: "Oversight", desc: `The ${o.department} department, and nothing outside it.`,
    primary: { label: "Open the review queue", icon: ARROW, href: "/score-entry-results/review" },
    rows: rows.filter((entry): entry is PanelRow => Boolean(entry)),
  };
}

