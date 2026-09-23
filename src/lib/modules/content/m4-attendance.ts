import {
  action,
  name as nameCell,
  pill,
  row,
  text,
  type ModuleContent,
  type PanelTone,
  type TableRow,
} from "@/lib/modules/panels";
import {
  attendanceArms,
  attendanceDay,
  formMasterOf,
  formMasters,
} from "@/lib/modules/school-data";

/**
 * M04 · Attendance — "The school's day, arm by arm."
 *
 * Written from the administrator's chair, as the mockup puts it: Register is
 * the whole school's day rather than one teacher's class, and Marking is kept
 * for the days an admin has to do it themselves. Compliance is about the
 * adults, not the children.
 *
 * Every count here derives from `school-data`, so no panel can describe a
 * different school than the table beneath it.
 */

const day = attendanceDay();
const masters = formMasters();

function percentTone(percent: number): PanelTone {
  return percent < 92 ? "attention" : "positive";
}

function punctualityTone(punctuality: number): PanelTone {
  return punctuality < 72 ? "negative" : punctuality < 90 ? "attention" : "neutral";
}

const everyArmToday: TableRow[] = attendanceArms.map((arm) => {
  const marked = arm.state === "Marked";
  const percent = marked ? Math.round((arm.present! / arm.roll) * 1000) / 10 : null;

  return {
    cells: [
      text(arm.arm, { strong: true }),
      nameCell(arm.formMaster, "Form master"),
      text(String(arm.roll), { mono: true }),
      marked ? text(String(arm.present), { mono: true }) : text("—"),
      marked
        ? text(String(arm.absent), arm.absent! > 1 ? { tone: "negative", strong: true } : {})
        : text("—"),
      percent === null
        ? text("—")
        : text(`${percent}%`, { strong: true, tone: percentTone(percent) }),
      pill(
        arm.state,
        arm.state === "Marked" ? "positive" : arm.state === "In progress" ? "progress" : "attention",
      ),
      action(arm.state === "Marked" ? "Open" : arm.state === "In progress" ? "Continue" : "Mark", "/attendance/mark"),
    ],
  };
});

const byTeacher: TableRow[] = [...masters]
  .sort((left, right) => left.punctuality - right.punctuality)
  .map((master) => ({
    cells: [
      nameCell(master.name, `Form master · ${master.department}`),
      text(master.armNames),
      text(String(master.roll), { mono: true }),
      text(`${master.done} of ${master.arms.length}`, {
        strong: true,
        tone: master.done === 0 ? "negative" : master.done < master.arms.length ? "attention" : "positive",
      }),
      text(`${master.punctuality}%`, { strong: true, tone: punctualityTone(master.punctuality) }),
      action("Open", "/attendance/compliance"),
    ],
  }));

const chooseAnArm: TableRow[] = [...attendanceArms]
  .sort((left, right) => (left.state === "Marked" ? 1 : 0) - (right.state === "Marked" ? 1 : 0))
  .map((arm) => ({
    cells: [
      text(arm.arm, { strong: true }),
      nameCell(arm.formMaster, "Form master"),
      text(String(arm.roll), { mono: true }),
      pill(
        arm.state,
        arm.state === "Marked" ? "positive" : arm.state === "In progress" ? "progress" : "attention",
      ),
      text(
        arm.state === "Marked"
          ? arm.markedAt === "—"
            ? "Just now"
            : arm.markedAt
          : arm.state === "In progress"
            ? "Being marked"
            : "—",
      ),
      action(arm.state === "Marked" ? "Open" : arm.state === "In progress" ? "Continue" : "Mark"),
    ],
  }));

