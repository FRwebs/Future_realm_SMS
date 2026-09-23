import { exportDrawer, nudgeDrawer } from "@/lib/modules/drawers";
import {
  name as nameCell,
  pill,
  row,
  text,
  type DrawerSpec,
  type ModuleContent,
  type PanelTone,
  type TableRow,
} from "@/lib/modules/panels";
import {
  armSheetSummaries,
  examWindow,
  schoolResults,
  subjectSheets,
  type SheetState,
} from "@/lib/modules/scores-data";

/**
 * M05 · Score Entry & Results — "Every arm's submission, and every number explained."
 *
 * The administrator's first question is never "what is in this sheet" — it is
 * "which arms are done, and who is holding the rest up". So Review is per arm,
 * because an arm is what a report card is addressed to.
 */

const school = schoolResults();

function stateTone(state: SheetState): PanelTone {
  switch (state) {
    case "Approved":
      return "positive";
    case "Submitted":
      return "submitted";
    case "In progress":
      return "progress";
    case "Returned":
      return "attention";
    case "Blocked":
      return "negative";
    default:
      return "neutral";
  }
}

const approveTwelveDrawer: DrawerSpec = {
  mode: "commit",
  kicker: "Review",
  title: `Approve ${examWindow.readyToApprove} sheets`,
  sub: "Twelve submitted sheets with no open flags, across 5 arms.",
  facts: [
    ["Sheets", "12", "Across JSS 1A, JSS 1C, SSS 1B, SSS 2B and SSS 3A"],
    ["Students affected", "168"],
    ["Open flags", "0", "Anything flagged is excluded from a bulk approval"],
    ["You entered", "0 of the 12", "You cannot approve a sheet you entered"],
    [
      "Effect",
      "Those scores become final",
      "They feed the broadsheet and the report cards",
    ],
    ["Reversible", "For 48 hours", "After that a correction request is required"],
  ],
  commitLabel: "Approve all 12",
  commitDone: "12 sheets approved",
  commitDoneBody: "168 students' scores are final and now feed the broadsheet.",
};

const byArmRows: TableRow[] = armSheetSummaries.map((summary) => ({
  cells: [
    text(summary.arm, { strong: true }),
    summary.arm === "JSS 2A"
      ? nameCell(summary.formMaster, "Principal · you")
      : nameCell(summary.formMaster, "Form master"),
    text(`${summary.sheetsIn} of ${summary.expected}`, {
      strong: true,
      tone:
        summary.sheetsIn === summary.expected
          ? "positive"
          : summary.state === "Blocked"
            ? "negative"
            : "attention",
    }),
    text(String(summary.approved), { mono: true }),
    summary.flags
      ? text(String(summary.flags), { mono: true, strong: true, tone: summary.flags > 1 ? "negative" : "attention" })
      : text("0", { mono: true }),
    text(String(summary.roll), { mono: true }),
    summary.pendingFrom === "Nobody named"
      ? text("Nobody named", { tone: "negative", strong: true })
      : text(summary.pendingFrom, summary.pendingFrom === "—" ? {} : { tone: "attention" }),
    pill(summary.state, stateTone(summary.state)),
    {
      kind: "action",
      label: "Open",
      drawer: {
        kicker: `Score review · ${summary.arm}`,
        title: `${summary.arm} · ${summary.sheetsIn} of ${summary.expected} sheets in`,
        sub: `Form master ${summary.formMaster}.`,
        facts: [
          ["Sheets in", `${summary.sheetsIn} of ${summary.expected}`],
          ["Approved", String(summary.approved)],
          [
            "Open flags",
            summary.flags ? String(summary.flags) : "None",
            summary.flags ? "A flagged sheet is never bulk-approved" : "",
          ],
          ["Roll", String(summary.roll), `${summary.roll} report cards wait on this arm`],
          [
            "Waiting on",
            summary.pendingFrom === "—" ? "Nobody" : summary.pendingFrom,
            summary.pendingFrom === "Nobody named"
              ? "No teacher is mapped — a sheet cannot exist until one is"
              : "",
          ],
          [
            "State",
            summary.state,
            summary.state === "Blocked"
              ? "Blocked means a sheet cannot exist yet, not that it is late"
              : "",
          ],
        ] as Array<[string, string, string?]>,
      },
    },
  ],
  keywords: summary.formMaster,
}));

