import { apiGet } from "@/lib/api/server";
import { AT, decideCorrectionDrawer, openCaseDrawer, sendRecordDrawer, spoolDrawer, viewCorrectionDrawer } from "@/lib/modules/live/m4-forms";
import { dayHref, markHref, pct, rateTone, staffRecordHref, tone, trendHref, weekHref } from "@/lib/modules/live/m4-register";
import type { Log, Options, Trend, Week } from "@/lib/modules/live/m4-types";
import { plural } from "@/lib/modules/live/m7-format";
import { name as nameCell, pill, text, type DrawerSpec, type PanelRow, type PanelTone, type TabContent, type TableRow } from "@/lib/modules/panels";

/** The Log is the children over time: a trend per arm, who needs attention, and what the school has done about it. */

export const loadLog = () => apiGet<Log>(`${AT}/log`);
export const loadTrend = (classId: string) => apiGet<Trend>(`${AT}/register/${encodeURIComponent(classId)}/trend`);
export const loadWeek = (classId: string, start?: string) => apiGet<Week>(`${AT}/register/${encodeURIComponent(classId)}/week${start ? `?start=${encodeURIComponent(start)}` : ""}`);

const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";
const DOWNLOAD = "M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 19.5h15";
const flagTone = (flag: string): PanelTone => tone(flag);
const caseDrawer = (id: string, name: string, state: string): DrawerSpec => ({ mode: "view", kicker: "Log", title: `${name} · attendance`, sub: "The whole term, and what the school has already done about it.", readOnly: true, tone: flagTone(state), load: `/attendance/drawers/student/${id}` });