const breachesByTeacher: TableRow[] = [...masters]
  .sort((left, right) => left.punctuality - right.punctuality)
  .map((master) => ({
    cells: [
      nameCell(master.name, `Form master · ${master.department}`),
      text(master.armNames),
      pill(
        master.done === master.arms.length ? "Marked" : master.done ? "In progress" : "Unmarked",
        master.done === master.arms.length ? "positive" : master.done ? "progress" : "attention",
      ),
      text(String(master.week), { mono: true }),
      text(String(master.term), { mono: true }),
      text(`${master.punctuality}%`, { strong: true, tone: punctualityTone(master.punctuality) }),
      text(master.pattern, {
        strong: master.pattern !== "Occasional",
        tone: master.pattern === "Repeat" ? "negative" : master.pattern === "Clean" ? "positive" : "neutral",
      }),
      action("Open"),
    ],
  }));

const weeklyTrend: Array<[string, string[], string, string, PanelTone, PanelTone]> = [
  ["JSS 3B", ["93%", "91%", "88%", "87%", "88%"], "89.4%", "Falling", "negative", "negative"],
  ["JSS 1C", ["94%", "92%", "90%", "90%", "90%"], "91.2%", "Falling", "attention", "attention"],
  ["SSS 2B", ["91%", "93%", "92%", "93%", "92%"], "92.3%", "Steady", "neutral", "neutral"],
  ["JSS 2C", ["92%", "94%", "94%", "94%", "94%"], "93.7%", "Steady", "neutral", "neutral"],
  ["JSS 2A", ["93%", "94%", "95%", "94%", "95%"], "94.2%", "Rising", "neutral", "positive"],
  ["JSS 3C", ["95%", "94%", "95%", "95%", "95%"], "94.8%", "Steady", "neutral", "neutral"],
  ["SSS 2A", ["96%", "95%", "96%", "96%", "96%"], "95.9%", "Steady", "positive", "neutral"],
  ["SSS 3A", ["97%", "98%", "97%", "97%", "97%"], "97.2%", "Steady", "positive", "neutral"],
];

