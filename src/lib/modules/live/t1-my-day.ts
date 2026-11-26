import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import type { TeacherWorkspaceView } from "@/lib/api/teacher-workspace";
import { teacherModules, teacherNavigation } from "@/lib/modules/teacher-workspace";
import type { DrawerSpec, KpiCard, Panel, PanelRow, PanelTone, TabContent, TableRow, TrackerRow } from "@/lib/modules/panels";
import { pill, row, text } from "@/lib/modules/panels";
import { formatDay } from "@/lib/date-format";

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

const BELL = "M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0";

type OversightView = {
  department: string;
  term: string;
  week: number | null;
  reportsTo: { name: string; title: string } | null;
  kpis: {
    submitted: number; sheets: number; withTeacher: number; returnedByMe: number; mineSubmitted: number; mine: number; waitingOnMe: number;
    /** The department's period registers today: how many were marked while the period was still running. */
    registersOnTime?: number; registersTaught?: number;
    /** This week's lesson notes: how many of the department's subject-arms have one in. */
    notesIn?: number; notesDue?: number;
  };
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

const dayWords = (iso: string) => formatDay(new Date(iso), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const shortDay = (iso: string) => formatDay(new Date(iso), { day: "numeric", month: "long", timeZone: "UTC" });
const clockOf = (iso: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" }).format(new Date(iso));

export async function teacherMyDayTab(tabSlug: string, me: TeacherWorkspaceView, permissions: string[]): Promise<TabContent | null | undefined> {
  if (tabSlug === "oversight") return oversightTab(await apiGet("/api/v1/teacher-workspace/oversight", observe<OversightView>(localContracts["src/lib/modules/live/t1-my-day.ts#d212aa81"])));
  if (tabSlug !== "today") return undefined;
  return todayTab(await apiGet("/api/v1/teacher-workspace/day", observe<DayView>(localContracts["src/lib/modules/live/t1-my-day.ts#362e85b9"])), me, permissions);
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
      tone: open.length && d.schoolDay ? "negative" : "positive",
      link: open.length ? "Mark one now" : "Open the registers",
      href: open.length ? `/attendance/mark/${open[0].classId}` : "/attendance/mark",
    });
  }
  if (d.sheets.length && !early) {
    cards.push({
      label: "Score sheets due", value: String(dueSheets.length), unit: `of ${d.sheets.length}`,
      tone: dueSheets.length ? "attention" : "positive", link: "Open your sheets", href: "/score-entry-results/enter",
    });
  }
  if (d.returned.length) {
    cards.push({ label: "Returned to you", value: String(d.returned.length), tone: "negative", link: "Read the comment", href: `/score-entry-results/enter/${d.returned[0].classId}/${d.returned[0].subjectId}` });
  }
  if (d.remarks && held.has("report-cards.remarks.view")) {
    const left = d.remarks.roll - d.remarks.written;
    cards.push({
      label: "Remarks outstanding", value: String(left), unit: `of ${d.remarks.roll}`,
      tone: left ? "neutral" : "positive", link: d.remarks.written ? "Continue writing" : "Start writing", href: "/report-cards/remarks",
    });
  }
  cards.push({
    label: "Waiting to sync", value: String(d.sync.pending), unit: d.sync.pending === 1 ? "item" : "items",
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
      },
      {
        type: "table", title: early ? "Today’s sessions" : "Today", sub: "In order. What is happening now and what is next are marked.",
        meta: d.schoolDay ? `${d.periods.length} period${d.periods.length === 1 ? "" : "s"}${nextPeriod ? ` · next is ${nextPeriod.what.split(" · ")[0]}` : ""}` : "Not a school day",
        noun: "period", nounPlural: "periods", head: ["Time", "What", "Where", "Note"], rows: periodRows, noRowOpen: true,
        empty: d.schoolDay ? "No period is timetabled for you today." : "Today is not a school day in this term.",
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

  const hour = Number.parseInt(d.clock.slice(0, 2), 10);
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const given = me.person.name.split(/\s+/).find((word) => !/^(mr|mrs|ms|miss|dr|prof|engr|chief|rev|pastor|alhaji|alhaja)\.?$/i.test(word)) ?? me.person.name;
  const deckIcon = (kind: string, work: string) => {
    const hint = `${kind} ${work}`.toLowerCase();
    return /regist|attend/.test(hint) ? ICON.reg : /score|sheet|observ/.test(hint) ? ICON.score : /remark|note|plan/.test(hint) ? ICON.pen : /return/.test(hint) ? ICON.shield : ICON.clock;
  };
  // The deck is what is owed, in deadline order. A teacher with little owed would be left with a single card, so the shortcuts they hold
  // follow it as "Also today" cards — real places to go, never invented work — until there are a few to page through.
  const owed = d.queue.slice(0, 5).map((item, index) => ({
    eyebrow: index === 0 ? "First · today" : `Next · ${item.due}`, icon: deckIcon(item.kind, item.work), title: item.work, sub: item.what,
    cta: { label: item.action, href: item.href } as { label: string; href: string } | null,
  }));
  const also = owed.length >= 4 ? [] : quick.filter((tile) => !d.queue.some((item) => item.href === tile.href)).slice(0, 4 - owed.length).map((tile) => ({
    eyebrow: owed.length ? "Also today" : "First · today", icon: tile.icon, title: tile.label, sub: tile.sub, cta: { label: "Open", href: tile.href } as { label: string; href: string } | null,
  }));
  const deck = [...owed, ...also];
  const phone: PanelRow = {
    ...row("1fr", [{
      type: "embed", component: "phone-today",
      props: {
        greeting: `${greet}, ${given}`,
        dateline: `${dayWords(d.date)} · Week ${d.week} of ${d.weeks}`,
        deck,
        nextLine: nextPeriod ? `Next period · ${nextPeriod.what.split(" · ")[0]} at ${nextPeriod.from}` : null,
        tiles: quick.slice(0, 4),
        returned: d.returned.map((entry) => ({
          title: entry.label, by: `${entry.by}${entry.byRole ? `, ${entry.byRole}` : ""}`, when: entry.at ? clockOf(entry.at) : "", note: entry.note || "Returned for correction",
          fix: `Your work is editable again. Resubmit it and it goes back to ${entry.by}.`, href: `/score-entry-results/enter/${entry.classId}/${entry.subjectId}`,
        })),
        queue: d.queue.map((item) => ({ title: item.work, sub: item.what, state: item.state, tone: stateTone(item.state), due: item.due, urgent: item.urgent, href: item.href })),
        periods: d.periods.map((period) => ({ from: period.from, to: period.to, title: period.what, sub: [period.where, period.note].filter(Boolean).join(" · "), state: period.state })),
        periodsTag: d.schoolDay ? (nextPeriod ? `Next · ${nextPeriod.from}` : `${d.periods.length} ${d.periods.length === 1 ? "period" : "periods"}`) : "Not a school day",
        lastSync: d.sync.lastSyncedAt ? `${shortDay(d.sync.lastSyncedAt)} · ${clockOf(d.sync.lastSyncedAt)}` : null,
      },
    }]),
    show: "phone",
  };
  // The desktop reads the rows above; a teacher's phone reads one screen drawn from the same day. The past-cutoff note stays on both.
  const shown = rows.filter((entry): entry is PanelRow => Boolean(entry)).map((entry, index) => (index === 0 && entry.panels[0]?.type === "note" ? entry : { ...entry, show: "desktop" as const }));

  return {
    title: early ? "Today’s sessions" : "My Day",
    desc: `${dayWords(d.date)} · everything you owe, in deadline order.`,
    primary: first ? { label: first.action, icon: ARROW, href: first.href } : { label: "Open my timetable", icon: ICON.clock, href: "/class-timetable/timetable" },
    rows: [...shown, phone],
  };
}

function oversightTab(o: OversightView): TabContent {
  const k = o.kpis;
  const late = k.registersTaught === undefined ? 0 : (k.registersTaught ?? 0) - (k.registersOnTime ?? 0);
  /*
   * The people holding the department up, and the one act this page is for.
   *
   * Only a sheet nobody has started is nudged: a sheet in progress is being worked on, and a
   * notification about it is noise. Each person is told what they personally owe and nothing about
   * anybody else — the same rule the department's own review queue follows.
   */
  const owing = [...new Map(
    o.rows
      .filter((entry) => entry.state === "Not started" && entry.ownerId && entry.ownerId !== null && entry.owner !== "You")
      .map((entry) => [entry.ownerId as string, { id: entry.ownerId as string, name: entry.owner }] as const),
  ).values()];
  const nudge: DrawerSpec | null = owing.length
    ? {
        mode: "commit", kicker: `${o.department} · score entry`, title: `Notify ${owing.length} ${owing.length === 1 ? "teacher" : "teachers"}`,
        sub: "This sends a notification. It is not an approval, and it changes nothing on any record.",
        facts: [
          ["Who is notified", String(owing.length), `Teachers in ${o.department} with an unstarted sheet · ${owing.map((person) => person.name).slice(0, 3).join(", ")}${owing.length > 3 ? "…" : ""}`],
          ["What they see", "Which sheet is outstanding, and the day the window closes", "Nothing is disclosed about anyone else"],
          ["Changes anything?", "No", "A notification never alters a record, a state or a deadline"],
        ],
        commitLabel: "Send the notification", commitDone: `Notification sent to ${owing.length} ${owing.length === 1 ? "person" : "people"}`,
        commitDoneBody: "It is in their inbox now. Each one received only what they personally owe.",
        submit: {
          endpoint: "/api/v1/score-results/notify", method: "POST",
          body: {
            users: owing.map((person) => person.id), channels: ["In-app inbox"],
            message: `Your ${o.department} score sheet is not started yet${o.closes ? ` — the window closes ${shortDay(o.closes)}` : ""}.`,
            kicker: `${o.department} · score entry`, urgency: "Reminder", href: "/score-entry-results/enter",
          },
        },
      }
    : null;
  const rows: Array<PanelRow | null> = [
    row("1fr", [{
      type: "kpi", per: 5, sub: `${o.term} · you hold this because you head ${o.department}.`,
      cards: [
        { label: "Sheets submitted", value: `${k.submitted} of ${k.sheets}`, tone: k.submitted < k.sheets ? "attention" : "positive", link: "Open the queue", href: "/score-entry-results/review" },
        // The department's registers and its notes are the head's two other answerables; they sit
        // beside the sheets rather than being reached for one tab at a time.
        {
          label: "Period registers on time",
          value: k.registersTaught === undefined ? "—" : `${k.registersOnTime ?? 0} of ${k.registersTaught}`,
          tone: k.registersTaught === undefined ? "neutral" : late ? "attention" : "positive",
          link: "See who", href: "/attendance/compliance",
        },
        {
          label: o.week ? `Week ${o.week} notes in` : "Notes in",
          value: k.notesDue === undefined ? "—" : `${k.notesIn ?? 0} of ${k.notesDue}`,
          tone: k.notesDue === undefined ? "neutral" : (k.notesIn ?? 0) >= (k.notesDue ?? 0) ? "positive" : "attention",
          link: "Sign them", href: "/lesson-notes/review",
        },
        { label: "Returned by you", value: String(k.returnedByMe), },
        { label: "Your own sheets", value: `${k.mineSubmitted} of ${k.mine}`, tone: k.mine && k.mineSubmitted < k.mine ? "negative" : k.mine ? "positive" : "neutral" },
      ],
    }]),
    row("1fr", [{
      type: "tracker", title: `Score sheets · ${o.department}`, sub: "The unit of work is a subject-arm.", meta: `${k.sheets} sheet${k.sheets === 1 ? "" : "s"} · ${k.sheets - k.submitted} outstanding`, noun: "sheets submitted",
      groups: ["By state", "By teacher", "By arm", "By age"],
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
    // The one thing this page is for is moving the people who are holding the department up; the
    // queue and the coverage audit are where it leads, not what it is for.
    primary: nudge
      ? { label: `Nudge the ${owing.length} who ${owing.length === 1 ? "has" : "have"} not submitted`, icon: BELL, drawer: nudge }
      : { label: "Open the review queue", icon: ARROW, href: "/score-entry-results/review" },
    launchers: nudge
      ? [{ label: "Open the review queue", href: "/score-entry-results/review" }]
      : [{ label: "Lesson note coverage", href: "/lesson-notes/coverage" }],
    rows: rows.filter((entry): entry is PanelRow => Boolean(entry)),
  };
}