export function logTab(l: Log, options: Options): TabContent {
  const k = l.kpis;
  const policy = l.policy;
  const flaggedRows: TableRow[] = l.flagged.slice(0, 80).map((student) => ({
    id: student.id,
    keywords: `${student.name} ${student.adm} ${student.arm} flag:${student.flag}`,
    cells: [
      nameCell(student.name, student.adm),
      text(student.arm),
      text(String(student.days), { mono: true }),
      text(String(student.absent), { mono: true }),
      text(String(student.excused), { mono: true }),
      text(pct(student.rate), { strong: true, tone: rateTone(student.rate, policy) }),
      pill(student.flag, flagTone(student.flag)),
      student.told ? text(`Yes · ${plural(student.told, "time")}`) : student.reachable ? text("No") : text("No · no phone number", { tone: "negative" }),
      { kind: "action" as const, label: student.case === "OPEN" ? "Open case" : "Open", drawer: caseDrawer(student.id, student.name, student.flag) },
    ],
  }));
  const chronic = l.flagged.filter((student) => student.flag === "Chronic").length;

  const trendRows: TableRow[] = l.trend.map((arm) => ({
    id: arm.id,
    keywords: `${arm.name} ${arm.master ?? ""}`,
    cells: [
      text(arm.name, { strong: true }),
      arm.master ? text(arm.master) : text("Nobody named", { tone: "negative" }),
      ...arm.weeks.map((value) => text(value === null ? "—" : `${value}%`)),
      text(pct(arm.term), { strong: true, tone: rateTone(arm.term, policy) }),
      text(arm.direction, { strong: arm.direction !== "Steady", tone: arm.direction === "Falling" ? "negative" : arm.direction === "Rising" ? "positive" : undefined }),
      { kind: "action" as const, label: "Open", href: trendHref(arm.id) },
    ],
  }));

  const awaiting = l.corrections.filter((row) => row.awaiting);
  const correctionRows: TableRow[] = l.corrections.slice(0, 60).map((row) => ({
    id: row.id,
    keywords: `${row.who} ${row.arm} ${row.student} ${row.forDate}`,
    cells: [
      nameCell(row.who, row.arm),
      text(row.markedOn),
      text(row.forDate),
      pill(row.state, tone(row.state === "Same day" ? "Same day" : row.state)),
      text(`${row.student}: ${row.from} → ${row.to} · ${row.reasonCode}`),
      { kind: "action" as const, label: row.awaiting ? "Decide" : "View", drawer: row.awaiting ? decideCorrectionDrawer(row) : viewCorrectionDrawer(row) },
    ],
  }));

  return {
    title: "Log",
    desc: "Attendance over time, by arm and by child.",
    primary: { label: "Spool a record", icon: DOWNLOAD, drawer: spoolDrawer(options, { label: "Attendance · Log" }) },
    launchers: chronic ? [{ label: "Open the chronic absence cases", href: "/attendance/log#attention" }] : [],
    rows: [
      {
        cols: "1fr",
        panels: [{
          type: "kpi", title: l.term.name, sub: `${l.schoolDays} school days on record${l.plannedDays ? `, of a planned ${l.plannedDays}` : ""}${l.since ? ` · counted from ${new Date(`${l.since}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}.`, per: 5,
          cards: [
            { label: "School attendance", value: pct(k.rate), sub: k.rate === null ? "No register yet" : `Target ${policy.target}% · ${k.rate >= policy.target ? "above" : "below"} it`, tone: rateTone(k.rate, policy) },
            { label: "Best arm", value: pct(k.best?.term ?? null), sub: k.best ? k.best.name : "—", tone: "positive", link: k.best ? "Open the arm" : undefined, href: k.best ? trendHref(k.best.id) : undefined },
            { label: "Weakest arm", value: pct(k.worst?.term ?? null), sub: k.worst ? `${k.worst.name}${k.worst.master ? ` · ${k.worst.master}` : ""}` : "—", tone: k.worst && k.worst.term !== null && k.worst.term < policy.target ? "negative" : "neutral", link: k.worst ? "Open the arm" : undefined, href: k.worst ? trendHref(k.worst.id) : undefined },
            { label: "Chronic absence cases", value: String(k.chronic), sub: `Below ${policy.chronic}% · each one is a case, not a number`, tone: k.chronic ? "negative" : "positive" },
            { label: "Corrections this term", value: String(k.corrections.all), sub: `${k.corrections.backdated} backdated, ${k.corrections.sameDay} same-day${k.corrections.awaiting ? ` · ${k.corrections.awaiting} waiting` : ""}`, tone: k.corrections.awaiting ? "attention" : "withheld" },
          ],
        }],
      },
      {
        cols: "1fr",
        panels: [{
          type: "table", title: "Trend by arm", sub: `Week by week, against the school target of ${policy.target}%.`,
          meta: `${l.trend.length} arms · last ${l.weeks.length} weeks`, search: "Find an arm or a form master",
          filters: [{ label: "Arm", value: "All", options: ["All", ...l.trend.map((arm) => arm.name)], column: 0 }, { label: "Direction", value: "All", options: ["All", "Falling", "Steady", "Rising"], column: 2 + l.weeks.length + 1 }],
          acts: [{ label: "Spool by arm", drawer: spoolDrawer(options, { label: "Attendance · Trend by arm" }) }],
          head: ["Arm", "Form master", ...l.weeks.map((week) => `Wk ${week}`), "Term", "Direction", ""],
          noun: "arm", nounPlural: "arms", per: 10, rows: trendRows,
          foot: "Direction compares the last two weeks against the two before them. A week with no register on record is shown as a dash — it is unknown, not 100%.",
        }],
      },
      {
        cols: "1fr",
        panels: [{
          type: "table", title: "Students needing attention", tag: `${chronic} chronic`, tagTone: chronic ? "negative" : "positive",
          sub: `Anyone below the school's ${policy.chronic}% threshold, or falling fast.`,
          meta: `${l.flagged.length} children flagged · ${k.formal} formal ${k.formal === 1 ? "case" : "cases"} open`,
          search: "Find a child by name, admission number or arm",
          filters: [{ label: "Flag", value: "All", options: ["All", "Chronic", "Falling", "Watch"], column: 6 }],
          acts: [{ label: "Spool by student", drawer: spoolDrawer(options, { label: "Attendance · Students needing attention" }) }],
          head: ["Child", "Arm", "Days", "Abs", "Exc", "Term %", "Flag", "Guardian told", ""],
          noun: "child", nounPlural: "children", selectable: true, per: 8, rows: flaggedRows,
          bulkActs: [
            { label: "Message the guardians", drawer: sendRecordDrawer([], "Attendance · Log"), selection: { key: "students", noun: "child" } },
            { label: "Open a case for each", drawer: openCaseDrawer([]), selection: { key: "students", noun: "child" } },
            { label: "Export selected", primary: true, export: true },
          ],
          empty: "Nobody is below the watch line this term.",
          foot: "A chronic case opens by itself below the threshold, and cannot be closed without a recorded outcome.",
        }],
      },
      {
        cols: "1.15fr 1fr",
        panels: [
          {
            type: "table", title: "Corrections and backdating", sub: "Every change to a register already saved.",
            meta: `${k.corrections.all} this term · ${k.corrections.backdated} backdated`, search: "Find by teacher, arm or date",
            head: ["Who", "Marked on", "For date", "Type", "What", ""], noun: "correction", nounPlural: "corrections", per: 6, noRowOpen: true, rows: correctionRows,
            empty: "No register has been corrected this term.",
            tag: awaiting.length ? `${awaiting.length} waiting` : undefined, tagTone: awaiting.length ? "attention" : undefined,
            foot: "A same-day edit is free. Anything earlier routes for approval and keeps both values.",
          },
          {
            type: "facts", title: "What the rules are", tuck: "What the rules are", sub: "Who may change what, and what it costs in evidence.", per: 1,
            facts: [
              ["Chronic absence threshold", `Below ${policy.chronic}% in a term`, `Opens a case once ${policy.minDays} days are on record`],
              ["Same-day edit", "Free for the marker", "No approval, logged as an ordinary edit"],
              ["Prior-day edit", "Routes for approval", "Reason required; someone other than the requester decides"],
              ["Backdating", "Permission-gated", "Reason mandatory; listed here and on Compliance"],
              ["Guardian action", "Never direct", "They submit, the school decides, the decision is logged"],
              ["Marking cutoff", policy.markCutoff, `The bell is ${policy.bell}; a late child ${policy.lateCounts ? "still counts as in the room" : "counts against attendance"}`],
              ["Spooled records", "Logged each time", "Every spool is itself an audit entry"],
            ],
          },
        ],
      },
    ],
  };
}

/* ───────────────────────── one arm, the whole term ───────────────────────── */

export type TrendPage = { content: TabContent & { crumb: { label: string; href: string } } };

export function trendPage(t: Trend, options: Options): TrendPage {
  const policy = t.policy;
  const rows: PanelRow[] = [];
  if (t.rate !== null && t.rate < policy.target) {
    rows.push({ cols: "1fr", panels: [{ type: "note", tone: "negative", icon: WARN, title: `${t.arm.name} has been below the ${policy.target}% target in ${t.below} of ${t.weeks.length} weeks`, body: `The term average is ${t.rate}%.${t.worst ? ` Its lowest week was ${t.worst.label} at ${t.worst.rate}%.` : ""} ${t.missed ? `${plural(t.missed, "register")} were never marked, so some of these numbers rest on fewer days than they should.` : ""}`.trim(), acts: [...(t.arm.masterId ? [{ label: "Open the form master", href: staffRecordHref(t.arm.masterId) }] : []), { label: "Message the guardians", drawer: sendRecordDrawer(t.students.filter((student) => student.flag === "Chronic" || student.flag === "Falling").map((student) => ({ id: student.id, name: student.name })), t.arm.name) }] }] });
  }
  rows.push({
    cols: "1fr",
    panels: [{
      type: "kpi", title: "The term in numbers", sub: `${t.term.name} · ${t.weeks.length} weeks · ${t.schoolDays} school days on record`, per: 5,
      cards: [
        { label: "Term attendance", value: pct(t.rate), sub: `School target is ${policy.target}%`, tone: rateTone(t.rate, policy) },
        { label: "Best week", value: pct(t.best?.rate ?? null), sub: t.best ? `${t.best.label} · ${t.best.dates}` : "—", tone: "positive" },
        { label: "Worst week", value: pct(t.worst?.rate ?? null), sub: t.worst ? `${t.worst.label} · ${t.worst.dates}` : "—", tone: t.worst && (t.worst.rate ?? 100) < policy.target ? "negative" : "neutral" },
        { label: "Weeks below target", value: String(t.below), unit: `of ${t.weeks.length}`, sub: "Weeks under the school target", tone: t.below ? "attention" : "positive" },
        { label: "Registers never marked", value: String(t.missed), sub: "These days are unknown, not present", tone: t.missed ? "negative" : "positive" },
      ],
    }],
  });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "kpi", title: "Who is behind the number", sub: "The same term, read by person rather than by week.", per: 4,
      cards: [
        { label: "Roll", value: String(t.roll), sub: `Children in ${t.arm.name}` },
        { label: `Below ${policy.chronic}%`, value: String(t.counts.chronic), sub: t.counts.chronic ? "A formal case is open or due" : "Nobody is chronic", tone: t.counts.chronic ? "negative" : "positive" },
        { label: "Falling", value: String(t.counts.falling), sub: `Between ${policy.chronic}% and ${policy.watch}%`, tone: t.counts.falling ? "attention" : "positive" },
        { label: "Above 95%", value: String(t.counts.strong), sub: "No concern", tone: "positive" },
      ],
    }],
  });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "table", title: "Week by week", tag: `${t.below} below target`, tagTone: t.below ? "attention" : "positive",
      sub: "Every week of the term, with what was marked and what was missed.", meta: `${t.weeks.length} weeks · ${t.schoolDays} school days · target ${policy.target}%`,
      search: "Find a week by number or date",
      filters: [{ label: "Attendance", value: "All", options: ["All", "Below target", "At or above target"], match: { "Below target": "band:Below", "At or above target": "band:Above" } }],
      head: ["Week", "Dates", "Days", "Attendance", "Abs", "Late", "Exc", "Missed", "Marked by", ""],
      noun: "week", nounPlural: "weeks", per: 12, noRowOpen: true,
      rows: t.weeks.map((week) => ({
        keywords: `${week.label} ${week.dates} band:${week.rate !== null && week.rate < policy.target ? "Below" : "Above"}`,
        cells: [
          text(week.label, { strong: true }), text(week.dates), text(String(week.days), { mono: true }),
          text(pct(week.rate), { strong: true, tone: rateTone(week.rate, policy) }),
          text(String(week.absent), { mono: true }), text(String(week.late), { mono: true }), text(String(week.excused), { mono: true }),
          week.missed ? text(plural(week.missed, "day"), { tone: "negative", strong: true }) : text("—"),
          week.markers.length ? nameCell(week.markers[0], week.markers.length > 1 ? `+${week.markers.length - 1} more` : "Form master") : text("—"),
          { kind: "action" as const, label: "Open the week", href: weekHref(t.arm.id, week.key) },
        ],
      })),
      acts: [{ label: `Export the ${t.weeks.length} weeks`, primary: true, drawer: spoolDrawer(options, { for: "A class arm", arm: t.arm.name, label: t.arm.name }) }],
      foot: "Open a week to see its days, and a day to see the register exactly as the form master marked it.",
    }],
  });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "table", title: "Children in this arm", tag: plural(t.roll, "child", "children"), tagTone: "neutral",
      sub: "The same term, per child. Open one for their full attendance record.",
      meta: `${t.counts.chronic} chronic · ${t.counts.falling} falling`, search: "Find a child by name or admission number",
      filters: [{ label: "Flag", value: "All", options: ["All", "Chronic", "Falling", "Watch", "No concern", "No record"], column: 6 }],
      acts: [{ label: "Message the guardians", drawer: sendRecordDrawer(t.students.map((student) => ({ id: student.id, name: student.name })), t.arm.name) }, { label: "Export the roster", primary: true, drawer: spoolDrawer(options, { for: "A class arm", arm: t.arm.name, label: t.arm.name }) }],
      head: ["Child", "Admission no", "Days", "Abs", "Late", "Term %", "Flag", "Case", ""],
      noun: "child", nounPlural: "children", selectable: true, per: 8,
      bulkActs: [
        { label: "Message the guardians", drawer: sendRecordDrawer([], t.arm.name), selection: { key: "students", noun: "child" } },
        { label: "Open a case for each", drawer: openCaseDrawer([]), selection: { key: "students", noun: "child" } },
        { label: "Export selected", primary: true, export: true },
      ],
      rows: t.students.map((student) => ({
        id: student.id,
        cells: [
          nameCell(student.name, student.adm), text(student.adm, { mono: true }), text(String(student.days), { mono: true }), text(String(student.absent), { mono: true }), text(String(student.late), { mono: true }),
          text(pct(student.rate), { strong: true, tone: rateTone(student.rate, policy) }), pill(student.flag, flagTone(student.flag)),
          student.case ? text(student.case === "OPEN" ? "Open" : "Closed", { tone: student.case === "OPEN" ? "negative" : "positive" }) : text("—"),
          { kind: "action" as const, label: student.flag === "Chronic" ? "Open case" : "Open", drawer: caseDrawer(student.id, student.name, student.flag) },
        ],
      })),
      foot: "A chronic case opens automatically below the threshold, and cannot be closed without a recorded outcome.",
    }],
  });
  return {
    content: {
      crumb: { label: "Back to the attendance log", href: "/attendance/log" },
      title: `${t.arm.name} · attendance trend`,
      desc: `${t.weeks.length} weeks, against the school target of ${policy.target}%.`,
      primary: { label: "Spool this arm's record", icon: DOWNLOAD, drawer: spoolDrawer(options, { for: "A class arm", arm: t.arm.name, label: t.arm.name }) },
      launchers: [
        { label: "Message the guardians", drawer: sendRecordDrawer(t.students.map((student) => ({ id: student.id, name: student.name })), t.arm.name) },
        ...(t.arm.masterId ? [{ label: "Open the form master", href: staffRecordHref(t.arm.masterId) }] : []),
      ],
      rows,
    },
  };
}