export const attendanceContent: ModuleContent = {
  register: {
    title: "Register",
    desc: "The whole school's day, arm by arm.",
    rows: [
      row("1fr", [
        {
          type: "kpi",
          per: 5,
          cards: [
            {
              label: "Present today",
              value: `${day.percent}%`,
              unit: `of ${day.accounted} marked`,
              sub: `${day.present} present · school target is 92%`,
              tone: parseFloat(day.percent) >= 92 ? "positive" : "attention",
            },
            {
              label: "Registers in",
              value: String(day.marked),
              unit: `of ${day.arms} arms`,
              sub: `${day.unmarked} arms past the 09:30 cutoff`,
              tone: day.unmarked ? "attention" : "positive",
              link: `See the ${day.unmarked}`,
              href: "/attendance/compliance",
            },
            {
              label: "Absent",
              value: String(day.absent),
              sub: "Across the arms marked so far",
              tone: day.absent ? "attention" : "positive",
            },
            {
              label: "Late",
              value: String(day.late),
              sub: "All after 08:00, before 08:40",
              tone: day.late ? "attention" : "positive",
            },
            {
              label: "Chronic absence cases",
              value: "4",
              sub: "Below the 75% threshold this term",
              tone: "negative",
              link: "Open the cases",
              href: "/attendance/log",
            },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "Every arm, today",
          tag: `${day.unmarked} unmarked`,
          tagTone: "attention",
          sub: "Open an arm for its student list, or open the teacher to see everything they are responsible for.",
          meta: `${day.arms} arms · ${day.roll.toLocaleString()} students · as at 10:14`,
          acts: [
            { label: `Notify the ${day.unmarked} unmarked` },
            { label: "Export the day", primary: true },
          ],
          per: 10,
          noun: "arm",
          nounPlural: "arms",
          selectable: true,
          bulkActs: [
            { label: "Notify the form masters" },
            { label: "Reassign the arm" },
            { label: "Export selected", primary: true },
          ],
          head: ["Arm", "Form master", "Roll", "Pres", "Abs", "Today %", "State", ""],
          rows: everyArmToday,
          foot: "Today % is present against roll. An unmarked arm is not 0% — it is unknown, and counted as unknown. Late counts and marking times are inside each arm.",
        },
      ]),
      row("1.15fr 1fr", [
        {
          type: "table",
          title: "By teacher",
          sub: "Every form master, and the arms they answer for.",
          meta: `${masters.length} form masters · ${masters.filter((master) => master.done === 0).length} have not marked anything today`,
          per: 8,
          noun: "teacher",
          nounPlural: "teachers",
          head: ["Teacher", "Arms", "Roll", "Marked", "Punctuality", ""],
          rows: byTeacher,
          foot: "Open a teacher to see their arms, their marking history, and to move an arm to someone else.",
        },
        {
          type: "list",
          title: "Guardian explanations",
          sub: "A guardian submits; the school decides.",
          acts: [{ label: "Open all submissions", href: "/parents-guardians/submissions" }],
          items: [
            {
              label: "Emeka Okafor · 2 and 4 September",
              sub: "Mrs Chinyere Okafor: “Malaria, treated at Garki Hospital.”",
              pill: "New",
              tone: "attention",
              viewLabel: "Decide",
              facts: [
                ["Student", "Emeka Okafor", "GIA/23/0407 · SSS 2A"],
                ["Dates", "2 and 4 September", "2 school days"],
                ["Submitted by", "Mrs Chinyere Okafor", "Mother · primary contact"],
                ["Reason given", "Malaria, treated at Garki Hospital"],
                ["Evidence", "Hospital card photographed", "Attached 4 September, 18:22"],
                ["If accepted", "Absent becomes Excused", "His term percentage moves from 88% to 94%"],
                ["State", "New"],
              ],
            },
            {
              label: "Aisha Mohammed · 1 September",
              sub: "Mr Sani Mohammed: “Family bereavement in Kaduna.” No attachment.",
              pill: "New",
              tone: "attention",
              viewLabel: "Decide",
              facts: [
                ["Student", "Aisha Mohammed", "GIA/23/0412 · SSS 2A"],
                ["Date", "1 September", "1 school day"],
                ["Submitted by", "Mr Sani Mohammed", "Father"],
                ["Reason given", "Family bereavement in Kaduna"],
                ["Evidence", "None attached", "Your policy allows a bereavement without evidence"],
                [
                  "Note",
                  "She is already a chronic absence case",
                  "72% this term, below the 75% threshold",
                ],
                ["State", "New"],
              ],
            },
            {
              label: "Fatima Bello · 28 August",
              sub: "Accepted by you on 29 August — Absent became Excused.",
              pill: "Resolved",
              tone: "positive",
              viewLabel: "View",
              facts: [
                ["Student", "Fatima Bello", "GIA/23/0409 · SSS 2A"],
                ["Date", "28 August"],
                ["Decided by", "You · Adaeze Nwosu", "29 August, 09:14"],
                ["Decision", "Accepted", "Absent became Excused"],
                ["Effect", "Term percentage moved 93% → 94%"],
                ["State", "Resolved"],
              ],
            },
          ],
        },
      ]),
    ],
  },

  mark: {
    title: "Mark a register",
    desc: "Choose the class arm first.",
    rows: [
      row("1fr", [
        {
          type: "note",
          tone: "progress",
          title: "Marking is normally the form master's job",
          body: "This is here for the days you have to do it yourself — a teacher is away, a phone has died, a register was never opened. Everything you mark here is logged under your name.",
        },
      ]),
      row("1fr", [
        {
          type: "kpi",
          per: 4,
          cards: [
            {
              label: "Registers marked",
              value: String(day.marked),
              unit: `of ${day.arms} arms`,
              sub: `${day.unmarked + day.partial} still open`,
              tone: day.unmarked ? "attention" : "positive",
            },
            {
              label: "Students accounted for",
              value: day.accounted.toLocaleString(),
              unit: `of ${day.roll.toLocaleString()}`,
              sub: "Across the arms marked so far",
              tone: "positive",
            },
            {
              label: "Absent so far",
              value: String(day.absent),
              sub: "Each one needs a reason on the register",
              tone: day.absent ? "attention" : "positive",
            },
            {
              label: "Past the cutoff",
              value: String(day.unmarked),
              unit: "arms",
              sub: "Their form masters have been notified",
              tone: day.unmarked ? "negative" : "positive",
            },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "Choose an arm to mark",
          sub: "Unmarked arms first. Open one and the register opens with every student in it.",
          meta: `${day.arms} arms · ${day.unmarked} unmarked`,
          per: 8,
          noun: "arm",
          nounPlural: "arms",
          head: ["Arm", "Form master", "Students", "State", "Marked at", ""],
          rows: chooseAnArm,
          foot: "Tap Mark on an unmarked arm, or Open on a marked one to review and correct it. Nobody is present until you say so — an unmarked student is not the same as a present one, and a register will not submit until every row is set.",
        },
      ]),
    ],
  },

  compliance: {
    title: "Compliance",
    desc: "Who marked, who did not, and who is breaching the rule.",
    rows: [
      row("1fr", [
        {
          type: "kpi",
          per: 5,
          cards: [
            {
              label: "Today",
              value: String(day.unmarked),
              unit: "arms",
              sub: "Unmarked past the 09:30 cutoff",
              tone: "negative",
            },
            {
              label: "This week",
              value: String(masters.reduce((total, master) => total + master.week, 0)),
              unit: "arm-days",
              sub: `Across ${masters.filter((master) => master.week > 0).length} form masters`,
              tone: "attention",
            },
            {
              label: "This term",
              value: String(masters.reduce((total, master) => total + master.term, 0)),
              unit: "arm-days",
              sub: `Of ${(day.arms * 34).toLocaleString()} expected · ${
                100 -
                Math.round(
                  (masters.reduce((total, master) => total + master.term, 0) / (day.arms * 34)) * 100,
                )
              }% compliance`,
              tone: "attention",
            },
            {
              label: "Repeat breachers",
              value: String(masters.filter((master) => master.pattern === "Repeat").length),
              unit: "teachers",
              sub: "Breached in 3 or more of the last 5 weeks",
              tone: "negative",
            },
            {
              label: "Median marking time",
              value: "52s",
              sub: "Up from 44s last term — worth a conversation",
              tone: "attention",
            },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "Breaches by teacher",
          tag: `${masters.filter((master) => master.pattern === "Repeat").length} repeat`,
          tagTone: "negative",
          sub: "Daily, weekly and termly, per form master. Move an arm to someone else from here.",
          meta: `${masters.length} form masters · ${masters.filter((master) => master.week > 0).length} have breached this week`,
          acts: [{ label: "Notify selected" }, { label: "Export for the record", primary: true }],
          per: 8,
          noun: "teacher",
          nounPlural: "teachers",
          selectable: true,
          bulkActs: [
            { label: "Notify selected" },
            { label: "Escalate to Head of Department" },
            { label: "Reassign their arms", primary: true },
          ],
          head: ["Teacher", "Arms", "Today", "Week", "Term", "Punctuality", "Pattern", ""],
          rows: breachesByTeacher,
          foot: "Week counts arm-days missed in the last 5 school days. Term counts them across all 34 so far.",
        },
      ]),
      row("1fr", [
        {
          type: "tracker",
          title: "Unmarked registers",
          sub: "The unit of work is an arm-day.",
          meta: "Thursday, 4 September",
          clear: {
            title: "Every register is marked",
            body: `All ${day.arms} arm-days for today are in. Nothing is waiting on anyone.`,
          },
          rows: [
            {
              unit: "JSS 1C · Thursday",
              sub: "28 students · daily register",
              owner: "Mrs Ngozi Eze",
              role: "Form master",
              state: "Not started",
              age: "2h past cutoff",
              overdue: true,
            },
            {
              unit: "JSS 3B · Thursday",
              sub: "31 students · daily register",
              owner: formMasterOf("JSS 3B"),
              role: "Form master",
              state: "Not started",
              age: "2h past cutoff",
              overdue: true,
            },
            {
              unit: "SSS 1A · Thursday",
              sub: "26 students · daily register",
              owner: "Mr Samuel Adeyemi",
              role: "Form master",
              state: "In progress",
              age: "Started 09:41",
            },
            {
              unit: "SSS 2B · Thursday",
              sub: "24 students · daily register",
              owner: "Mrs Blessing Uche",
              role: "Form master",
              state: "Not started",
              age: "1h past cutoff",
              overdue: true,
            },
            {
              unit: "SSS 3A · Thursday",
              sub: "22 students · daily register",
              owner: "Mr Peter Obi",
              role: "Form master",
              state: "Not started",
              age: "45m past cutoff",
            },
            {
              unit: "JSS 2C · Thursday",
              sub: "30 students · daily register",
              owner: "Miss Grace Etim",
              role: "Form master",
              state: "Not started",
              age: "30m past cutoff",
            },
            {
              unit: "JSS 2A · Thursday",
              sub: "34 students · daily register",
              owner: "Adaeze Nwosu",
              role: "Principal · you",
              state: "Marked",
              age: "08:12",
            },
            {
              unit: "JSS 1A · Thursday",
              sub: "29 students · daily register",
              owner: "Mrs Folake Adeniyi",
              role: "Form master",
              state: "Marked",
              age: "07:58",
            },
          ],
        },
      ]),
      row("1fr 1fr", [
        {
          type: "bars",
          title: "Missing days per arm, this term",
          sub: "What an inspection asks for.",
          rows: [
            { label: "JSS 1C", value: 6, display: "6 days", tone: "negative" },
            { label: "SSS 2B", value: 4, display: "4 days", tone: "attention" },
            { label: "JSS 3B", value: 3, display: "3 days", tone: "attention" },
            { label: "SSS 3A", value: 1, display: "1 day", tone: "positive" },
            { label: "All other arms", value: 0, display: "0 days", tone: "positive" },
          ],
        },
        {
          type: "table",
          title: "Backdated entries",
          noun: "entry",
          nounPlural: "entries",
          head: ["Who", "Marked on", "For date", "Reason"],
          rows: [
            {
              cells: [
                nameCell("Mr Peter Obi", "SSS 3A"),
                text("3 Sep"),
                text("2 Sep"),
                text("Network outage in the annex block"),
              ],
            },
            {
              cells: [
                nameCell("Mrs Ngozi Eze", "JSS 1C"),
                text("2 Sep"),
                text("28 Aug"),
                text("Register left in the staff room over the weekend"),
              ],
            },
            {
              cells: [
                nameCell("Miss Grace Etim", "JSS 2C"),
                text("1 Sep"),
                text("29 Aug"),
                text("Covering for absent form master, phone had no storage"),
              ],
            },
          ],
        },
      ]),
    ],
  },

  log: {
    title: "Log",
    desc: "Attendance over time, by arm and by student.",
    rows: [
      row("1fr", [
        {
          type: "kpi",
          per: 5,
          cards: [
            {
              label: "School attendance",
              value: "94.2%",
              sub: "Target 92% · above it every week so far",
              tone: "positive",
            },
            { label: "Best arm", value: "97.2%", sub: "SSS 3A · 22 students", tone: "positive" },
            {
              label: "Weakest arm",
              value: "89.4%",
              sub: `JSS 3B · ${formMasterOf("JSS 3B")}`,
              tone: "negative",
            },
            {
              label: "Chronic absence cases",
              value: "4",
              sub: "Below 75% · each one is a case, not a number",
              tone: "negative",
            },
            {
              label: "Corrections this term",
              value: "23",
              sub: "11 backdated, 12 same-day",
              tone: "withheld",
            },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "Trend by arm",
          sub: "Week by week, against the school target of 92%.",
          meta: "8 arms · 5 weeks",
          per: 8,
          noun: "arm",
          nounPlural: "arms",
          head: ["Arm", "Form master", "Wk 1", "Wk 2", "Wk 3", "Wk 4", "Wk 5", "Term", "Direction", ""],
          rows: weeklyTrend.map(([arm, weeks, term, direction, termTone, directionTone]) => ({
            cells: [
              text(arm, { strong: true }),
              text(formMasterOf(arm)),
              ...weeks.map((week) => text(week)),
              text(term, { strong: true, tone: termTone }),
              text(direction, {
                strong: direction !== "Steady",
                tone: directionTone,
              }),
              action("Open"),
            ],
          })),
          foot: "Direction compares the last two weeks against the two before them.",
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "Students needing attention",
          tag: "4 chronic",
          tagTone: "negative",
          sub: "Anyone below the school's 75% threshold, or falling fast.",
          meta: "12 students flagged · 4 are formal cases",
          acts: [
            { label: "Spool by student" },
            { label: "Message the guardians", primary: true, href: "/communication-center/compose" },
          ],
          per: 8,
          noun: "student",
          nounPlural: "students",
          selectable: true,
          bulkActs: [
            { label: "Message the guardians" },
            { label: "Open a case for each" },
            { label: "Export selected", primary: true },
          ],
          head: ["Student", "Arm", "Days", "Abs", "Exc", "Term %", "Flag", "Guardian told", ""],
          rows: [
            {
              cells: [
                nameCell("Aisha Mohammed", "GIA/23/0412"),
                text("SSS 2A"),
                text("34", { mono: true }),
                text("8", { mono: true }),
                text("1", { mono: true }),
                text("72%", { strong: true, tone: "negative" }),
                pill("Chronic", "negative"),
                text("Yes · 3 times"),
                action("Open case"),
              ],
            },
            {
              cells: [
                nameCell("Ibrahim Sule", "GIA/23/0430"),
                text("No arm"),
                text("34", { mono: true }),
                text("9", { mono: true }),
                text("0", { mono: true }),
                text("73%", { strong: true, tone: "negative" }),
                pill("Chronic", "negative"),
                text("No · no phone number", { tone: "negative" }),
                action("Open case"),
              ],
            },
            {
              cells: [
                nameCell("Samuel Bature", "GIA/2025/0290"),
                text("JSS 3B"),
                text("34", { mono: true }),
                text("8", { mono: true }),
                text("1", { mono: true }),
                text("73.5%", { strong: true, tone: "negative" }),
                pill("Chronic", "negative"),
                text("Yes · twice"),
                action("Open case"),
              ],
            },
            {
              cells: [
                nameCell("Blessing Ade", "GIA/23/0418"),
                text("No arm"),
                text("34", { mono: true }),
                text("9", { mono: true }),
                text("0", { mono: true }),
                text("73.5%", { strong: true, tone: "negative" }),
                pill("Chronic", "negative"),
                text("Yes · once"),
                action("Open case"),
              ],
            },
            {
              cells: [
                nameCell("Emeka Okafor", "GIA/23/0407"),
                text("SSS 2A"),
                text("34", { mono: true }),
                text("4", { mono: true }),
                text("0", { mono: true }),
                text("88%", { strong: true, tone: "attention" }),
                pill("Falling", "attention"),
                text("Yes · once"),
                action("Open"),
              ],
            },
            {
              cells: [
                nameCell("Tunde Ogunlesi", "GIA/23/0405"),
                text("SSS 2A"),
                text("34", { mono: true }),
                text("3", { mono: true }),
                text("1", { mono: true }),
                text("88.2%", { strong: true, tone: "attention" }),
                pill("Falling", "attention"),
                text("No"),
                action("Open"),
              ],
            },
            {
              cells: [
                nameCell("Chioma Nwankwo", "GIA/2026/0421"),
                text("No arm"),
                text("12", { mono: true }),
                text("2", { mono: true }),
                text("0", { mono: true }),
                text("83.3%", { strong: true, tone: "attention" }),
                pill("Watch", "attention"),
                text("No"),
                action("Open"),
              ],
            },
            {
              cells: [
                nameCell("David Eze", "GIA/24/0124"),
                text("JSS 2A"),
                text("34", { mono: true }),
                text("2", { mono: true }),
                text("1", { mono: true }),
                text("91.2%"),
                pill("Watch", "attention"),
                text("No"),
                action("Open"),
              ],
            },
          ],
          foot: "A chronic case is opened automatically below 75%, and cannot be closed without a recorded outcome.",
        },
      ]),
      row("1.15fr 1fr", [
        {
          type: "table",
          title: "Corrections and backdating",
          sub: "Every change to a register already saved.",
          meta: "23 this term · 11 backdated",
          per: 6,
          noun: "correction",
          nounPlural: "corrections",
          head: ["Who", "Marked on", "For date", "Type", "Reason", ""],
          rows: [
            {
              cells: [
                nameCell("Mr Peter Obi", "SSS 3A"),
                text("3 Sep"),
                text("2 Sep"),
                pill("Backdated", "attention"),
                text("Network outage in the annex block"),
                action("View"),
              ],
            },
            {
              cells: [
                nameCell("Mrs Ngozi Eze", "JSS 1C"),
                text("2 Sep"),
                text("28 Aug"),
                pill("Backdated", "attention"),
                text("Register left in the staff room over the weekend"),
                action("View"),
              ],
            },
            {
              cells: [
                nameCell("Miss Grace Etim", "JSS 2C"),
                text("1 Sep"),
                text("29 Aug"),
                pill("Backdated", "attention"),
                text("Covering for an absent form master, phone had no storage"),
                action("View"),
              ],
            },
            {
              cells: [
                nameCell("You · Adaeze Nwosu", "JSS 2A"),
                text("29 Aug"),
                text("28 Aug"),
                pill("Approved", "positive"),
                text("Fatima Bello: Absent became Excused after her guardian's explanation"),
                action("View"),
              ],
            },
            {
              cells: [
                nameCell("Mr Sule Bature", "JSS 3C"),
                text("27 Aug"),
                text("27 Aug"),
                pill("Same day"),
                text("Two students arrived after the register was saved"),
                action("View"),
              ],
            },
            {
              cells: [
                nameCell("Mrs Folake Adeniyi", "JSS 1A"),
                text("26 Aug"),
                text("26 Aug"),
                pill("Same day"),
                text("Marked absent in error, corrected within the hour"),
                action("View"),
              ],
            },
          ],
          foot: "A same-day edit is free. Anything earlier routes for approval and keeps both values.",
        },
        {
          type: "facts",
          title: "What the rules are",
          sub: "Who may change what, and what it costs in evidence.",
          facts: [
            [
              "Chronic absence threshold",
              "Below 75% in a term",
              "Opens a case in Oversight and on the student record",
            ],
            ["Same-day edit", "Free for the marker", "No approval, logged as an ordinary edit"],
            ["Prior-day edit", "Routes for approval", "Form master → Principal, comment required"],
            [
              "Backdating",
              "Permission-gated",
              "Reason mandatory; listed separately here and on Compliance",
            ],
            [
              "Guardian action",
              "Never direct",
              "They submit, the school decides, the decision is logged",
            ],
            ["Spooled records", "Kept for 7 years", "Every spool is itself an audit entry"],
          ],
        },
      ]),
    ],
  },
};