const verificationRows: TableRow[] = [
  {
    cells: [
      nameCell("Anomaly detection", "Score far from the student's own pattern"),
      text(
        "Tunde Ogunlesi scored 29 in Chemistry against a 71 term average across four subjects.",
      ),
      text("3", { mono: true }),
      {
        kind: "action",
        label: "Review",
        drawer: {
          kicker: "Verification · Anomaly",
          title: "Score far from the student's own pattern",
          sub: "Three scores sit well outside the child's own record.",
          facts: [
            ["Clearest case", "Tunde Ogunlesi · Chemistry · 29"],
            ["His term average", "71", "Across Mathematics, English, Physics and Biology"],
            ["Class average in Chemistry", "58.4"],
            [
              "What this is not",
              "An accusation",
              "It is a prompt to look at the script before the mark goes final",
            ],
            ["Already raised", "A score correction is in the approvals queue"],
          ],
        },
      },
    ],
  },
  {
    cells: [
      nameCell("Duplicate score patterns", "Identical rows suggesting a copied sheet"),
      text("JSS 2B Mathematics — six consecutive students with the identical component split."),
      text("1", { mono: true }),
      {
        kind: "action",
        label: "Review",
        drawer: {
          kicker: "Verification · Duplicates",
          title: "Identical rows suggesting a copied sheet",
          sub: "Six consecutive students with the same component split.",
          facts: [
            ["Sheet", "Mathematics · JSS 2B"],
            ["What was found", "Six consecutive rows with an identical CA and examination split"],
            ["Entered by", "Mr Ibrahim Danladi"],
            ["State", "The sheet has been returned to the teacher"],
          ],
        },
      },
    ],
  },
  {
    cells: [
      nameCell("Grade-boundary cases", "Within one mark of a band boundary"),
      text("11 students at 39, 49 or 74 — one mark from Pass, Credit or A1."),
      text("11", { mono: true }),
      {
        kind: "action",
        label: "Review",
        drawer: {
          kicker: "Verification · Boundaries",
          title: "Within one mark of a band boundary",
          sub: "Eleven students sit one mark from a different band.",
          facts: [
            ["At 39", "One mark from a Pass"],
            ["At 49", "One mark from a Credit"],
            ["At 74", "One mark from an A1"],
            [
              "Why it is surfaced",
              "So a boundary is a decision, not an accident",
              "Nothing is changed automatically",
            ],
          ],
        },
      },
    ],
  },
  {
    cells: [
      nameCell("Zero review", "A genuine zero, or a blank entered as zero"),
      text("4 zeros in the Project component, all in one arm, all entered in one minute."),
      text("4", { mono: true }),
      {
        kind: "action",
        label: "Review",
        drawer: {
          kicker: "Verification · Zeros",
          title: "A genuine zero, or a blank entered as zero",
          sub: "Four zeros entered in one arm, within a minute of each other.",
          facts: [
            ["Component", "Project"],
            ["What was found", "Four zeros, one arm, all inside one minute"],
            [
              "Why it matters",
              "A blank is not a zero",
              "A zero counts against the child; a blank leaves the card uncomputed",
            ],
            ["What clears it", "The teacher confirming each one was actually a zero"],
          ],
        },
      },
    ],
  },
  {
    cells: [
      nameCell("Verification sample", "Deterministic re-computation with full traces"),
      text("30 students re-computed from stored components. All 30 match the published figure."),
      text("30", { mono: true }),
      {
        kind: "action",
        label: "View traces",
        drawer: {
          kicker: "Verification · Sample",
          title: "Deterministic re-computation",
          sub: "Thirty students re-computed from their stored components.",
          readOnly: true,
          readOnlyNote:
            "A verification sample is evidence. It is produced, stored and never edited.",
          facts: [
            ["Sampled", "30 students"],
            ["Method", "Re-computed from stored components", "Not from the published figure"],
            ["Result", "All 30 match", "No drift between what was stored and what was shown"],
            ["Framework", "Version 4", "The version the term was computed under"],
          ],
        },
      },
    ],
  },
];

