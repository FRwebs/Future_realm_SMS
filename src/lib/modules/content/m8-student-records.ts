import { exportDrawer, nudgeDrawer } from "@/lib/modules/drawers";
import {
  name as nameCell,
  pill,
  row,
  text,
  type DrawerSpec,
  type ModuleContent,
  type TableRow,
} from "@/lib/modules/panels";
import { armResultOf } from "@/lib/modules/school-data";
import { registryStudents, registrySummary } from "@/lib/modules/students-data";

/**
 * M08 · Student Records — "The authoritative record of every student."
 *
 * The registry is the same list the class rosters are cut from, so a child
 * opened here and a child opened from their arm land on one record with one set
 * of figures.
 */

const summary = registrySummary();

function gradeOf(average: number): string {
  return average >= 70 ? "A1" : average >= 65 ? "B2" : average >= 45 ? "C4" : "D7";
}

function studentDrawer(student: (typeof registryStudents)[number]): DrawerSpec {
  const average = student.arm === "No arm" ? 0 : armResultOf(student.arm).average;

  return {
    kicker: "Student record",
    title: student.name,
    sub: `${student.admission} · ${student.arm === "No arm" ? "No class arm" : student.arm}`,
    facts: [
      ["Admission number", student.admission],
      [
        "Class arm",
        student.arm === "No arm" ? "None" : student.arm,
        student.arm === "No arm"
          ? "In no register and on no broadsheet — fix this before anything else"
          : student.className,
      ],
      ["Gender", student.gender, "Read from their given name, never guessed"],
      [
        "Attendance this term",
        `${student.attendance}%`,
        student.attendance < 75 ? "Below the 75% chronic threshold" : "",
      ],
      ...(student.arm === "No arm"
        ? []
        : ([["Arm average", average.toFixed(1), `Grade ${gradeOf(average)}`]] as Array<
            [string, string, string]
          >)),
      [
        "Fees",
        student.fee,
        student.fee === "Paid" ? "Settled in full" : "A balance never withholds a report card",
      ],
      [
        "Portal",
        student.portal,
        student.portal === "Active"
          ? "They can see published cards and announcements"
          : "Nothing digital reaches them until this is activated",
      ],
      ...(student.incomplete
        ? ([
            [
              "Record completeness",
              "Missing a photograph or date of birth",
              "Blocks the transcript and the WAEC entry file",
            ],
          ] as Array<[string, string, string]>)
        : []),
    ],
  };
}

const registryRows: TableRow[] = registryStudents.map((student) => {
  const average = student.arm === "No arm" ? 0 : armResultOf(student.arm).average;

  return {
    cells: [
      nameCell(student.name, student.arm === "No arm" ? "Unallocated" : student.className),
      text(student.admission, { mono: true }),
      student.arm === "No arm"
        ? text("No arm", { tone: "negative", strong: true })
        : text(student.arm),
      text(student.gender),
      text(`${student.attendance}%`, {
        mono: true,
        strong: true,
        tone:
          student.attendance < 75 ? "negative" : student.attendance < 92 ? "attention" : "positive",
      }),
      student.arm === "No arm" ? text("—") : text(average.toFixed(1), { mono: true }),
      student.arm === "No arm"
        ? text("—")
        : pill(
            gradeOf(average),
            average >= 65 ? "positive" : average >= 45 ? "attention" : "negative",
          ),
      pill(
        student.fee,
        student.fee === "Paid"
          ? "positive"
          : student.fee === "Part paid"
            ? "attention"
            : "negative",
      ),
      pill(
        student.portal,
        student.portal === "Active"
          ? "positive"
          : student.portal === "Invited"
            ? "attention"
            : "neutral",
      ),
      { kind: "action", label: "Open", drawer: studentDrawer(student) },
    ],
    keywords: `${student.className} ${student.gender} ${student.fee} ${student.portal}`,
  };
});

const addStudentDrawer: DrawerSpec = {
  mode: "commit",
  kicker: "Registry",
  title: "Add a student",
  sub: "A student record is created once and referenced everywhere — the roster, the broadsheet, the register and the report card all read this one record.",
  facts: [
    ["Admission number", "Issued in sequence", "Never reused, even after a withdrawal"],
    [
      "Class arm",
      "Required",
      "A child with no arm is in no register and on no broadsheet",
    ],
    ["Guardian", "At least one", "A child with no guardian on file can be reached by nobody"],
    ["Portal invite", "Sent on create", "Or later, if the family has no phone yet"],
  ],
  commitLabel: "Create the student",
  commitDone: "Student created",
  commitDoneBody:
    "They are on their arm's roster and register from today, and the guardian has been invited to the portal.",
};

