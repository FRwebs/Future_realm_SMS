import { naira, schoolFees } from "@/lib/modules/fees-data";
import {
  attendanceByWeekday,
  blockedReturns,
  complianceReturns,
  customReports,
  datasets,
  dueSoonReturns,
  filedArchive,
  filedReturns,
  gradeDistribution,
  nextDeadlineDays,
  readyReturns,
  recordGaps,
  standardReports,
  subjectComparison,
  totalRecordGaps,
  type ComplianceReturn,
} from "@/lib/modules/reporting-data";
import {
  name as nameCell,
  pill,
  row,
  text,
  type DrawerSpec,
  type ModuleContent,
  type PanelTone,
  type TabContent,
  type TableRow,
} from "@/lib/modules/panels";
import { registryStudents } from "@/lib/modules/students-data";

/**
 * M14 · Analytics & Reports — "The school's data, as decisions and as evidence."
 *
 * Insights is for decisions; Compliance is for evidence. They are different
 * jobs: a return has a recipient, a deadline and a format, and it is either
 * filed or it is not. A return is built from live data at the moment it is
 * generated, never from a cached figure.
 */

const fees = schoolFees();

/* -------------------------------------------------------------- Insights */

const insightsTab: TabContent = {
  title: "Insights",
  desc: "Four segments: academic, attendance, financial, engagement.",
  primary: {
    label: "Export board",
    drawer: {
      kicker: "Insights",
      title: "Export the board pack",
      sub: "Every figure on this tab, in the order a board reads them.",
      facts: [
        ["Contains", "Academic, attendance, financial and engagement"],
        ["Period", "Second Term 2026/2027 · term day 34"],
        ["Source", "Live data at the moment you generate it", "Never a cached figure"],
        ["Format", "PDF · school letterhead, and the underlying CSV"],
        ["Logged", "Yes", "Every export is on the audit record"],
      ],
    },
  },
  rows: [
    row("1fr", [
      {
        type: "kpi",
        per: 5,
        cards: [
          {
            label: "School average",
            value: "68.4",
            sub: "Up 2.1 from First Term · using this school's own bands",
            tone: "positive",
          },
          { label: "Attendance", value: "94.2%", sub: "Down 0.8 from First Term", tone: "attention" },
          {
            label: "Collection rate",
            value: "77.3%",
            sub: "Up 5.5 points against this point last term",
            tone: "positive",
          },
          {
            label: "Portal activation",
            value: "1,161 of 1,182",
            sub: "98.2% of families · 21 never activated",
            tone: "positive",
          },
          {
            label: "Net enrolment growth",
            value: "+14",
            sub: "20 admitted · 3 withdrawn · 3 transferred in",
            tone: "positive",
          },
        ],
      },
    ]),
    row("1.15fr 1fr", [
      {
        type: "bars",
        title: "Academic · grade distribution",
        sub: "A1 to F9 with the school's own labels, not a generic scale.",
        rows: gradeDistribution.map((band) => ({
          label: band.label,
          value: band.pct,
          display: `${band.students} students`,
          tone: band.tone as PanelTone,
          sub: "note" in band ? band.note : undefined,
        })),
        foot: "The bands are this school's own, set in School Configuration · Curriculum — never a generic scale imposed on it.",
      },
      {
        type: "note",
        tone: "positive",
        icon: "M3.5 20.5h17M7 20.5v-6M11.6 20.5V8.5M16.2 20.5v-9M20.5 20.5V5.5",
        title: "Attendance-to-performance correlation · the most persuasive chart you can show a parent",
        body: "Students above 95% attendance average 74.8. Between 85 and 95 they average 66.2.",
        acts: [
          {
            label: "Open the chart",
            drawer: {
              kicker: "Insights · correlation",
              title: "Attendance against performance",
              sub: "The same students, grouped by how often they were in the room.",
              readOnly: true,
              readOnlyNote: "A correlation is read, not edited. The underlying marks live in Score Entry.",
              facts: [
                ["Above 95% attendance", "Average 74.8"],
                ["Between 85% and 95%", "Average 66.2", "8.6 points lower"],
                ["Below 85%", "Average 58.1", "16.7 points below the top band"],
                [
                  "What it does not say",
                  "That attendance causes the mark",
                  "A child who is often away is often away for a reason the school should ask about",
                ],
                ["Use it for", "A conversation with a guardian", "It is the most persuasive chart in the product"],
              ],
            },
          },
          { label: "See students below 75%", href: "/attendance/log" },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "Academic · subject comparison",
        sub: "Difficulty index, pass and credit rates, and movement against last term.",
        meta: "9 examinable subjects · SSS 2",
        noun: "subject",
        nounPlural: "subjects",
        per: 7,
        head: ["Subject", "Average", "Difficulty", "Pass rate", "Credit", "Movement", "Teaching insight"],
        rows: subjectComparison.map(
          (entry): TableRow => ({
            cells: [
              text(entry.subject, { strong: true }),
              entry.average === "No data"
                ? text("No data", { strong: true, tone: "negative" })
                : text(entry.average, { mono: true }),
              text(entry.difficulty),
              text(entry.passRate, { mono: true }),
              text(entry.credit, { mono: true }),
              entry.up === null
                ? text("—")
                : text(entry.movement, { strong: true, tone: entry.up ? "positive" : "attention" }),
              text(entry.insight),
            ],
            drawer: {
              kicker: "Subject · SSS 2",
              title: entry.subject,
              sub: entry.insight,
              tone: entry.average === "No data" ? "negative" : undefined,
              facts: [
                [
                  "Average",
                  entry.average,
                  entry.average === "No data"
                    ? "Nobody taught it in two arms, so no score can exist"
                    : "Across every arm taking it",
                ],
                ["Difficulty", entry.difficulty],
                ["Pass rate", entry.passRate],
                ["Credit rate", entry.credit],
                ["Movement", entry.movement, "Against last term, same component"],
                ["Teaching insight", entry.insight],
              ],
            },
            keywords: entry.difficulty,
          }),
        ),
        foot: "A subject with no data is not a subject that went badly — it is one nobody taught, and it is named as such rather than averaged away.",
      },
    ]),
    row("1fr 1fr 1fr", [
      {
        type: "bars",
        title: "Attendance & enrolment",
        sub: "By weekday — the pattern a school can actually act on.",
        rows: attendanceByWeekday.map((day) => ({
          label: day.label,
          value: day.pct,
          display: day.display,
          tone: day.tone as PanelTone,
          sub: "note" in day ? day.note : undefined,
        })),
      },
      {
        type: "list",
        title: "Financial",
        sub: "Ageing, exposure and what the term will actually bring in.",
        items: [
          {
            label: "Projected revenue at current enrolment",
            sub: `${naira(Math.round(fees.billed * 0.95))} of ${naira(fees.billed)} expected · based on the last three terms' collection curve`,
            pill: "95%",
            facts: [
              ["Billed this term", naira(fees.billed)],
              ["Projected", naira(Math.round(fees.billed * 0.95)), "95% of what was billed"],
              ["Basis", "The last three terms' collection curve", "Not a target, and not an assumption"],
              ["Collected so far", naira(fees.collected)],
            ],
          },
          {
            label: "Ageing · past 90 days",
            sub: "₦3,120,000 across 41 families · the hardest money to recover",
            pill: "22%",
            tone: "attention",
            facts: [
              ["Past 90 days", "₦3,120,000"],
              ["Families", "41"],
              ["Share of what is owed", "22%"],
              ["Why it matters", "The hardest money to recover", "Every week past 90 lowers the odds further"],
            ],
          },
          {
            label: "Discount exposure",
            sub: "₦2,180,000 across 5 rules · 3.5% of expected revenue",
            pill: "3.5%",
            facts: [
              ["Exposure", "₦2,180,000"],
              ["Rules", "5", "Sibling, staff, scholarship, hardship and early-payment"],
              ["Share of expected revenue", "3.5%"],
              ["Where they are set", "Fee Management · Structures"],
            ],
          },
          {
            label: "Income against expense",
            sub: "Expense figures are entered by the school, not computed by us",
            pill: "Manual",
            facts: [
              ["Income", "Computed from receipts", "Every naira traceable to a payment"],
              [
                "Expense",
                "Entered by the school",
                "Nooria does not see a supplier invoice, so it never pretends to compute one",
              ],
              ["What this view is", "The two placed side by side", "It is not an accounting system"],
            ],
          },
        ],
      },
      {
        type: "list",
        title: "Engagement",
        sub: "Portal, delivery and inbound volume.",
        items: [
          {
            label: "Login frequency",
            sub: "Median 4 logins a month · highest in SSS 3, lowest in Primary",
            pill: "4/mo",
            facts: [
              ["Median", "4 logins a month"],
              ["Highest", "SSS 3", "Examination year — guardians check results"],
              ["Lowest", "Primary", "Fewer results to check, fewer reasons to log in"],
            ],
          },
          {
            label: "Delivery rate by channel",
            sub: "SMS 96% · rich messaging 98% · in-app 71% of activated families opened",
            pill: "96%",
            facts: [
              ["SMS", "96% delivered", "The only channel that always arrives"],
              ["Rich messaging", "98% delivered", "Reaches families with the app"],
              ["In-app", "71% opened", "Of activated families"],
            ],
          },
          {
            label: "Announcement acknowledgement",
            sub: "Examination timetable acknowledged by 842 of 1,161",
            pill: "73%",
            facts: [
              ["Acknowledged", "842 of 1,161"],
              ["Announcement", "Examination timetable · sent 1 September"],
              ["What it means", "The other 319 have not opened it", "Not that they did not receive it"],
            ],
          },
          {
            label: "Unreachable families by arm",
            sub: "JSS 1C has 6 of the 21 · a single arm carries a third of the problem",
            pill: "21",
            tone: "attention",
            facts: [
              ["Unreachable", "21 families"],
              ["JSS 1C", "6 of the 21", "A single arm carries a third of the problem"],
              [
                "Why it clusters",
                "One arm's intake was enrolled in a rush",
                "Numbers were taken down wrong, or never taken at all",
              ],
              ["Where to fix it", "Parents & Guardians · Guardians"],
            ],
          },
        ],
      },
    ]),
  ],
};

/* --------------------------------------------------------------- Reports */

const fullExportDrawer: DrawerSpec = {
  mode: "commit",
  kicker: "F11 · full export",
  title: "Full-school export",
  sub: "Everything this school holds, in a format it can read without Nooria.",
  facts: [
    ["Datasets", String(datasets.length), datasets.map((entry) => entry.name).join(" · ")],
    ["Format", "Excel and CSV", "Never PDF as a data export"],
    ["Report cards", "Every issued card, as a PDF"],
    ["Who may take it", "The Proprietor", "Re-authentication and a code to their phone"],
    ["Logged", "Yes", "Every export is on the audit record, with who took it"],
    ["Permission", "None needed", "This school owns its data"],
  ],
  commitLabel: "Generate the export",
  commitDone: "Export started",
  commitDoneBody: "You will be told when it is ready. It is logged against your name.",
};

const reportsTab: TabContent = {
  title: "Reports",
  desc: "Every document this school issues, and all of its data.",
  primary: {
    label: "Generate report",
    drawer: {
      mode: "commit",
      kicker: "Reports",
      title: "Generate a report",
      sub: "Built from live data at the moment you generate it.",
      facts: [
        ["Standard reports", String(standardReports.length), "School-branded, dated, referenced"],
        ["Source", "Live data", "Never a cached figure"],
        ["Format", "Excel and CSV", "Never PDF as a data export"],
        ["Logged", "Yes", "Every generated copy is on the audit record"],
      ],
      commitLabel: "Generate it",
      commitDone: "Report generated",
      commitDoneBody: "It is dated, referenced and on the audit record against your name.",
    },
  },
  launchers: [{ label: "Full-school export", drawer: fullExportDrawer }],
  rows: [
    row("1fr", [
      {
        type: "kpi",
        per: 4,
        cards: [
          { label: "Standard reports", value: String(standardReports.length), sub: "School-branded, dated, referenced" },
          { label: "Custom definitions", value: String(customReports.length), sub: "2 scheduled to named recipients" },
          {
            label: "Datasets exportable",
            value: "9",
            sub: "Excel and CSV · every tier",
            tone: "positive",
          },
          { label: "Exports this session", value: "14", sub: "Every one written to the audit log" },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "note",
        tone: "positive",
        icon: "M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 19.5h15",
        title: "This school owns its data. You can export all of it, at any time, without asking anyone's permission.",
        body: "Every dataset in this workspace exports to Excel and CSV — students, staff, guardians, scores, attendance, payments, messages, consents and the full audit log.",
        acts: [
          {
            label: "Export a dataset",
            drawer: {
              kicker: "Reports",
              title: "Export a dataset",
              sub: "Every dataset, to Excel or CSV.",
              facts: datasets.map(
                (dataset): [string, string, string?] => [
                  dataset.name,
                  `${dataset.rows} rows`,
                  `Last taken ${dataset.lastTaken}`,
                ],
              ),
            },
          },
          { label: "Full-school export", drawer: fullExportDrawer },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "Standard reports",
        meta: "Excel and CSV · never PDF as a data export",
        search: "Find a report",
        noun: "report",
        nounPlural: "reports",
        per: 12,
        head: ["Report", "What it answers", "Last generated", "By", ""],
        rows: standardReports.map(
          (report): TableRow => ({
            cells: [
              nameCell(report.name, report.sub, { avatar: false }),
              text(report.answers),
              text(report.lastGenerated, report.lastGenerated === "Not yet this term" ? { tone: "attention" } : {}),
              text(report.by),
              {
                kind: "action",
                label: "Generate",
                drawer: {
                  mode: "commit",
                  kicker: "Standard report",
                  title: `Generate · ${report.name}`,
                  sub: report.answers,
                  facts: [
                    ["Report", report.name, report.sub],
                    ["What it answers", report.answers],
                    ["Last generated", report.lastGenerated, report.by === "—" ? "" : `By ${report.by}`],
                    ["Source", "Live data at the moment you generate it", "Never a cached figure"],
                    ["Format", "Excel and CSV", "School-branded, dated and referenced"],
                    ["Logged", "Yes", "With who generated it and when"],
                  ],
                  commitLabel: "Generate it",
                  commitDone: `${report.name} generated`,
                  commitDoneBody: "It is dated, referenced and on the audit record against your name.",
                },
              },
            ],
            keywords: report.sub,
          }),
        ),
      },
    ]),
    row("1.05fr 1fr", [
      {
        type: "table",
        title: "Custom reports",
        meta: `${customReports.length} saved · 2 scheduled`,
        noun: "definition",
        nounPlural: "definitions",
        acts: [
          {
            label: "Build a report",
            primary: true,
            drawer: {
              mode: "commit",
              kicker: "Custom reports",
              title: "Build a report",
              sub: "A definition, not a snapshot — it re-runs its criteria every time.",
              facts: [
                ["Shape", "Table, bar chart or line chart"],
                ["Grouped by", "Any field the dataset carries"],
                ["Schedule", "On demand, or to named recipients on a day and time"],
                ["Owner", "Whoever builds it", "They can share it with named people"],
              ],
              commitLabel: "Save the definition",
              commitDone: "Report definition saved",
              commitDoneBody: "It re-runs its criteria every time, so it is never a frozen list.",
            },
          },
        ],
        head: ["Definition", "Grouped by", "Schedule", "Owner", ""],
        rows: customReports.map(
          (report): TableRow => ({
            cells: [
              nameCell(report.name, report.shape, { avatar: false }),
              text(report.groupedBy),
              text(report.schedule, report.schedule === "On demand" ? {} : { tone: "progress" }),
              text(report.owner),
              {
                kind: "action",
                label: "Run",
                drawer: {
                  mode: "commit",
                  kicker: "Custom report",
                  title: `Run · ${report.name}`,
                  sub: report.shape,
                  facts: [
                    ["Grouped by", report.groupedBy],
                    ["Schedule", report.schedule],
                    ["Owner", report.owner],
                    ["Source", "Live data at the moment you run it"],
                    ["A definition, not a snapshot", "It re-runs its criteria every time"],
                  ],
                  commitLabel: "Run it",
                  commitDone: `${report.name} run`,
                  commitDoneBody: "It is on the audit record against your name.",
                },
              },
            ],
            keywords: report.shape,
          }),
        ),
      },
      {
        type: "table",
        title: "Data export",
        sub: "Every dataset, to Excel or CSV.",
        meta: "14 exports taken this session · each one logged",
        noun: "dataset",
        nounPlural: "datasets",
        per: 7,
        head: ["Dataset", "Rows", "Last taken", ""],
        rows: datasets.map(
          (dataset): TableRow => ({
            cells: [
              text(dataset.name, { strong: true }),
              text(dataset.rows, { mono: true }),
              text(dataset.lastTaken),
              {
                kind: "action",
                label: "Excel",
                drawer: {
                  mode: "commit",
                  kicker: "Data export",
                  title: `Export · ${dataset.name}`,
                  sub: `${dataset.rows} rows, to Excel or CSV.`,
                  facts: [
                    ["Dataset", dataset.name],
                    ["Rows", dataset.rows],
                    ["Last taken", dataset.lastTaken],
                    ["Format", "Excel and CSV", "Never PDF as a data export"],
                    ["Permission", "None needed", "This school owns its data"],
                    ["Logged", "Yes", "Every export is on the audit record"],
                  ],
                  commitLabel: "Export it",
                  commitDone: `${dataset.name} exported`,
                  commitDoneBody: "The file is on its way, and the export is on the audit record.",
                },
              },
            ],
          }),
        ),
      },
    ]),
  ],
};

/* ------------------------------------------------------------ Compliance */

function returnDrawer(entry: ComplianceReturn): DrawerSpec {
  return {
    kicker: `Compliance · ${entry.body}`,
    title: entry.state === "Filed" ? entry.name : `Generate · ${entry.name}`,
    sub: entry.ready
      ? "Built from live data at the moment you generate it."
      : "This return cannot be generated yet.",
    tone: entry.ready ? undefined : "negative",
    readOnly: entry.state === "Filed",
    readOnlyNote:
      entry.state === "Filed"
        ? `Filed ${entry.filed}. A filed return is archived with the data it was built from — a refiling is versioned, never an overwrite.`
        : undefined,
    facts: [
      ["Return", entry.name, entry.body],
      ["Period", entry.period],
      ["Due", entry.due, entry.state === "Filed" ? `Filed ${entry.filed}` : `${entry.days} days`],
      ["Format", entry.format, "Exactly as the recipient requires"],
      ["Covers", entry.covers],
      ["Source", "Live data at the moment you generate", "Never a cached figure"],
      [
        "State",
        entry.ready ? (entry.state === "Filed" ? "Filed" : "Ready to generate") : "Blocked",
        entry.blocker ?? "Everything it needs is on file",
      ],
      ["Responsible", entry.owner],
      ["Kept", "Every generated return is archived", "With who generated it and when"],
    ],
  };
}

const complianceTab: TabContent = {
  title: "Compliance",
  desc: "Every return this school owes, and whether it can be filed today.",
  primary: { label: "Generate a return", drawer: returnDrawer(complianceReturns[1]!) },
  launchers: [
    {
      label: "Add a return",
      drawer: {
        mode: "commit",
        kicker: "Compliance",
        title: "Add a compliance return",
        sub: "A return names its recipient, its deadline, its format and who is responsible.",
        facts: [
          ["Goes to", "The body that asks for it"],
          ["Format", "Exactly what the recipient requires", "Ministry template, portal CSV or fixed-width schema"],
          ["Responsible", "A named officer", "Reminders go to them and to the Principal"],
          ["Reminders", "At 60, 30 and 7 days"],
        ],
        commitLabel: "Add the return",
        commitDone: "Return added",
        commitDoneBody: "It is on the compliance calendar, with reminders at 60, 30 and 7 days.",
      },
    },
    {
      label: "Evidence pack for an inspection",
      drawer: {
        kicker: "Compliance",
        title: "Evidence pack for an inspection",
        sub: "One indexed PDF of everything an inspector asks for.",
        facts: [
          ["Contains", "Every policy, register, audit log and return", "The full year"],
          ["Period", "2026/2027 session"],
          ["Redaction", "Student names replaced with admission numbers", "Switchable"],
          ["Size", "About 240 pages"],
          ["Format", "PDF · indexed and bookmarked"],
          ["Generated by", "You", "Logged against your name"],
        ],
      },
    },
    { label: "Archive of filed returns", href: "/analytics-reports/reports" },
  ],
  rows: [
    row("1fr", [
      {
        type: "kpi",
        per: 6,
        cards: [
          { label: "Returns tracked", value: String(complianceReturns.length), sub: "Across 6 bodies" },
          {
            label: "Due within 35 days",
            value: String(dueSoonReturns.length),
            sub: dueSoonReturns.length
              ? `Soonest in ${Math.min(...dueSoonReturns.map((entry) => entry.days))} days`
              : "Nothing imminent",
            tone: dueSoonReturns.length ? "attention" : "positive",
          },
          {
            label: "Blocked",
            value: String(blockedReturns.length),
            sub: "Missing data on file",
            tone: blockedReturns.length ? "negative" : "positive",
          },
          {
            label: "Ready to generate",
            value: String(readyReturns.length),
            sub: "One click each",
            tone: "positive",
          },
          {
            label: "Filed this session",
            value: String(filedReturns.length),
            sub: "Archived with evidence",
            tone: "positive",
          },
          {
            label: "Next deadline",
            value: `${nextDeadlineDays} days`,
            sub: "Termly enrolment return",
            tone: "attention",
          },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "note",
        tone: "negative",
        title: `${blockedReturns.length} ${blockedReturns.length === 1 ? "return cannot" : "returns cannot"} be produced from the data on file today`,
        body: `${blockedReturns.map((entry) => `${entry.name} — ${entry.blocker}`).join(". ")}. None of this is a reporting problem; it is missing data, and it is fixable now rather than the week the return is due.`,
        acts: [
          { label: "Fix the record gaps", href: "/student-records/registry" },
          { label: "Fix the staff gaps", href: "/staff-access/directory" },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "Compliance returns",
        tag: `${complianceReturns.length} tracked`,
        tagTone: "neutral",
        sub: "Each one names its recipient, its deadline, its format and whether it can be produced today.",
        meta: `${complianceReturns.length} returns · ${filedReturns.length} filed · ${blockedReturns.length} blocked · next due in ${nextDeadlineDays} days`,
        search: "Find a return or a body",
        noun: "return",
        nounPlural: "returns",
        per: 10,
        selectable: true,
        filters: [
          {
            label: "Body",
            value: "All",
            options: [
              "All",
              "Ministry of Education",
              "State Universal Basic Education Board",
              "WAEC · West African Examinations Council",
              "Independent Schools Inspectorate",
              "Nigeria Data Protection Commission",
              "Teachers Registration Council",
              "School Board of Governors",
            ],
            column: 1,
          },
          {
            label: "State",
            value: "All",
            options: ["All", "Not started", "In progress", "Blocked", "Filed"],
            column: 6,
          },
          {
            label: "Responsible",
            value: "All",
            options: ["All", "Principal", "Registrar", "Exam Officer", "Bursar", "Data Protection Officer"],
            column: 5,
          },
        ],
        bulkActs: [
          { label: "Generate these returns" },
          { label: "Assign a responsible officer" },
          { label: "Export the calendar", primary: true },
        ],
        acts: [
          { label: "Export the compliance calendar" },
          {
            label: "Add a return",
            primary: true,
            drawer: {
              mode: "commit",
              kicker: "Compliance",
              title: "Add a compliance return",
              sub: "A return names its recipient, its deadline, its format and who is responsible.",
              facts: [
                ["Goes to", "The body that asks for it"],
                ["Reminders", "At 60, 30 and 7 days"],
              ],
              commitLabel: "Add the return",
              commitDone: "Return added",
              commitDoneBody: "It is on the compliance calendar.",
            },
          },
        ],
        head: ["Return", "Goes to", "Due", "Days", "Period", "Responsible", "State", ""],
        rows: complianceReturns.map((entry): TableRow => {
          const [owner, role] = entry.owner.split(" · ");

          return {
            cells: [
              nameCell(entry.name, entry.covers, { avatar: false }),
              text(entry.body),
              text(entry.due, {
                strong: true,
                tone:
                  entry.state === "Filed"
                    ? "positive"
                    : entry.days <= 14
                      ? "negative"
                      : entry.days <= 35
                        ? "attention"
                        : undefined,
              }),
              entry.state === "Filed" ? text("—") : text(String(entry.days), { mono: true }),
              text(entry.period),
              nameCell(owner!, role ?? ""),
              pill(
                entry.state,
                entry.state === "Filed"
                  ? "positive"
                  : entry.state === "Blocked"
                    ? "negative"
                    : entry.state === "In progress"
                      ? "progress"
                      : "neutral",
              ),
              entry.ready || entry.state === "Filed"
                ? {
                    kind: "action",
                    label: entry.state === "Filed" ? "Download" : "Generate",
                    drawer: returnDrawer(entry),
                  }
                : { kind: "action", label: "See what is missing", drawer: returnDrawer(entry) },
            ],
            keywords: `${entry.body} ${entry.owner}`,
          };
        }),
        foot: "A return is built from live data at the moment you generate it, never from a cached figure — and every generated copy is archived with who produced it.",
      },
    ]),
    row("1.1fr 1fr", [
      {
        type: "table",
        title: "What is missing before a return can be filed",
        sub: "Each row names the return it blocks, so the gap has a consequence.",
        meta: `${blockedReturns.length} returns blocked by ${totalRecordGaps} record gaps`,
        noun: "gap",
        nounPlural: "gaps",
        acts: [{ label: "Open the registry", href: "/student-records/registry" }],
        head: ["What is missing", "Count", "Blocks", "Where to fix it", ""],
        rows: recordGaps.map(
          (gap): TableRow => ({
            cells: [
              text(gap.missing, { strong: true }),
              text(String(gap.count), { mono: true }),
              text(gap.blocks),
              text(gap.fixIn),
              { kind: "action", label: "Fix", href: gap.href },
            ],
            keywords: gap.blocks,
          }),
        ),
        foot: "A missing transfer certificate is not a filing problem — it is a record problem that only becomes urgent the week a return is due.",
      },
      {
        type: "facts",
        title: "How a return is produced here",
        sub: "The same for every body, in every country.",
        per: 1,
        facts: [
          ["Built from", "Live data at the moment you generate it", "Never a cached or rounded figure"],
          [
            "Format",
            "Exactly what the recipient requires",
            "Ministry template, portal CSV or fixed-width schema",
          ],
          ["Validation", "Run before anything is produced", "A return with a gap tells you rather than filing short"],
          ["Redaction", "Names replaced with admission numbers where allowed", "Switchable per return"],
          ["Archived", "Every generated copy is kept", "With who generated it, when, and from what data"],
          ["Amendment", "A refiling is versioned", "The original is never overwritten"],
          ["Local rules", "Set per country and per body", "Nooria ships templates for each jurisdiction it operates in"],
          ["Reminders", "At 60, 30 and 7 days", "To the responsible officer and the Principal"],
          ["Evidence pack", "One indexed PDF of everything", "For an inspection visit"],
        ],
      },
    ]),
    row("1fr", [
      {
        type: "list",
        title: "Filed and archived",
        sub: "Every return this school has produced, with the data it was built from.",
        items: filedArchive.map((entry) => ({
          label: entry.label,
          sub: entry.sub,
          pill: entry.pill,
          tone: (entry.pill === "Filed" ? "positive" : "attention") as PanelTone,
          viewLabel: "Download",
          facts: [
            ["Return", entry.label],
            ["Filed", entry.sub],
            ["State", entry.pill, entry.pill === "Amended" ? "The original is kept alongside the amendment" : ""],
            ["Archived with", "The data it was built from", "So the figures can be checked years later"],
          ] as Array<[string, string, string?]>,
        })),
      },
    ]),
  ],
};

export const analyticsReportsContent: ModuleContent = {
  insights: insightsTab,
  reports: reportsTab,
  compliance: complianceTab,
};

/** The roll the exports report on, for the test that checks one school. */
export const exportedStudents = registryStudents.length;