const everyArmRows: TableRow[] = school.all.map((result) => ({
  cells: [
    text(result.arm, { strong: true }),
    nameCell(result.formMaster, "Form master"),
    text(String(result.roll), { mono: true }),
    result.blocked
      ? text(`${result.computed} of ${result.roll}`, { strong: true, tone: "attention" })
      : text(String(result.computed), { mono: true }),
    text(result.average.toFixed(1), {
      strong: true,
      tone: result.average >= 70 ? "positive" : result.average < 63 ? "negative" : "neutral",
    }),
    text(`${result.passRate}%`, { mono: true }),
    pill(result.topGrade, result.average >= 70 ? "positive" : "neutral"),
    pill(result.blocked ? "Incomplete" : "Complete", result.blocked ? "attention" : "positive"),
    {
      kind: "action",
      label: "Open",
      drawer: {
        kicker: `Results · ${result.arm}`,
        title: `${result.arm} · ${result.average.toFixed(1)} average`,
        sub: `Form master ${result.formMaster} · ${result.subjects} subjects.`,
        facts: [
          ["Roll", String(result.roll)],
          [
            "Computed",
            `${result.computed} of ${result.roll}`,
            result.blocked
              ? `${result.blocked} blocked on a missing score — none is being given a zero`
              : "Every child has a full set of scores",
          ],
          ["Arm average", result.average.toFixed(1)],
          ["Pass rate", `${result.passRate}%`, "Pass mark 40"],
          ["Top grade", result.topGrade],
          ["Subjects", String(result.subjects)],
        ] as Array<[string, string, string?]>,
      },
    },
  ],
  keywords: `${result.formMaster} ${result.blocked ? "Incomplete" : "Complete"}`,
}));