export const studentRecordsContent: ModuleContent = {
  registry: {
    title: "Registry",
    desc: "The authoritative record of every student.",
    primary: { label: "Add student", drawer: addStudentDrawer },
    launchers: [
      {
        label: "Export the whole registry",
        drawer: exportDrawer({
          title: "Export the whole registry",
          what: "Every student, their arm, guardian, attendance, fees and portal state",
          scope: `${summary.total.toLocaleString()} records`,
          format: "Excel",
        }),
      },
      { label: "Admissions", href: "/student-records/admissions" },
    ],
    rows: [
      row("1fr", [
        {
          type: "kpi",
          per: 5,
          cards: [
            {
              label: "Enrolled",
              value: summary.enrolled.toLocaleString(),
              sub: `Across ${summary.arms} arms`,
            },
            { label: "Net this term", value: "+14", sub: "20 in · 3 out", tone: "positive" },
            { label: "Alumni and withdrawn", value: "84 / 11", sub: "A status filter, not a tab" },
            {
              label: "No class arm",
              value: String(summary.noArm),
              sub: "In no register",
              tone: "negative",
            },
            {
              label: "Fees outstanding",
              value: String(summary.owing),
              sub: "Children, not families",
              tone: "attention",
              link: "Open the debtor list",
              href: "/fee-management/collections",
            },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "Every student",
          tag: `${summary.total.toLocaleString()} records`,
          tagTone: "neutral",
          sub: "Open any child for their full record — the same page their class roster opens.",
          meta: `${summary.enrolled.toLocaleString()} enrolled · ${summary.noArm} in no arm · ${summary.noPortal} without an active portal`,
          search: "Find a student by name or admission number",
          filters: [
            { label: "Gender", value: "All", options: ["All", "Female", "Male"], column: 3 },
            {
              label: "Fees",
              value: "All",
              options: ["All", "Paid", "Part paid", "Outstanding"],
              column: 7,
            },
            {
              label: "Portal",
              value: "All",
              options: ["All", "Active", "Invited", "Not activated"],
              column: 8,
            },
          ],
          selectable: true,
          per: 12,
          noun: "student",
          nounPlural: "students",
          bulkActs: [
            { label: "Move to another arm" },
            { label: "Request consent" },
            { label: "Message their guardians" },
            { label: "Resend the portal invite" },
            { label: "Export to Excel", primary: true },
          ],
          acts: [
            {
              label: `Resend ${summary.noPortal} portal invites`,
              drawer: nudgeDrawer({
                count: summary.noPortal,
                kicker: "Registry",
                title: `Resend ${summary.noPortal} portal invites`,
                who: "students and guardians without an active portal",
                what: "An activation link, and what the portal gives them",
                channels: "SMS and email",
              }),
            },
            { label: "Add student", primary: true, drawer: addStudentDrawer },
          ],
          head: [
            "Student",
            "Admission no",
            "Arm",
            "Gender",
            "Att %",
            "Avg",
            "Grade",
            "Fees",
            "Portal",
            "",
          ],
          rows: registryRows,
          foot: "A student with no arm is in no register and on no broadsheet — fix that before anything else on this page.",
        },
      ]),
    ],
  },

  admissions: {
    title: "Admissions",
    desc: "Who is applying, where each one has reached, and what is holding the cycle up.",
    primary: {
      label: "Add an applicant",
      drawer: {
        mode: "commit",
        kicker: "Admissions",
        title: "Add an applicant",
        sub: "An applicant is not a student until they are enrolled — nothing here touches the registry.",
        facts: [
          ["Applying for", "A class, not an arm", "The arm is chosen at enrolment"],
          ["Guardian", "At least one contact"],
          ["Stage", "Enquiry", "It moves through screening, offer and enrolment"],
          [
            "Becomes a student",
            "Only on enrolment",
            "That is when an admission number is issued",
          ],
        ],
        commitLabel: "Add the applicant",
        commitDone: "Applicant added",
        commitDoneBody: "They are in the pipeline at Enquiry. Nothing has reached the registry.",
      },
    },
    launchers: [{ label: "Registry", href: "/student-records/registry" }],
    rows: [
      row("1fr", [
        {
          type: "kpi",
          per: 5,
          cards: [
            { label: "Applicants this cycle", value: "148", sub: "Across 14 classes" },
            {
              label: "Offers out",
              value: "62",
              sub: "41 accepted so far",
              tone: "progress",
            },
            {
              label: "Ready to enrol",
              value: "20",
              sub: "Accepted and paid",
              tone: "positive",
              link: "Open the registry",
              href: "/student-records/registry",
            },
            {
              label: "Awaiting screening",
              value: "34",
              sub: "Oldest waiting 9 days",
              tone: "attention",
            },
            { label: "Declined or lapsed", value: "32", sub: "A filter, not a deletion" },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "Applicants in this cycle",
          sub: "Each one shows the stage it has reached and what moves it on.",
          meta: "148 applicants · 34 awaiting screening",
          search: "Find an applicant",
          filters: [
            {
              label: "Stage",
              value: "All",
              options: ["All", "Enquiry", "Screening", "Offered", "Accepted", "Declined"],
              column: 3,
            },
          ],
          per: 8,
          noun: "applicant",
          nounPlural: "applicants",
          head: ["Applicant", "Applying for", "Guardian", "Stage", "Age", ""],
          rows: [
            {
              cells: [
                nameCell("Halima Yusuf", "GIA/APP/26/0142"),
                text("JSS 1"),
                text("Mrs Amina Yusuf"),
                pill("Accepted", "positive"),
                text("2 days"),
                {
                  kind: "action",
                  label: "Open",
                  drawer: {
                    kicker: "Applicant",
                    title: "Halima Yusuf",
                    sub: "Applying for JSS 1 · accepted",
                    facts: [
                      ["Reference", "GIA/APP/26/0142"],
                      ["Guardian", "Mrs Amina Yusuf"],
                      ["Stage", "Accepted", "The offer has been accepted and the deposit paid"],
                      ["What moves it on", "Enrolment — which issues an admission number"],
                    ],
                  },
                },
              ],
            },
            {
              cells: [
                nameCell("Sani Bature", "GIA/APP/26/0139"),
                text("SSS 1"),
                text("Alhaji Musa Bature"),
                pill("Offered", "progress"),
                text("5 days"),
                {
                  kind: "action",
                  label: "Open",
                  drawer: {
                    kicker: "Applicant",
                    title: "Sani Bature",
                    sub: "Applying for SSS 1 · offer out",
                    facts: [
                      ["Reference", "GIA/APP/26/0139"],
                      ["Guardian", "Alhaji Musa Bature"],
                      ["Stage", "Offered", "Waiting on the family"],
                      ["Offer expires", "In 9 days"],
                    ],
                  },
                },
              ],
            },
            {
              cells: [
                nameCell("Ada Okeke", "GIA/APP/26/0131"),
                text("Primary 3"),
                text("Mr Obinna Okeke"),
                pill("Screening", "attention"),
                text("9 days", { tone: "attention", strong: true }),
                {
                  kind: "action",
                  label: "Open",
                  drawer: {
                    kicker: "Applicant",
                    title: "Ada Okeke",
                    sub: "Applying for Primary 3 · awaiting screening",
                    facts: [
                      ["Reference", "GIA/APP/26/0131"],
                      ["Guardian", "Mr Obinna Okeke"],
                      ["Stage", "Screening", "Waiting on the school, not the family"],
                      ["Waiting", "9 days", "The oldest in the cycle"],
                    ],
                  },
                },
              ],
            },
            {
              cells: [
                nameCell("Tobi Balogun", "GIA/APP/26/0128"),
                text("Nursery 2"),
                text("Mrs Folake Balogun"),
                pill("Enquiry", "neutral"),
                text("1 day"),
                {
                  kind: "action",
                  label: "Open",
                  drawer: {
                    kicker: "Applicant",
                    title: "Tobi Balogun",
                    sub: "Applying for Nursery 2 · enquiry",
                    facts: [
                      ["Reference", "GIA/APP/26/0128"],
                      ["Guardian", "Mrs Folake Balogun"],
                      ["Stage", "Enquiry", "No screening booked yet"],
                    ],
                  },
                },
              ],
            },
          ],
          foot: "An applicant is not a student until they are enrolled — nothing on this tab touches the registry.",
        },
      ]),
    ],
  },

  changes: {
    title: "Changes",
    desc: "Every correction to a student record, and the evidence behind it.",
    primary: { label: "Open the approvals queue", href: "/approvals-workflow/queue" },
    launchers: [{ label: "Registry", href: "/student-records/registry" }],
    rows: [
      row("1fr", [
        {
          type: "kpi",
          per: 4,
          cards: [
            {
              label: "Pending changes",
              value: "11",
              sub: "Each one needs evidence",
              tone: "attention",
              link: "Open the queue",
              href: "/approvals-workflow/queue",
            },
            { label: "Approved this term", value: "48", sub: "Average 1.2 days", tone: "positive" },
            {
              label: "Record completeness",
              value: `${Math.round(((summary.total - summary.incomplete) / summary.total) * 100)}%`,
              sub: `${summary.incomplete} records missing something`,
              tone: "attention",
            },
            {
              label: "Suspected duplicates",
              value: "2",
              sub: "One child counted twice in enrolment and fees",
              tone: "negative",
            },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "Pending changes",
          sub: "A record change is never silent — it is evidenced, routed and logged.",
          meta: "11 waiting · evidence attached to 9",
          search: "Find a student",
          per: 8,
          noun: "change",
          nounPlural: "changes",
          head: ["Student", "Field", "From", "To", "Evidence", "Raised by", ""],
          rows: [
            {
              cells: [
                nameCell("Chioma Adebayo", "GIA/23/0402"),
                text("Date of birth"),
                text("12 March 2011"),
                text("12 March 2012", { strong: true }),
                pill("Birth certificate", "positive"),
                text("Mrs Folake Adeniyi"),
                {
                  kind: "action",
                  label: "Decide",
                  href: "/approvals-workflow/queue",
                },
              ],
            },
            {
              cells: [
                nameCell("Emeka Okafor", "GIA/23/0407"),
                text("Surname spelling"),
                text("Okafo"),
                text("Okafor", { strong: true }),
                pill("Birth certificate", "positive"),
                text("Miss Grace Etim"),
                { kind: "action", label: "Decide", href: "/approvals-workflow/queue" },
              ],
            },
            {
              cells: [
                nameCell("Samuel Bature", "GIA/2025/0290"),
                text("Class arm"),
                text("JSS 3B"),
                text("JSS 3A", { strong: true }),
                pill("None attached", "attention"),
                text("Mr Peter Obi"),
                { kind: "action", label: "Decide", href: "/approvals-workflow/queue" },
              ],
            },
          ],
          foot: "A change to a date of birth or a name feeds the transcript and the WAEC entry file, which is why it is evidenced and routed rather than typed.",
        },
      ]),
      row("1fr 1fr", [
        {
          type: "list",
          title: "Record completeness",
          sub: "What is missing, and what each gap blocks.",
          items: [
            {
              label: `${summary.incomplete} records missing a photograph or date of birth`,
              sub: "Blocks the transcript and the WAEC entry file.",
              pill: "Incomplete",
              tone: "attention",
              viewLabel: "Open the registry",
              href: "/student-records/registry",
            },
            {
              label: `${summary.noArm} children sit in no class arm`,
              sub: "In no register and on no broadsheet.",
              pill: "No arm",
              tone: "negative",
              viewLabel: "Allocate",
              href: "/student-records/registry",
            },
            {
              label: `${summary.noPortal} without an active portal`,
              sub: "Nothing digital reaches them — no card, no reminder, no broadcast.",
              pill: "No portal",
              tone: "attention",
              viewLabel: "Resend invites",
              href: "/parents-guardians/guardians",
            },
          ],
        },
        {
          type: "facts",
          title: "How a record change works here",
          sub: "The same rules whichever field is being corrected.",
          facts: [
            ["Who may raise one", "Any member of staff who can see the record"],
            ["Who decides", "The Principal", "Nobody approves their own submission"],
            [
              "Evidence",
              "Required for a name or a date of birth",
              "Those feed the transcript and the examination entry",
            ],
            ["Escalates after", "5 days"],
            ["Both values kept", "Always", "The old value is never overwritten in the log"],
            ["Auto-approved", "Spelling corrections of 3 characters or fewer", "A standing rule"],
          ],
        },
      ]),
    ],
  },
};