/* ───────────────────────── one arm, one week ───────────────────────── */

export function weekPage(w: Week, options: Options): TrendPage {
  const policy = w.policy;
  const missedDays = w.days.filter((day) => day.missed).length;
  const rows: PanelRow[] = [];
  if (missedDays) {
    rows.push({ cols: "1fr", panels: [{ type: "note", tone: "negative", icon: WARN, title: `${plural(missedDays, "register")} in this week ${missedDays === 1 ? "was" : "were"} never marked`, body: `Those days are unknown, not present. The week percentage below rests on ${w.taken} days instead of ${w.sat}, and every child's term figure is short by the same amount.`, acts: [{ label: "Mark it now", href: markHref(w.arm.id, w.days.find((day) => day.missed)?.date) }] }] });
  }
  rows.push({
    cols: "1fr",
    panels: [{
      type: "kpi", title: `${w.label}`, per: 5,
      cards: [
        { label: "Week attendance", value: pct(w.week.rate), sub: `School target ${policy.target}%`, tone: rateTone(w.week.rate, policy) },
        { label: "Days marked", value: String(w.taken), unit: `of ${w.sat}`, sub: w.taken === w.sat ? "Complete week" : "Gaps in the week", tone: w.taken === w.sat ? "positive" : "negative" },
        { label: "Absences", value: String(w.week.absent), sub: "Across the week", tone: w.week.absent ? "attention" : "positive" },
        { label: "Late arrivals", value: String(w.week.late), sub: `After the ${policy.bell} bell`, tone: w.week.late ? "attention" : "positive" },
        { label: "Excused", value: String(w.week.excused), sub: "Excluded from averages", tone: "neutral" },
      ],
    }],
  });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "table", title: `Every day in the week`, sub: "Open a day for the full register — every child and the mark they were given.",
      meta: `${w.label} · ${w.taken} of ${w.sat} registers taken`,
      head: ["Day", "Date", "Roll", "Present", "Absent", "Late", "Rate", "Marked at", "State", ""],
      noun: "day", nounPlural: "days", noRowOpen: true,
      rows: w.days.map((day) => ({
        cells: [
          text(day.name, { strong: true }), text(day.label), text(String(day.roll), { mono: true }),
          day.taken ? text(String(day.present), { mono: true }) : text("—"), day.taken ? text(String(day.absent), { mono: true }) : text("—"), day.taken ? text(String(day.late), { mono: true }) : text("—"),
          day.missed ? text("Unknown", { tone: "negative", strong: true }) : day.taken ? text(pct(day.rate), { strong: true, tone: rateTone(day.rate, policy) }) : text("—"),
          text(day.markedAt ?? "—", { mono: true }),
          pill(day.missed ? "Unmarked" : day.taken ? "Marked" : day.unrecorded ? "No registers kept" : day.sits ? "Draft" : "Not a school day", day.missed ? "negative" : day.taken ? "positive" : "neutral"),
          day.missed ? { kind: "action" as const, label: "Mark it", href: markHref(w.arm.id, day.date) } : day.taken ? { kind: "action" as const, label: "Open the register", href: dayHref(w.arm.id, day.date) } : text(""),
        ],
      })),
      foot: "A day with no register is shown as unknown. It is never counted as a full attendance.",
    }],
  });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "table", title: "Who was absent in this week", sub: "The children this week actually cost, with how many days each of them missed.",
      meta: `${w.week.absent} absences · ${w.week.late} late arrivals across ${plural(w.taken, "marked day")}`, search: "Find a child",
      head: ["Child", "Admission no", "Absent", "Late", "Reasons recorded", "Term %", ""],
      noun: "child", nounPlural: "children", per: 10, noRowOpen: true,
      rows: w.who.map((entry) => ({
        keywords: `${entry.name} ${entry.adm}`,
        cells: [nameCell(entry.name, w.arm.name), text(entry.adm, { mono: true }), text(String(entry.absent), { mono: true }), text(String(entry.late), { mono: true }), entry.reasons.length ? text(entry.reasons.join(" · ")) : text("No reason recorded", { tone: "attention" }), text(pct(entry.termRate), { strong: true, tone: rateTone(entry.termRate, policy) }), { kind: "action" as const, label: "Open", drawer: caseDrawer(entry.id, entry.name, "") }],
      })),
      emptyTitle: "Nobody missed a day this week", emptyBody: `Every child on the roll was present on all ${w.taken} marked days.`,
      acts: w.who.length ? [{ label: "Message these guardians", primary: true, drawer: sendRecordDrawer(w.who.map((entry) => ({ id: entry.id, name: entry.name })), `${w.arm.name} · ${w.label}`) }] : undefined,
    }],
  });
  return {
    content: {
      crumb: { label: `Back to ${w.arm.name}'s term`, href: trendHref(w.arm.id) },
      title: `${w.arm.name} · week of ${w.label}`,
      desc: `${w.sat} school days on record. Every day of this week and the register behind it.`,
      primary: { label: "Spool this week", icon: DOWNLOAD, drawer: spoolDrawer(options, { for: "A class arm", arm: w.arm.name, label: `${w.arm.name} · ${w.label}` }) },
      launchers: [
        ...(w.previous ? [{ label: "The week before", href: weekHref(w.arm.id, w.previous) }] : []),
        ...(w.next ? [{ label: "The week after", href: weekHref(w.arm.id, w.next) }] : []),
        { label: "Open the whole term", href: trendHref(w.arm.id) },
      ],
      rows,
    },
  };
}