export const scoreEntryResultsContent: ModuleContent = {
  review: {
    title: "Review",
    desc: "Where every arm stands, and what needs your approval.",
    primary: { label: `Approve the ${examWindow.readyToApprove} ready`, drawer: approveTwelveDrawer },
    launchers: [
      {
        label: `Notify the ${examWindow.outstanding} outstanding`,
        drawer: nudgeDrawer({
          count: examWindow.outstanding,
          kicker: "Score review",
          who: "teachers owing a score sheet",
          what: "Which sheets they owe and the arm each one blocks",
        }),
      },
      { label: "Enter a sheet myself", href: "/score-entry-results/enter" },
    ],
    rows: [
      row("1fr", [
        {
          type: "kpi",
          per: 5,
          cards: [
            {
              label: "Sheets in",
              value: String(examWindow.in),
              unit: `of ${examWindow.expected}`,
              sub: `${examWindow.outstanding} outstanding · window closed ${examWindow.daysSinceClose} days ago`,
              tone: "attention",
            },
            {
              label: "Approved",
              value: String(examWindow.approved),
              sub: "Cleared for report cards",
              tone: "positive",
            },
            {
              label: "Ready to approve",
              value: String(examWindow.readyToApprove),
              sub: "Submitted, no open flags",
              tone: "submitted",
            },
            {
              label: "Returned to a teacher",
              value: String(examWindow.returned),
              sub: "Oldest sitting 9 days",
              tone: "negative",
            },
            {
              label: "Impossible to enter",
              value: String(examWindow.impossible),
              sub: "Civic Education JSS 3A and 3C have no teacher",
              tone: "negative",
              link: "Assign",
              href: "/class-timetable/teaching",
            },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "By arm",
          tag: "6 arms incomplete",
          tagTone: "attention",
          sub: "Every arm, what is in, and who still owes a sheet.",
          meta: `${armSheetSummaries.length} arms shown · ${examWindow.expected} sheets · ${examWindow.in} in`,
          search: "Find an arm, a class or a form master",
          filters: [
            {
              label: "State",
              value: "All",
              options: ["All", "Approved", "Submitted", "In progress", "Returned", "Blocked"],
              column: 7,
            },
          ],
          selectable: true,
          per: 10,
          noun: "arm",
          nounPlural: "arms",
          bulkActs: [
            { label: "Notify every teacher owing these arms" },
            { label: "Approve everything ready" },
            { label: "Export selected", primary: true },
          ],
          acts: [
            {
              label: "Notify the outstanding",
              drawer: nudgeDrawer({
                count: examWindow.outstanding,
                kicker: "Score review",
                who: "teachers owing a score sheet",
                what: "Which sheets they owe and the arm each one blocks",
              }),
            },
            {
              label: `Approve the ${examWindow.readyToApprove} ready`,
              primary: true,
              drawer: approveTwelveDrawer,
            },
          ],
          head: [
            "Arm",
            "Form master",
            "Sheets in",
            "Approved",
            "Flags",
            "Roll",
            "Pending from",
            "State",
            "",
          ],
          rows: byArmRows,
          foot: "Blocked means a sheet cannot exist yet — nobody teaches that subject in that arm.",
        },
      ]),
      row("1fr", [
        {
          type: "note",
          tone: "attention",
          title: `${examWindow.returned} sheets are returned and waiting on a teacher`,
          body: "A returned sheet is doubly blocking: the teacher often has not noticed, and a whole class's report cards are waiting on it.",
        },
      ]),
      row("1fr", [
        {
          type: "tracker",
          title: "Submission tracker",
          sub: "Five groupings.",
          meta: `Window closed ${examWindow.closed} · 6 sheets past deadline`,
          clear: {
            title: "Every sheet is approved",
            body: `All ${examWindow.expected} subject-arm sheets for this component are in and approved.`,
          },
          rows: subjectSheets.map((sheet) => ({
            unit: `${sheet.subject} · ${sheet.arm}`,
            sub:
              sheet.state === "Blocked"
                ? `No teacher assigned · ${sheet.age}`
                : `Examination · ${sheet.students} students`,
            owner: sheet.teacher,
            role: sheet.department,
            state: sheet.state === "Blocked" ? "Unassigned" : sheet.state,
            age: sheet.age,
            overdue: sheet.overdue,
          })),
        },
      ]),
      row("1.2fr 1fr", [
        {
          type: "table",
          title: "Verification",
          meta: "5 open flags · 1 verification sample",
          head: ["Check", "What was found", "Count", "Resolve"],
          noun: "check",
          nounPlural: "checks",
          rows: verificationRows,
        },
        {
          type: "note",
          tone: "withheld",
          title: "You entered Chemistry SSS 2A, so you cannot approve it",
          body: "Segregation of duties is enforced at the moment of approval, not flagged afterwards.",
        },
      ]),
    ],
  },

  enter: {
    title: "Enter",
    desc: "Choose the sheet first — a subject, in an arm, for a component.",
    primary: { label: "Open the review queue", href: "/score-entry-results/review" },
    launchers: [{ label: "Results", href: "/score-entry-results/results" }],
    rows: [
      row("1fr", [
        {
          type: "note",
          tone: "progress",
          title: "Entering scores is normally the subject teacher's job",
          body: "This is here for the days you have to do it yourself — a teacher is away, a sheet was never opened, a deadline has passed. Everything you enter here is logged under your name, and you cannot approve a sheet you entered.",
        },
      ]),
      row("1fr", [
        {
          type: "kpi",
          per: 4,
          cards: [
            {
              label: "Sheets expected",
              value: String(examWindow.expected),
              unit: "this component",
              sub: `${examWindow.component} · ${examWindow.term}`,
            },
            {
              label: "Still to come",
              value: String(examWindow.outstanding),
              sub: `Window closed ${examWindow.daysSinceClose} days ago`,
              tone: "attention",
            },
            {
              label: "Returned to a teacher",
              value: String(examWindow.returned),
              sub: "Back with whoever entered them",
              tone: "negative",
            },
            {
              label: "Cannot be entered",
              value: String(examWindow.impossible),
              sub: "No teacher is mapped to the subject-arm",
              tone: "negative",
              link: "Assign a teacher",
              href: "/class-timetable/teaching",
            },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "Choose a sheet to enter",
          sub: "Outstanding sheets first. Open one and the grid opens with every child in the arm.",
          meta: `${subjectSheets.length} named sheets · ${examWindow.component}`,
          search: "Find a subject, an arm or a teacher",
          filters: [
            {
              label: "State",
              value: "All",
              options: ["All", "Approved", "Submitted", "In progress", "Returned", "Blocked"],
              column: 4,
            },
          ],
          per: 8,
          noun: "sheet",
          nounPlural: "sheets",
          head: ["Sheet", "Teacher", "Students", "Age", "State", ""],
          rows: subjectSheets.map((sheet) => ({
            cells: [
              nameCell(`${sheet.subject} · ${sheet.arm}`, examWindow.component),
              sheet.teacher === "Unassigned"
                ? text("Unassigned", { tone: "negative", strong: true })
                : nameCell(sheet.teacher, sheet.department),
              text(String(sheet.students), { mono: true }),
              text(sheet.age, sheet.overdue ? { tone: "negative", strong: true } : {}),
              pill(sheet.state, stateTone(sheet.state)),
              {
                kind: "action",
                label: sheet.state === "Blocked" ? "Assign a teacher" : "Open the grid",
                ...(sheet.state === "Blocked"
                  ? { href: "/class-timetable/teaching" }
                  : {
                      drawer: {
                        mode: "commit",
                        kicker: "Enter scores",
                        title: `${sheet.subject} · ${sheet.arm}`,
                        sub: "Every child, all four components. Nothing is submitted until you say so.",
                        facts: [
                          ["Component", examWindow.component, examWindow.term],
                          ["Students", String(sheet.students)],
                          ["Entered by", sheet.teacher],
                          ["State", sheet.state],
                          [
                            "A blank is not a zero",
                            "Leave it blank if there is no mark",
                            "A zero counts against the child; a blank leaves the card uncomputed",
                          ],
                          [
                            "Who may approve it",
                            "Not you, if you entered it",
                            "Segregation of duties is enforced at the moment of approval",
                          ],
                        ],
                        commitLabel: "Open the entry grid",
                        commitDone: "Grid ready",
                        commitDoneBody:
                          "The sheet is open with every child in the arm. It stays a draft until you submit it.",
                      } satisfies DrawerSpec,
                    }),
              },
            ],
            keywords: `${sheet.teacher} ${sheet.department}`,
          })),
          foot: "A sheet cannot be entered for a subject nobody teaches — those read Blocked, and the fix is to map a teacher, not to type a score.",
        },
      ]),
    ],
  },

  results: {
    title: "Results",
    desc: "The whole school, then any arm, then any student.",
    primary: {
      label: "Export the school broadsheet",
      drawer: exportDrawer({
        title: "Export the school broadsheet",
        what: "Every arm, every student, every subject and the computed position",
        scope: `${school.arms} arms · ${school.computed.toLocaleString()} of ${school.roll.toLocaleString()} students computed`,
        format: "Excel and PDF",
        note: `${school.blocked} students are excluded — they are blocked on a missing score, not given a zero.`,
      }),
    },
    launchers: [{ label: "Open the review queue", href: "/score-entry-results/review" }],
    rows: [
      row("1fr", [
        {
          type: "kpi",
          per: 6,
          cards: [
            {
              label: "Students computed",
              value: school.computed.toLocaleString(),
              unit: `of ${school.roll.toLocaleString()}`,
              sub: `${school.blocked} blocked on a missing score`,
              tone: school.blocked ? "attention" : "positive",
            },
            {
              label: "School average",
              value: school.average,
              sub: `Across all ${school.arms} arms`,
            },
            {
              label: "Pass rate",
              value: `${school.passRate}%`,
              sub: "Pass mark 40",
              tone: "positive",
            },
            {
              label: "Credit rate",
              value: `${Math.max(50, school.passRate - 18)}%`,
              sub: "Credit threshold 50",
            },
            {
              label: "Best arm",
              value: school.best.average.toFixed(1),
              sub: `${school.best.arm} · ${school.best.formMaster}`,
              tone: "positive",
            },
            {
              label: "Weakest arm",
              value: school.worst.average.toFixed(1),
              sub: `${school.worst.arm} · ${school.worst.formMaster}`,
              tone: "attention",
            },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "note",
          tone: "attention",
          title: `${school.blocked} students cannot be computed yet`,
          body: `They sit in ${school.incompleteArms
            .map((result) => result.arm)
            .join(", ")}, where a subject sheet is still outstanding. None of them is being given a zero — they are simply excluded from positions until the score arrives.`,
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "Every arm",
          tag: `${school.arms} arms`,
          tagTone: "neutral",
          sub: "How each arm performed. Open one for its broadsheet, then any student for their full result.",
          meta: `${school.roll.toLocaleString()} students · ${school.incompleteArms.length} arms incomplete · school average ${school.average}`,
          search: "Find an arm, a class or a form master",
          filters: [
            {
              label: "State",
              value: "All",
              options: ["All", "Complete", "Incomplete"],
              column: 7,
            },
          ],
          per: 12,
          noun: "arm",
          nounPlural: "arms",
          acts: [
            {
              label: "Export the school broadsheet",
              primary: true,
              drawer: exportDrawer({
                title: "Export the school broadsheet",
                what: "Every arm, every student, every subject and the computed position",
                scope: `${school.arms} arms · ${school.computed.toLocaleString()} of ${school.roll.toLocaleString()} students computed`,
                format: "Excel and PDF",
              }),
            },
          ],
          head: ["Arm", "Form master", "Roll", "Computed", "Average", "Pass", "Top", "State", ""],
          rows: everyArmRows,
          foot: "A student blocked on a missing score is excluded from positions until the score arrives — never given a zero, and never quietly ranked last.",
        },
      ]),
      row("1fr 1fr", [
        {
          type: "bars",
          title: "Average by class",
          sub: "Where the school is strongest, and where it is not.",
          rows: (() => {
            const byClass = new Map<string, { total: number; roll: number }>();
            for (const result of school.all) {
              const className = result.arm.replace(/[A-C]$/, "");
              const entry = byClass.get(className) ?? { total: 0, roll: 0 };
              entry.total += result.average * result.roll;
              entry.roll += result.roll;
              byClass.set(className, entry);
            }
            return [...byClass.entries()]
              .map(([className, entry]) => {
                const average = entry.total / entry.roll;
                return {
                  label: className,
                  value: average,
                  display: average.toFixed(1),
                  tone: (average >= 70
                    ? "positive"
                    : average < 63
                      ? "negative"
                      : "neutral") as PanelTone,
                };
              })
              .sort((left, right) => right.value - left.value)
              .slice(0, 8);
          })(),
        },
        {
          type: "facts",
          title: "How a result is computed here",
          sub: "The same arithmetic for every child in the school.",
          facts: [
            ["Framework", "Version 4", "The version this term was computed under"],
            ["Components", "CA 1, CA 2, Project and Examination"],
            ["Pass mark", "40", "Credit at 50"],
            [
              "A missing score",
              "Blocks the computation",
              "The child is excluded from positions, never given a zero",
            ],
            [
              "Positions",
              "Within the arm",
              "A child is ranked against the arm their card is addressed to",
            ],
            [
              "Recomputed",
              "As each sheet is approved",
              "So the school figure and the arm tables can never drift apart",
            ],
          ],
        },
      ]),
    ],
  },
};
