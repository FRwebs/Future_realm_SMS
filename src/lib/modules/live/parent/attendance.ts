import { apiGet } from "@/lib/api/server";
import { name as nameCell, pill, row, text } from "@/lib/modules/panels";
import type { DrawerSpec, ListItem, LinePoint, PanelFact, PanelTone, TableRow } from "@/lib/modules/panels";
import { PW, dDow, dLong, dShort, loadMe } from "@/lib/modules/live/parent/shared";
import type { ParentContent } from "@/lib/modules/live/parent/shared";

type Term = {
  id: string; label: string; short: string; session: string; start: string; end: string; current: boolean;
  marked: number; present: number; away: number; late: number; unexplained: number; pct: number | null;
};
type Child = {
  id: string; name: string; first: string; arm: string;
  today: { status: string; reason: string | null; at: string | null } | null;
  terms: Term[];
};
type Day = {
  childId: string; termId: string; date: string; status: string; reason: string | null; code: string | null;
  by: string; at: string | null; explained: boolean;
};
type Attendance = { children: Child[]; days: Day[]; today: string };

const TABS = ["This term", "History and trends"];

/** The school's own words for a mark, and the colour it reads in. */
const WORD: Record<string, string> = { PRESENT: "Present", LATE: "Late", ABSENT: "Absent", EXCUSED: "Excused", HOLIDAY: "Holiday" };
const TONE: Record<string, PanelTone> = { PRESENT: "positive", LATE: "attention", ABSENT: "negative", EXCUSED: "submitted", HOLIDAY: "offline" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const here = (status: string) => status === "PRESENT" || status === "LATE";
const pctText = (value: number | null) => (value === null ? "—" : `${Math.round(value * 10) / 10}%`);
const attTone = (value: number | null): PanelTone => (value === null ? "neutral" : value >= 95 ? "positive" : value >= 90 ? "attention" : "negative");

export async function attendancePage(child: string, query: Record<string, string | undefined>): Promise<ParentContent> {
  const [me, data] = await Promise.all([loadMe(), apiGet<Attendance>(`${PW}/attendance?child=${encodeURIComponent(child)}`)]);
  const one = child === "all" ? null : data.children.find((entry) => entry.id === child) ?? null;
  return one ? childAttendance(one, data, query, me.school) : familyAttendance(data, me.school);
}

/** Explaining an absence is the one thing this page exists to get done. */
const explainDrawer = (childId: string, childName: string, date?: string): DrawerSpec => ({
  kicker: "Attendance", title: `Explain ${childName}’s absence`, mode: "form",
  sub: "It goes to the school as a request you can follow. The mark changes only when the school accepts it.",
  fields: [
    { kind: "text", type: "date", label: "Which day?", required: true, value: date ?? "" },
    { kind: "area", label: "What happened?", required: true, value: "", placeholder: "Your own words — the school reads this, not a form" },
  ],
  commitLabel: "Send the explanation", commitDone: "Sent to the school",
  commitDoneBody: "You can follow it under Requests. The mark changes when the school accepts it.",
  submit: {
    endpoint: "/api/v1/parent-portal/submissions", method: "POST",
    map: { "What happened?": "detail", "Which day?": "date" },
    body: { type: "Absence explanation", studentId: childId },
  },
});

/** What one day's mark says, and who made it — a parent's first question about a mark they disagree with. */
const dayDrawer = (day: Day, childName: string): DrawerSpec => ({
  kicker: "Attendance", title: dDow(day.date), mode: "view", readOnly: true,
  sub: `${childName} · ${WORD[day.status] ?? day.status}`,
  facts: [
    ["Mark", WORD[day.status] ?? day.status, day.status === "LATE" ? "Counted as present" : "", TONE[day.status] ?? ""] as PanelFact,
    ["Marked by", day.by || "Not recorded", day.at ? `${dLong(day.at.slice(0, 10))} · ${day.at.slice(11, 16)}` : "The time was not recorded"],
    ["Reason", day.reason ?? (day.explained ? "Your explanation is with the school" : day.status === "ABSENT" ? "None recorded yet" : "—"), day.code ?? ""],
  ],
});

function awayItem(day: Day, childName: string, childId: string, withChild: boolean): ListItem {
  const date = new Date(`${day.date}T00:00:00Z`);
  const tone = day.explained && day.status === "ABSENT" ? ("submitted" as PanelTone) : TONE[day.status] ?? "neutral";
  return {
    lead: { top: MONTHS[date.getUTCMonth()]!.slice(0, 3).toUpperCase(), value: String(date.getUTCDate()), tone },
    label: `${withChild ? `${childName} · ` : ""}${dDow(day.date)}`,
    sub: day.reason ?? (day.explained ? "Your explanation is with the school. The mark changes when it is accepted." : day.status === "ABSENT" ? "No explanation yet." : ""),
    pill: day.explained && day.status === "ABSENT" ? "Explanation sent" : WORD[day.status] ?? day.status,
    tone,
    ...(day.status === "ABSENT" && !day.explained
      ? { viewLabel: "Explain", drawer: explainDrawer(childId, childName, day.date) }
      : { drawer: dayDrawer(day, childName) }),
  };
}

function familyAttendance(data: Attendance, school: string): ParentContent {
  const current = (entry: Child) => entry.terms.find((term) => term.current) ?? entry.terms[entry.terms.length - 1] ?? null;
  const away = data.days
    .filter((day) => !here(day.status) && day.status !== "HOLIDAY")
    .filter((day) => { const entry = data.children.find((kid) => kid.id === day.childId); const term = entry ? current(entry) : null; return term ? day.termId === term.id : false; });
  const unexplained = away.filter((day) => day.status === "ABSENT" && !day.explained);
  const firstToExplain = unexplained[0];
  const nameOf = (id: string) => data.children.find((entry) => entry.id === id);

  return {
    eyebrow: "Whole family", title: "Attendance",
    desc: `Today’s marks and every day away this term at ${school}. Late counts as present.`,
    ...(firstToExplain
      ? { primary: { label: `Explain ${nameOf(firstToExplain.childId)?.first ? `${nameOf(firstToExplain.childId)!.first}’s` : "an"} absence`, drawer: explainDrawer(firstToExplain.childId, nameOf(firstToExplain.childId)?.first ?? "this child", firstToExplain.date) } }
      : {}),
    rows: [
      row("1fr", [{
        type: "kpi", bare: true, per: Math.min(4, data.children.length + 1),
        cards: [
          ...data.children.map((entry) => {
            const term = current(entry);
            const mark = entry.today;
            return {
              label: `${entry.first} · today`,
              value: mark ? WORD[mark.status] ?? mark.status : "Not marked",
              sub: term ? `${pctText(term.pct)} this term` : "No register yet",
              tone: mark ? TONE[mark.status] ?? "neutral" : ("neutral" as PanelTone),
              href: `/portals/parent/attendance?child=${entry.id}`,
              icon: "register",
            };
          }),
          {
            label: "Waiting for you", value: String(unexplained.length),
            sub: unexplained.length ? `${unexplained.length} ${unexplained.length === 1 ? "absence" : "absences"} not explained` : "Every absence explained",
            tone: unexplained.length ? ("attention" as PanelTone) : ("positive" as PanelTone), icon: "listCheck",
          },
        ],
      }]),
      row("minmax(0,1.2fr) minmax(0,1fr)", [
        {
          type: "table", title: "This term, child by child", sub: "Late counts as present. Open a child for every earlier term.",
          noun: "child", nounPlural: "children", head: ["Child", "This term", "Last term", "Away", "Late", "Explanations"], dense: true,
          rows: data.children.map((entry): TableRow => {
            const term = current(entry);
            const index = term ? entry.terms.indexOf(term) : -1;
            const last = index > 0 ? entry.terms[index - 1]! : null;
            return {
              href: `/portals/parent/attendance?child=${entry.id}`,
              keywords: entry.name,
              cells: [
                nameCell(entry.name, entry.arm, { avatar: false }),
                { kind: "text", text: pctText(term?.pct ?? null), strong: true, mono: true },
                text(last ? pctText(last.pct) : "—", { mono: true }),
                text(String(term?.away ?? 0), { mono: true }),
                text(String(term?.late ?? 0), { mono: true }),
                pill(term?.unexplained ? `${term.unexplained} not explained` : "All explained", term?.unexplained ? "attention" : "positive"),
              ],
            };
          }),
          empty: "No child on your account has a register yet.",
          foot: "A mark is made on the morning register. An explanation changes it only when the school accepts it.",
        },
        {
          type: "list", title: "Days away and late arrivals", sub: "Explanations sit beside the marks they changed.",
          empty: "Everyone was present every school day this term.",
          items: away.map((day) => awayItem(day, nameOf(day.childId)?.first ?? "", day.childId, true)),
        },
      ]),
    ],
  };
}

function childAttendance(entry: Child, data: Attendance, query: Record<string, string | undefined>, school: string): ParentContent {
  const tab = TABS.includes(query.tab ?? "") ? query.tab! : TABS[0]!;
  const terms = entry.terms;
  const current = terms.find((term) => term.current) ?? terms[terms.length - 1] ?? null;
  const chosen = terms.find((term) => term.id === query.term) ?? current;
  const head = {
    eyebrow: `${entry.name} · ${entry.arm}`, title: "Attendance",
    tabs: TABS.map((label) => ({ label })), tab,
    desc: tab === TABS[1]
      ? `Every term ${entry.first} has been marked at ${school}, side by side.`
      : "The morning register decides the day. Late counts as present.",
    primary: { label: "Explain an absence", drawer: explainDrawer(entry.id, entry.first) },
  };

  if (tab === TABS[1]) {
    const points: LinePoint[] = terms
      .filter((term) => term.pct !== null)
      .map((term) => ({
        label: `${term.short} ${term.session.slice(2, 4)}`,
        v: term.pct,
        tip: `${term.label} · ${pctText(term.pct)} · ${term.present} of ${term.marked} days`,
        tone: attTone(term.pct),
        on: term.current,
      }));
    return {
      ...head,
      rows: [
        row("1fr", [{
          type: "line", title: "Attendance term by term", sub: `Every term on record for ${entry.first}.`,
          points, target: { value: 95, label: "School target 95%" },
          keys: [{ label: "95% or more", tone: "positive" }, { label: "90 to 94.9%", tone: "attention" }, { label: "Below 90%", tone: "negative" }],
          empty: `No register has been marked for ${entry.first} yet.`,
        }]),
        row("1fr", [{
          type: "table", title: "Every term on record", sub: "Open a term to see it day by day.",
          noun: "term", nounPlural: "terms", head: ["Term", "Present", "Away", "Late", "Not explained", "Attendance", ""], dense: true, per: 12,
          rows: [...terms].reverse().map((term): TableRow => ({
            href: `/portals/parent/attendance?child=${entry.id}&term=${term.id}`,
            keywords: term.label,
            cells: [
              nameCell(term.label, term.current ? "Running now" : `${dShort(term.start)} – ${dShort(term.end)}`, { avatar: false }),
              text(`${term.present} of ${term.marked}`, { mono: true }),
              text(String(term.away), { mono: true }),
              text(String(term.late), { mono: true }),
              text(String(term.unexplained), { mono: true }),
              pill(pctText(term.pct), attTone(term.pct)),
              { kind: "action", label: "Open", href: `/portals/parent/attendance?child=${entry.id}&term=${term.id}` },
            ],
          })),
          empty: "No term has been marked yet.",
        }]),
      ],
    };
  }

  if (!chosen) {
    return { ...head, rows: [row("1fr", [{ type: "note", tone: "neutral", title: "No register has been marked yet", body: `${entry.first}’s attendance appears here the day the school marks its first register.` }])] };
  }

  const days = data.days.filter((day) => day.childId === entry.id && day.termId === chosen.id);
  const away = days.filter((day) => !here(day.status) && day.status !== "HOLIDAY");
  const index = terms.indexOf(chosen);
  const previous = index > 0 ? terms[index - 1]! : null;
  const change = previous && previous.pct !== null && chosen.pct !== null ? Math.round((chosen.pct - previous.pct) * 10) / 10 : null;

  // The month to draw: the one asked for, else the last month with a mark.
  const months = [...new Set(days.map((day) => day.date.slice(0, 7)))].sort();
  const month = months.includes(query.month ?? "") ? query.month! : months[months.length - 1] ?? chosen.start.slice(0, 7);
  const monthDays = days.filter((day) => day.date.slice(0, 7) === month);
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5)) - 1;
  const lastDate = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const lead = Math.min((new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() + 6) % 7, 5);
  const weekdays: string[] = [];
  for (let date = 1; date <= lastDate; date += 1) {
    const iso = `${month}-${String(date).padStart(2, "0")}`;
    const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay();
    if (weekday > 0 && weekday < 6) weekdays.push(iso);
  }

  return {
    ...head,
    rows: [
      row("1fr", [{
        type: "kpi", bare: true, per: 4,
        cards: [
          { label: chosen.current ? "This term so far" : "Attendance", value: pctText(chosen.pct), sub: `${chosen.present} of ${chosen.marked} school days`, tone: attTone(chosen.pct), icon: "calendar" },
          { label: "Days away", value: String(chosen.away), sub: chosen.unexplained ? `${chosen.unexplained} not explained yet` : chosen.away ? "All explained" : "None", tone: chosen.unexplained ? "attention" : chosen.away ? "neutral" : "positive", icon: "person" },
          { label: "Late arrivals", value: String(chosen.late), sub: chosen.late ? "Counted as present" : "None", tone: chosen.late ? "attention" : "positive", icon: "clock" },
          previous
            ? { label: `Against ${previous.short}`, value: change === null ? "—" : change === 0 ? "Level" : `${change > 0 ? "+" : "−"}${Math.abs(change)} ${Math.abs(change) === 1 ? "pt" : "pts"}`, sub: `${pctText(previous.pct)} that term`, tone: change === null ? "neutral" : change > 0 ? "positive" : change < 0 ? "attention" : "neutral", icon: change !== null && change < 0 ? "trendDown" : "trendUp", href: `/portals/parent/attendance?child=${entry.id}&term=${previous.id}` }
            : { label: "Compared with", value: "First term", sub: `${entry.first}’s first term on record`, tone: "neutral" as PanelTone, icon: "calendar" },
        ],
      }]),
      row("minmax(0,1.5fr) minmax(0,1fr)", [
        {
          type: "calendar",
          title: `${MONTHS[monthIndex]} ${year}`,
          sub: chosen.current ? "Tap a day to see who marked it, and when." : `${chosen.label} · tap a day for the detail.`,
          per: 5,
          dow: ["Mon", "Tue", "Wed", "Thu", "Fri"],
          acts: months.map((entryMonth) => ({
            label: MONTHS[Number(entryMonth.slice(5)) - 1]!.slice(0, 3),
            href: `/portals/parent/attendance?child=${entry.id}&term=${chosen.id}&month=${entryMonth}`,
            on: entryMonth === month,
          })),
          legend: [
            { label: "Present", tone: "positive" }, { label: "Late", tone: "attention" },
            { label: "Absent", tone: "negative" }, { label: "Excused", tone: "submitted" },
          ],
          cells: [
            ...Array.from({ length: lead }, () => ({ label: "", blank: true })),
            ...weekdays.map((iso) => {
              const mark = monthDays.find((day) => day.date === iso) ?? null;
              return {
                label: String(Number(iso.slice(8))),
                note: mark ? `${WORD[mark.status] ?? mark.status}${iso === data.today ? " · today" : ""}` : iso > data.today ? "Coming up" : "No register",
                tone: mark ? TONE[mark.status] ?? "neutral" : undefined,
                today: iso === data.today,
                ...(mark ? { drawer: dayDrawer(mark, entry.first) } : {}),
              };
            }),
          ],
        },
        {
          type: "list", title: "Days away and late arrivals",
          sub: chosen.current ? "Planning an absence? You can explain one ahead of the day." : `As recorded that term.`,
          empty: `Present every school day ${chosen.current ? "so far" : "that term"}.`,
          items: [...away].reverse().map((day) => awayItem(day, entry.first, entry.id, false)),
        },
      ]),
    ],
  };
}
