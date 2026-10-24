import { apiGet } from "@/lib/api/server";
import { AT, nudgeDrawer, notifyPersonDrawer, reassignDrawer, spoolDrawer } from "@/lib/modules/live/m4-forms";
import { markHref, staffRecordHref, tone } from "@/lib/modules/live/m4-register";
import type { Compliance, Options, TeacherRecord } from "@/lib/modules/live/m4-types";
import { plural } from "@/lib/modules/live/m7-format";
import { name as nameCell, pill, text, type DrawerSpec, type PanelTone, type TabContent, type TableRow, type TrackerRow } from "@/lib/modules/panels";

/** Compliance is about the adults: who marked, when, and who broke the school's own rule. */

export const loadCompliance = () => apiGet<Compliance>(`${AT}/compliance`);
export const loadTeacher = (id: string) => apiGet<TeacherRecord>(`${AT}/teachers/${encodeURIComponent(id)}`);

const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";
const BELL = "M12 3.5A5.5 5.5 0 0 0 6.5 9v3.2L5 15.5h14l-1.5-3.3V9A5.5 5.5 0 0 0 12 3.5z";
const patternTone = (pattern: string): PanelTone => (pattern === "Repeat" ? "negative" : pattern === "Clean" ? "positive" : "neutral");

export function complianceTab(c: Compliance, options: Options): TabContent {
  const k = c.kpis;
  const school = options.school || "the school";
  const breachers = c.teachers.filter((teacher) => teacher.week > 0 || teacher.todayMissing > 0);
  const people = breachers.map((teacher) => ({ id: teacher.id, name: teacher.name }));
  const repeat = c.teachers.filter((teacher) => teacher.pattern === "Repeat");
  const notifyAll = nudgeDrawer({
    people, kicker: "Attendance · Compliance", title: `Notify the ${plural(people.length, "form master")} who have breached`,
    who: "form masters with an unmarked register this week", what: "Which of their registers are unmarked, and for which days",
    extra: [["Unmarked on the day", plural(k.unmarked, "arm"), `Past the ${c.cutoff} cutoff`], ["Repeat breachers among them", String(repeat.length), "Breached in 3 or more of the last 5 weeks — a conversation, not a notification"]],
    href: "/attendance/mark", message: `One or more of your registers is unmarked. The rule is every register taken before ${c.cutoff}. Please take it now. — ${school}`,
  });

  const teacherRows: TableRow[] = c.teachers.map((teacher) => ({
    id: teacher.id,
    keywords: `${teacher.name} ${teacher.arms.join(" ")}`,
    cells: [
      nameCell(teacher.name, `Form master${teacher.dept ? ` · ${teacher.dept}` : ""}`),
      text(teacher.arms.join(", ")),
      pill(teacher.state, tone(teacher.state)),
      text(String(teacher.week), { mono: true }),
      text(String(teacher.term), { mono: true }),
      text(teacher.punctuality === null ? "—" : `${teacher.punctuality}%`, { strong: true, tone: teacher.punctuality === null ? undefined : teacher.punctuality < 72 ? "negative" : teacher.punctuality < 90 ? "attention" : "positive" }),
      text(teacher.pattern, { strong: teacher.pattern !== "Occasional", tone: patternTone(teacher.pattern) === "neutral" ? undefined : patternTone(teacher.pattern) }),
      { kind: "action" as const, label: "Open", drawer: { mode: "view", kicker: "Attendance · by teacher", title: teacher.name, sub: "Everything this teacher answers for, and how they are doing it.", readOnly: true, load: `/attendance/drawers/teacher/${teacher.id}` } },
    ],
  }));

  const tracker: TrackerRow[] = c.tracker.map((arm) => ({
    unit: `${arm.name} · ${c.label.split(",")[0]}`,
    sub: `${plural(arm.roll, "child", "children")} · daily register`,
    owner: arm.owner,
    role: arm.role,
    state: arm.state,
    age: arm.state === "Marked" ? (arm.markedAt ?? "Marked") : arm.state === "In progress" ? (arm.started ? `Started ${arm.started}` : "In progress") : arm.overdue ? (c.today ? `Past the ${c.cutoff} cutoff` : "Never marked") : "Inside the cutoff",
    overdue: arm.overdue,
    href: markHref(arm.id, c.date),
    count: arm.state === "Marked" ? 0 : 1,
    act: arm.state === "Marked" ? "Open" : "Mark it",
  }));

  const maxMissing = Math.max(1, ...c.missing.map((entry) => entry.days));

  return {
    title: "Compliance",
    desc: "Who marked, who did not, and who is breaking the rule.",
    primary: { label: people.length ? `Notify the ${people.length} who ${people.length === 1 ? "has" : "have"} breached` : "Nobody has breached", icon: BELL, drawer: people.length ? notifyAll : undefined },
    launchers: [
      { label: "Open the whole-school view", href: "/attendance/register" },
      { label: "Attendance trends", href: "/attendance/log" },
    ],
    rows: [
      ...(c.note ? [{ cols: "1fr", panels: [{ type: "note" as const, tone: "progress" as const, icon: WARN, title: "Showing an earlier day", body: c.note }] }] : []),
      ...(c.unassigned.length ? [{ cols: "1fr", panels: [{ type: "note" as const, tone: "attention" as const, icon: WARN, title: `${plural(c.unassigned.length, "arm")} ${c.unassigned.length === 1 ? "has" : "have"} no form master`, body: `${c.unassigned.slice(0, 8).join(", ")}${c.unassigned.length > 8 ? "…" : ""}. A rule nobody owns cannot be breached by anyone — name someone.`, acts: [{ label: "Name a form master", drawer: reassignDrawer(options, options.arms.filter((arm) => c.unassigned.includes(arm.name))) }] }] }] : []),
      {
        cols: "1fr",
        panels: [{
          type: "kpi", title: "Breaches", sub: `Against the school's own rule: every register taken before ${c.cutoff}${c.since ? ` · counted from ${new Date(`${c.since}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}` : ""}.`, per: 5,
          cards: [
            { label: c.today ? "Today" : "On the day shown", value: String(k.unmarked), unit: "arms", sub: k.unmarked ? `Unmarked past the ${c.cutoff} cutoff` : k.notYet ? `${k.notYet} still inside the cutoff` : "Every register is in", tone: k.unmarked ? "negative" : "positive" },
            { label: "This week", value: String(k.week), unit: "arm-days", sub: `Across ${plural(k.weekTeachers, "form master")}`, tone: k.week ? "attention" : "positive" },
            { label: "This term", value: String(k.term), unit: "arm-days", sub: k.compliance === null ? "Nothing to measure yet" : `Of ${k.owed.toLocaleString()} expected · ${k.compliance}% compliance`, tone: k.term ? "attention" : "positive" },
            { label: "Repeat breachers", value: String(k.repeat), unit: "teachers", sub: "Breached in 3 or more of the last 5 weeks", tone: k.repeat ? "negative" : "positive" },
            { label: "Median marking time", value: k.median === null ? "—" : k.median >= 90 ? `${Math.floor(k.median / 60)}m ${String(k.median % 60).padStart(2, "0")}s` : `${k.median}s`, sub: k.median === null ? "None recorded yet" : `Across ${k.medianOf} timed registers`, tone: "neutral" },
          ],
        }],
      },
      {
        cols: "1fr",
        panels: [{
          type: "table", title: "Breaches by teacher", tag: `${repeat.length} repeat`, tagTone: repeat.length ? "negative" : "positive",
          sub: "Daily, weekly and termly, per form master. Move an arm to someone else from here.",
          meta: `${c.teachers.length} form masters · ${c.teachers.filter((teacher) => teacher.week > 0).length} have breached this week`,
          search: "Find a teacher or an arm",
          filters: [{ label: "Pattern", value: "All", options: ["All", "Repeat", "Occasional", "Clean", "No record"], column: 6 }],
          acts: [{ label: "Export for the record", primary: true, export: true }],
          head: ["Teacher", "Arms", "On the day", "Week", "Term", "Punctuality", "Pattern", ""],
          noun: "teacher", nounPlural: "teachers", selectable: true, per: 8,
          bulkActs: [
            { label: "Notify selected", selection: { key: "users", noun: "teacher" }, drawer: nudgeDrawer({ people: [], kicker: "Attendance · Compliance", title: "Notify the selected form masters", who: "the form masters you selected", what: "Which of their registers are unmarked", href: "/attendance/mark", message: `One or more of your registers is unmarked. Please take it now. — ${school}` }) },
            { label: "Escalate to Head of Department", selection: { key: "users", noun: "teacher" }, drawer: (() => { const spec = nudgeDrawer({ people: [], kicker: "Attendance · Compliance", title: "Escalate to their head of department", who: "the form masters you selected, with their head of department copied", what: "Which registers are unmarked, and for how long", href: "/attendance/mark", message: `A register of yours has been left unmarked more than once. This is firm: please take it before the cutoff each day. — ${school}` }); if (spec.submit) spec.submit.body = { ...spec.submit.body, urgency: "Firm · names the deadline", copy: ["Their head of department"] }; return spec; })() },
            { label: "Reassign their arms", primary: true, selection: { key: "teachers", noun: "teacher" }, drawer: {
              mode: "form", kicker: "Attendance · Compliance", title: "Move their arms to someone else", sub: "Everything the selected teachers take moves to one person.",
              commitLabel: "Reassign", commitDone: "Arms reassigned", commitDoneBody: "The new form master owns these registers from now on, and has been told.",
              fields: [{ label: "New form master", kind: "select", options: options.staff.map((member) => member.name), value: options.staff[0]?.name ?? "", required: true, span: 2 }, { label: "Tell them", kind: "toggle", on: true, onLabel: "They are notified in-app", offLabel: "Silent", span: 2 }],
              submit: { endpoint: `${AT}/arms/reassign`, method: "POST", map: { "New form master": "teacher", "Tell them": "tell" }, encode: { "New form master": Object.fromEntries(options.staff.map((member) => [member.name, member.id])) } },
            } satisfies DrawerSpec },
          ],
          rows: teacherRows,
          foot: "Week counts arm-days missed or late in the last five school days on record. Term counts them across every day the school kept registers.",
        }],
      },
      {
        cols: "1fr",
        panels: [{
          type: "tracker", title: "Unmarked registers", sub: "The unit of work is an arm-day.", meta: c.label, noun: "registers marked", groups: ["By teacher", "By arm", "By state"],
          clear: { title: "Every register is marked", body: `All ${c.tracker.length} arm-days are in. Nothing is waiting on anyone.` }, rows: tracker,
        }],
      },
      {
        cols: "1fr 1fr",
        panels: [
          { type: "bars", title: "Missing days per arm, this term", sub: "What an inspection asks for — days the school kept registers that this arm did not.", rows: c.missing.slice(0, 8).map((entry) => ({ label: entry.name, value: Math.round((entry.days / maxMissing) * 100), display: plural(entry.days, "day"), tone: entry.days >= maxMissing * 0.7 ? "negative" : "attention" })), foot: c.missing.length ? undefined : "No arm has a missing day." },
          {
            type: "table", title: "Backdated entries", sub: "Registers taken after the day they are for.", head: ["Who", "Marked on", "For date", "Reason"], noun: "entry", nounPlural: "entries", per: 6, noRowOpen: true,
            rows: c.backdated.map((entry) => ({ cells: [nameCell(entry.who, entry.arm), text(entry.markedOn), text(entry.forDate), text(entry.reason)] })),
            empty: "Nobody has backdated a register this term.",
            acts: [{ label: "Spool the record", drawer: spoolDrawer(options, { for: "The whole school", label: "Attendance · Compliance" }) }],
          },
        ],
      },
    ],
  };
}

export function teacherDrawerPlan(t: TeacherRecord, school: string): { notify: DrawerSpec } {
  return {
    notify: notifyPersonDrawer({
      id: t.id, name: t.name, role: "Form master", phone: t.phone, email: t.email, kicker: "Attendance",
      owes: t.row ? `${plural(t.row.todayMissing, "register")} still unmarked` : "Their registers", items: t.row?.todayMissing ?? 0, oldest: "Today", last: t.lastNotified ?? "Never", href: "/attendance/mark", school,
    }),
  };
}

export { staffRecordHref };
