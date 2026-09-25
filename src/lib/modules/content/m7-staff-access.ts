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
import {
  appraisalRows,
  kpiSetFor,
  kpiSets,
  leaveBalances,
  leaveRequests,
  leaveTypes,
  nairaK,
  nairaM,
  payBands,
  payRows,
  payTotals,
  people,
  sensitiveGroups,
  staffCounts,
  type AppraisalRow,
  type LeaveRequest,
  type PayBand,
  type PayRow,
  type Person,
} from "@/lib/modules/staff-data";
import {
  schoolModules,
  schoolModuleLevel,
  schoolRoleTemplates,
  schoolTemplateReach,
} from "@/lib/modules/school-modules";

/**
 * M07 · Staff & Access — "Give each person exactly the access they need — and
 * see what each has done."
 *
 * An account that looks configured but has never been activated is the single
 * most dangerous state in a school system: work routes to it and silently
 * stops. Every tab here names that state rather than averaging it away.
 *
 * The mockup reaches a person's access map, a role template, a pay band, a pay
 * run and one appraisal through drill-down pages. There is no sub-page route
 * here, so each opens as a drawer over the list it was reached from.
 */

const counts = staffCounts();
const totals = payTotals();
const pay = payRows();
const appraisals = appraisalRows();

/* --------------------------------------------------------------- Directory */

type StaffRow = {
  name: string;
  phone: string;
  id: string;
  role: string;
  dept: string;
  employment: string;
  joined: string;
  account: string;
  neverDays?: number;
  lastSignIn: string;
  openTasks: string;
  periods: string;
};

const staffRows: StaffRow[] = [
  { name: "Adaeze Nwosu", phone: "+234 803 000 0004", id: "GIA-0004", role: "Principal", dept: "Leadership", employment: "Full-time", joined: "Joined Sep 2019", account: "Active", lastSignIn: "2 min ago", openTasks: "6", periods: "12" },
  { name: "Dr Emmanuel Nwosu", phone: "+234 803 000 0001", id: "GIA-0001", role: "Proprietor", dept: "Leadership", employment: "Full-time", joined: "Joined Sep 2014", account: "Active", lastSignIn: "Yesterday", openTasks: "2", periods: "0" },
  { name: "Mr Samuel Adeyemi", phone: "+234 803 000 0011", id: "GIA-0011", role: "Exam Officer", dept: "Sciences", employment: "Full-time", joined: "Joined Jan 2021", account: "Active", lastSignIn: "26 min ago", openTasks: "9", periods: "21" },
  { name: "Mrs Folake Adeniyi", phone: "+234 803 000 0012", id: "GIA-0012", role: "Exam Officer", dept: "Languages", employment: "Full-time", joined: "Joined Sep 2020", account: "Active", lastSignIn: "1 hour ago", openTasks: "4", periods: "24" },
  { name: "Mr Ibrahim Danladi", phone: "+234 803 000 0018", id: "GIA-0018", role: "Head of Department", dept: "Mathematics", employment: "Full-time", joined: "Joined Sep 2018", account: "Active", lastSignIn: "3 hours ago", openTasks: "7", periods: "27" },
  { name: "Mr Chidi Okeke", phone: "+234 803 000 0031", id: "GIA-0031", role: "Head of Department", dept: "Sciences", employment: "Full-time", joined: "Joined Aug 2026", account: "Never activated", neverDays: 43, lastSignIn: "—", openTasks: "0", periods: "0" },
  { name: "Miss Blessing Nnaji", phone: "+234 803 000 0033", id: "GIA-0033", role: "Subject Teacher", dept: "Languages", employment: "Part-time", joined: "Joined Sep 2026", account: "Never activated", neverDays: 11, lastSignIn: "—", openTasks: "0", periods: "8" },
  { name: "Mrs Chinelo Obi", phone: "+234 803 000 0007", id: "GIA-0007", role: "Bursar", dept: "Finance", employment: "Full-time", joined: "Joined Jan 2017", account: "Active", lastSignIn: "18 min ago", openTasks: "3", periods: "0" },
  { name: "Mr Peter Obi", phone: "+234 803 000 0021", id: "GIA-0021", role: "Form Master", dept: "Sciences", employment: "Contract", joined: "Ends Jul 2027", account: "Dormant", lastSignIn: "96 days ago", openTasks: "0", periods: "16" },
];

const resendInvitesDrawer: DrawerSpec = {
  mode: "commit",
  kicker: "Directory",
  title: `Resend ${counts.never} invitations`,
  sub: "Both accounts were created and neither has ever been signed into.",
  facts: [
    ["Who", "Mr Chidi Okeke · Miss Blessing Nnaji", "Head of Sciences, and a part-time Languages teacher"],
    ["Waiting", "43 days and 11 days", "Counted from the day the invitation was sent"],
    [
      "What is stuck behind them",
      "Every approval routed to Head of Sciences",
      "It has been routing to an unread account since term start",
    ],
    ["Channel", "Email and SMS", "To the numbers on their staff records"],
    ["Link", "New, valid for 7 days", "The old link is invalidated"],
  ],
  commitLabel: "Resend both",
  commitDone: "Invitations resent",
  commitDoneBody: "Both have a fresh link, valid for 7 days. Nothing they hold has changed.",
};

const directoryTab: TabContent = {
  title: "Directory",
  desc: "Find any staff member — and see who never activated.",
  primary: {
    label: "Add staff",
    drawer: {
      mode: "commit",
      kicker: "Directory",
      title: "Add a staff member",
      sub: "A new account starts on a role template, and reaches nothing until it is activated.",
      facts: [
        ["Role template", "Chosen when you add them", `${schoolRoleTemplates.length} to pick from`],
        ["Invitation", "Email and SMS", "Valid for 7 days"],
        ["Until they activate", "They hold nothing and block routing", "Approvals sent to their role sit unread"],
        ["Sensitive groups", "Never inherited", "Granted one by one, afterwards"],
      ],
      commitLabel: "Add and invite",
      commitDone: "Staff member added",
      commitDoneBody: "The invitation is on its way. Until it is accepted, the account holds nothing.",
    },
  },
  launchers: [
    {
      label: "Offboard someone",
      drawer: {
        mode: "commit",
        kicker: "F8 · offboarding",
        title: "Offboard a staff member",
        sub: "Everything they hold has to be reassigned before the exit can complete.",
        facts: [
          ["Form classes", "Reassigned first", "An arm cannot be left with nobody named"],
          ["Subject-arms", "Reassigned first", "An unassigned subject-arm blocks a whole arm's cards"],
          ["Open approvals", "Rerouted", "Nothing is left waiting on somebody who has gone"],
          ["Their record", "Kept", "Readable, not editable — it is the school's record, not theirs"],
          ["Access", "Revoked at the moment the exit completes"],
        ],
        commitLabel: "Start the offboarding",
        commitDone: "Offboarding started",
        commitDoneBody: "Nothing is revoked until everything they hold has been reassigned.",
      },
    },
  ],
  rows: [
    row("1fr", [
      {
        type: "kpi",
        per: 5,
        cards: [
          { label: "Total staff", value: String(counts.total), sub: `Across ${counts.depts} departments` },
          { label: "Activated", value: `${counts.active} of ${counts.total}`, sub: "Signed in within 30 days", tone: "positive" },
          {
            label: "Never activated",
            value: String(counts.never),
            sub: "Holds routing, blocks approvals",
            tone: "negative",
            link: "Resend invitations",
            drawer: resendInvitesDrawer,
          },
          { label: "Dormant", value: String(counts.dormant), sub: "No sign-in for 96 days", tone: "attention" },
          { label: "Active delegations", value: "2", sub: "1 expired and not renewed", tone: "submitted" },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "note",
        tone: "negative",
        title: `${counts.never} staff members were invited and never activated`,
        body: "Mr Chidi Okeke was invited as Head of Sciences 43 days ago. Approvals routed to that role have been sitting unread since term start, and nobody noticed because the account looks configured.",
        acts: [
          { label: "Resend both invitations", drawer: resendInvitesDrawer },
          {
            label: "Correct and reissue",
            drawer: {
              mode: "commit",
              kicker: "Directory",
              title: "Correct the details and reissue",
              sub: "If the address or number was wrong, resending the same link changes nothing.",
              facts: [
                ["Email", "Checked before the link is sent again"],
                ["Phone", "Checked before the SMS is sent again"],
                ["Old link", "Invalidated"],
                ["Routing", "Unchanged until they activate", "Reroute the role separately if it cannot wait"],
              ],
              commitLabel: "Correct and reissue",
              commitDone: "Details corrected, invitation reissued",
              commitDoneBody: "A fresh link is on its way to the corrected address.",
            },
          },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "Staff",
        meta: `${counts.total} staff · ${counts.active} activated`,
        search: "Find by name, staff ID, role or department",
        noun: "staff member",
        nounPlural: "staff",
        per: 9,
        selectable: true,
        filters: [
          { label: "Role", value: "All roles", options: ["All roles", ...schoolRoleTemplates.map((entry) => entry.name)], column: 2 },
          { label: "Employment", value: "All", options: ["All", "Full-time", "Part-time", "Contract"], column: 3 },
          { label: "Account", value: "All", options: ["All", "Active", "Dormant", "Never activated"], column: 4 },
        ],
        bulkActs: [
          { label: "Resend invitation", drawer: resendInvitesDrawer },
          { label: "Export for review", primary: true },
        ],
        head: ["Name", "Staff ID", "Role and department", "Employment", "Account", "Last sign-in", "Open tasks", "Periods / week"],
        rows: staffRows.map(
          (staff): TableRow => ({
            cells: [
              nameCell(staff.name, staff.phone),
              text(staff.id, { mono: true }),
              nameCell(staff.role, staff.dept, { avatar: false }),
              nameCell(staff.employment, staff.joined, { avatar: false }),
              staff.neverDays
                ? text(`Never activated · ${staff.neverDays} days`, { tone: "negative", strong: true })
                : pill(staff.account, staff.account === "Active" ? "positive" : "attention"),
              text(staff.lastSignIn, staff.lastSignIn === "96 days ago" ? { tone: "attention" } : {}),
              text(staff.openTasks, { mono: true }),
              text(staff.periods, { mono: true }),
            ],
            drawer: {
              kicker: `${staff.role} · ${staff.dept}`,
              title: staff.name,
              sub: `${staff.employment} · ${staff.joined}. Staff ID ${staff.id}.`,
              tone: staff.neverDays ? "negative" : undefined,
              facts: [
                ["Staff ID", staff.id],
                ["Role and department", `${staff.role} · ${staff.dept}`],
                ["Employment", `${staff.employment} · ${staff.joined}`],
                ["Phone", staff.phone],
                [
                  "Account",
                  staff.neverDays ? `Never activated · ${staff.neverDays} days` : staff.account,
                  staff.neverDays
                    ? "Work routes here and silently stops"
                    : staff.account === "Dormant"
                      ? "No sign-in for 96 days — surfaced in Permissions · Review"
                      : "",
                ],
                ["Last sign-in", staff.lastSignIn],
                [
                  "Open tasks",
                  staff.openTasks,
                  "Everything outstanding against them across every module — registers, sheets, remarks and approvals",
                ],
                ["Periods a week", staff.periods, "Their timetabled teaching load"],
              ],
            },
            keywords: `${staff.id} ${staff.dept} ${staff.role}`,
          }),
        ),
        foot: "Open tasks counts everything outstanding against a person across every module — registers, sheets, remarks and approvals. Periods a week is their timetabled teaching load.",
      },
    ]),
    row("1fr 1.1fr", [
      {
        type: "list",
        title: "Active delegations",
        items: [
          {
            label: "Mrs Folake Adeniyi holds Exam Officer approval for Sciences",
            sub: "Granted by you on 1 September · expires 30 September · reason: Mr Adeyemi on leave",
            pill: "Active",
            tone: "positive",
            facts: [
              ["Holder", "Mrs Folake Adeniyi · Exam Officer, Languages"],
              ["What she holds", "Exam Officer approval for Sciences"],
              ["Granted by", "You, on 1 September"],
              ["Reason", "Mr Adeyemi on leave", "Recorded at the moment it was granted"],
              ["Expires", "30 September"],
            ],
          },
          {
            label: "Mrs Chinelo Obi holds fee waiver approval up to ₦50,000",
            sub: "Granted by Dr Emmanuel Nwosu on 6 January · expires at term end",
            pill: "Active",
            tone: "positive",
            facts: [
              ["Holder", "Mrs Chinelo Obi · Bursar"],
              ["What she holds", "Fee waiver approval up to ₦50,000"],
              ["Granted by", "Dr Emmanuel Nwosu · Proprietor, on 6 January"],
              ["Above that", "Still needs the Proprietor", "Two approvals above ₦50,000"],
              ["Expires", "At term end"],
            ],
          },
          {
            label: "Mr Peter Obi held Form Master delegation for SSS 3B",
            sub: "Expired 31 August · not renewed · surfaced in Permissions · Review",
            pill: "Expired",
            tone: "attention",
            facts: [
              ["Holder", "Mr Peter Obi · Form Master, Sciences"],
              ["What he held", "Form Master delegation for SSS 3B"],
              ["Expired", "31 August", "Not renewed"],
              ["Since then", "He holds nothing extra", "An expired delegation lapses; it is never extended silently"],
            ],
          },
        ],
      },
      {
        type: "facts",
        title: "Account states in use",
        sub: "What each state means for what the person can do.",
        per: 2,
        facts: [
          ["Active", `${counts.active} staff`, "Signed in within 30 days"],
          ["Dormant", `${counts.dormant} staff`, "No sign-in for 90 days · surfaced in Permissions · Review"],
          ["Never activated", `${counts.never} staff`, "Invited, never signed in · holds nothing, blocks routing"],
          ["Offboarded", "4 this session", "Everything they held was reassigned before exit completed"],
        ],
      },
    ]),
  ],
};

/* ------------------------------------------------------------- Permissions */

function personModules(person: Person): number {
  return schoolModules.filter((module) => schoolModuleLevel(person.role, module.code) > 0).length;
}

function accessMapDrawer(person: Person): DrawerSpec {
  const reach = personModules(person);

  return {
    kicker: `${person.role} · ${person.dept}`,
    title: person.name,
    sub: `Reaches ${reach} of ${schoolModules.length} modules. ${person.scope}.`,
    tone: person.above || person.portal !== "Active" ? "attention" : undefined,
    facts: [
      ["Role template", person.role, person.above ? `Plus ${person.above}, with a reason on record` : "On template"],
      ["Modules reached", `${reach} of ${schoolModules.length}`, "A module they cannot reach is absent from their navigation entirely"],
      ["Data scope", person.scope],
      ["Fee amounts", person.fees, person.fees === "Full amounts" ? "Sees what every family owes" : person.fees === "Status only" ? "Paid or not, never the figure" : "Nothing about money"],
      ["Can approve", person.approve],
      [
        "Sensitive groups",
        person.sensitive.length ? person.sensitive.join(", ") : "None",
        person.sensitive.length ? "Granted one by one · every reveal is logged" : "Never inherited from a role",
      ],
      [
        "Account",
        person.portal,
        person.portal === "Not activated"
          ? "Holds nothing, and blocks everything routed to the role"
          : person.portal === "Dormant"
            ? "No sign-in for 90 days"
            : "",
      ],
      ...(person.above
        ? ([["Above template", person.above, "Carries a recorded reason and is reviewed each term"]] as Array<[string, string, string?]>)
        : []),
    ],
  };
}

function roleTemplateDrawer(template: (typeof schoolRoleTemplates)[number]): DrawerSpec {
  const reach = schoolTemplateReach(template.name);
  const holders = people.filter((person) => person.role === template.name);

  return {
    kicker: "Role template",
    title: template.name,
    sub: "The starting point for a new account. A template is never enforced after the fact.",
    facts: [
      ["People on it", String(holders.length), holders.length ? holders.map((person) => person.name).join(", ") : "Nobody yet"],
      ["Modules", `${reach} of ${schoolModules.length}`],
      ["Data scope", template.dataScope],
      ["Can approve", template.canApprove],
      ["Sensitive groups", "None", "Never granted by a template, only to a named person"],
      [
        "Changing it",
        "Applies to new accounts only",
        "Anyone already on it keeps what they have until you apply the template to them",
      ],
    ],
  };
}

const recertifyDrawer: DrawerSpec = {
  mode: "commit",
  kicker: "Permissions",
  title: "Termly access recertification",
  sub: "Confirm, reduce or revoke every access in the school for this term.",
  facts: [
    ["People", String(people.length), "Everyone who can sign in"],
    ["Above their role template", String(counts.above), "Each carries a recorded reason"],
    ["Never activated or dormant", String(counts.never + counts.dormant), "Holding routing they have never read"],
    ["Last recertified", "12 June 2026", "By Dr Emmanuel Nwosu · Proprietor"],
    ["Due", "30 September 2026", "25 days"],
    ["Effect of confirming", "Access stays exactly as it is", "Recorded against your name for the term"],
  ],
  commitLabel: "Confirm every access",
  commitDone: "Access recertified",
  commitDoneBody: "Every access stands as it is, recorded against your name for this term.",
};

const decisionsNeeded: Array<{
  name: string;
  role: string;
  kind: string;
  tone: PanelTone;
  since: string;
  decision: string;
  act: string;
}> = [
  {
    name: "Mrs Folake Adeniyi",
    role: "Exam Officer",
    kind: "Above template",
    tone: "attention",
    since: "1 Sep",
    decision: "Holds Sciences approval by delegation while Mr Adeyemi is on leave. The delegation has no end date.",
    act: "Decide",
  },
  {
    name: "Mrs Chinelo Obi",
    role: "Bursar",
    kind: "Above template",
    tone: "attention",
    since: "6 Jan",
    decision: "Fee waiver approval up to ₦50,000, on the Proprietor's written instruction. Confirm or reduce it.",
    act: "Decide",
  },
  {
    name: "Mr Peter Obi",
    role: "Form Master · Sciences",
    kind: "Dormant",
    tone: "attention",
    since: "96 days",
    decision: "No sign-in for 96 days but still the form master of SSS 3A. Confirm, reassign the arm, or suspend the account.",
    act: "Decide",
  },
  {
    name: "Mr Chidi Okeke",
    role: "Head of Sciences",
    kind: "Never activated",
    tone: "negative",
    since: "43 days",
    decision: "Approvals have routed to this role since term start and nobody has read them. Resend the link or reroute the role.",
    act: "Resend",
  },
];

const permissionsTab: TabContent = {
  title: "Permissions",
  desc: "Who can sign in, what they reach, and how far their data goes.",
  primary: { label: "Review everyone's access", drawer: recertifyDrawer },
  launchers: [
    {
      label: "Open the role templates",
      drawer: {
        kicker: "Permissions",
        title: `${schoolRoleTemplates.length} role templates`,
        sub: "What each template reaches, before anything is granted on top of it.",
        readOnly: true,
        readOnlyNote: "Open a single template to change what it reaches.",
        facts: schoolRoleTemplates.map(
          (template): [string, string, string?] => [
            template.name,
            `${schoolTemplateReach(template.name)} of ${schoolModules.length} modules`,
            template.dataScope,
          ],
        ),
      },
    },
    {
      label: "Create a custom role",
      drawer: {
        mode: "commit",
        kicker: "Permissions",
        title: "Create a custom role",
        sub: "A custom role starts from an existing template and differs from it deliberately.",
        facts: [
          ["Starts from", "Any of the existing templates"],
          ["What you set", "Modules, tabs and the 6 actions per tab"],
          ["Data scope", "How far the role's data reaches"],
          ["Sensitive groups", "Never part of a role", "Granted to a named person afterwards"],
        ],
        commitLabel: "Create the role",
        commitDone: "Custom role created",
        commitDoneBody: "It is available as a template. Nobody is on it yet.",
      },
    },
  ],
  rows: [
    row("1fr", [
      {
        type: "kpi",
        per: 5,
        cards: [
          {
            label: "People with access",
            value: String(people.length),
            sub: `Across ${schoolRoleTemplates.length} role templates`,
          },
          {
            label: "Above their template",
            value: String(counts.above),
            sub: "Each with a reason on record",
            tone: counts.above ? "attention" : "positive",
          },
          {
            label: "Never activated",
            value: String(counts.never),
            sub: "Approvals queue unread",
            tone: "negative",
            link: "Resend the links",
            drawer: resendInvitesDrawer,
          },
          {
            label: "Sensitive group holders",
            value: String(counts.sensitiveHolders),
            sub: "Granted one by one",
            tone: "sensitive",
          },
          {
            label: "Recertification",
            value: "30 Sep",
            sub: "25 days · last done 12 June",
            tone: "attention",
            link: "Review everyone",
            drawer: recertifyDrawer,
          },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "Who can reach what",
        tag: `${people.length} people`,
        tagTone: "neutral",
        sub: "Open a person to map their modules, tabs and actions.",
        meta: `${people.length} people · ${schoolModules.length} modules · 6 actions per tab · ${counts.above} above their template`,
        search: "Find by name, role or department",
        noun: "person",
        nounPlural: "people",
        per: 12,
        selectable: true,
        filters: [
          { label: "Role", value: "All", options: ["All", ...schoolRoleTemplates.map((entry) => entry.name)], column: 1 },
          { label: "Fee amounts", value: "All", options: ["All", "Full amounts", "Status only", "None"], column: 4 },
          { label: "Account", value: "All", options: ["All", "Active", "Not activated", "Dormant", "Suspended"], column: 7 },
        ],
        bulkActs: [
          { label: "Confirm their access for this term", drawer: recertifyDrawer },
          { label: "Change their role" },
          { label: "Apply a role template" },
          { label: "Export selected", primary: true },
        ],
        acts: [
          { label: "Export the access map" },
          {
            label: "Add staff",
            primary: true,
            drawer: {
              mode: "commit",
              kicker: "Permissions",
              title: "Add a staff member",
              sub: "A new account starts on a role template, and reaches nothing until it is activated.",
              facts: [
                ["Role template", "Chosen when you add them"],
                ["Until they activate", "They hold nothing and block routing"],
              ],
              commitLabel: "Add and invite",
              commitDone: "Staff member added",
              commitDoneBody: "The invitation is on its way. Until it is accepted, the account holds nothing.",
            },
          },
        ],
        head: ["Person", "Role template", "Modules", "Data scope", "Fee amounts", "Can approve", "Sensitive", "Account", ""],
        rows: people.map((person): TableRow => {
          const reach = personModules(person);

          return {
            cells: [
              nameCell(person.name, person.dept),
              person.above
                ? text(`${person.role} + ${person.above}`, { strong: true, tone: "attention" })
                : text(person.role),
              text(`${reach} of ${schoolModules.length}`, {
                mono: true,
                strong: true,
                tone: reach >= 14 ? "negative" : undefined,
              }),
              text(person.scope),
              pill(
                person.fees,
                person.fees === "Full amounts" ? "attention" : person.fees === "None" ? "neutral" : "positive",
              ),
              person.approve === "Nothing" ? text("Nothing") : text(person.approve, { strong: true }),
              person.sensitive.length
                ? pill(`${person.sensitive.length} held`, "sensitive")
                : text("None"),
              pill(
                person.portal,
                person.portal === "Active" ? "positive" : person.portal === "Not activated" ? "negative" : "attention",
              ),
              { kind: "action", label: "Open the map", drawer: accessMapDrawer(person) },
            ],
            keywords: `${person.dept} ${person.scope} ${person.above}`,
          };
        }),
        foot: "A module a person cannot reach is absent from their navigation entirely — never shown and greyed out, which only teaches people to ask for it.",
      },
    ]),
    row("1.05fr 1fr", [
      {
        type: "table",
        title: "Role templates",
        tag: `${schoolRoleTemplates.length} templates`,
        tagTone: "neutral",
        sub: "The starting point for a new account. Open one to set its modules, tabs and actions.",
        meta: "A template is never enforced after the fact",
        noun: "template",
        nounPlural: "templates",
        per: 8,
        filters: [
          {
            label: "Can approve",
            value: "All",
            options: ["All", "Everything", "Score sheets and cards", "Payments and waivers", "Score sheets", "Record changes", "Nothing"],
            column: 4,
          },
        ],
        acts: [
          {
            label: "Create a custom role",
            primary: true,
            drawer: {
              mode: "commit",
              kicker: "Permissions",
              title: "Create a custom role",
              sub: "A custom role starts from an existing template and differs from it deliberately.",
              facts: [
                ["Starts from", "Any of the existing templates"],
                ["Sensitive groups", "Never part of a role"],
              ],
              commitLabel: "Create the role",
              commitDone: "Custom role created",
              commitDoneBody: "It is available as a template. Nobody is on it yet.",
            },
          },
        ],
        head: ["Template", "People", "Modules", "Data scope", "Can approve", ""],
        rows: schoolRoleTemplates.map(
          (template): TableRow => ({
            cells: [
              text(template.name, { strong: true }),
              text(String(people.filter((person) => person.role === template.name).length), { mono: true }),
              text(`${schoolTemplateReach(template.name)} of ${schoolModules.length}`, { mono: true }),
              text(template.dataScope),
              text(template.canApprove),
              { kind: "action", label: "Open", drawer: roleTemplateDrawer(template) },
            ],
            keywords: template.dataScope,
          }),
        ),
      },
      {
        type: "list",
        title: "Sensitive groups",
        sub: "Never inherited from a role. Granted to a named person, and every reveal is logged.",
        acts: [
          {
            label: "Create a sensitive group",
            primary: true,
            drawer: {
              mode: "commit",
              kicker: "Permissions",
              title: "Create a sensitive group",
              sub: "A sensitive group is granted person by person, never by a role.",
              facts: [
                ["What it protects", "A named category of record"],
                ["Granted to", "Named people, one at a time"],
                ["Every reveal", "Written to the audit log", "Who looked, at what, and when"],
                ["Inherited", "Never", "Changing somebody's role never grants or removes one"],
              ],
              commitLabel: "Create the group",
              commitDone: "Sensitive group created",
              commitDoneBody: "Nobody holds it yet. Grant it to named people one at a time.",
            },
          },
        ],
        items: sensitiveGroups.map((group) => ({
          label: group.name,
          sub: group.note ? `${group.holders} · ${group.note}` : group.holders,
          pill: `${group.count} holder${group.count === 1 ? "" : "s"}`,
          tone: "sensitive" as PanelTone,
          viewLabel: "Manage",
          facts: [
            ["Group", group.name],
            ["Holders", String(group.count), group.holders],
            ["Inherited from a role", "Never", "Granted to a named person, one at a time"],
            ["Every reveal", "Logged", group.note || "Who looked, at what, and when"],
          ] as Array<[string, string, string?]>,
        })),
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "Access that needs a decision this term",
        tag: "Recertification due 30 September",
        tagTone: "attention",
        sub: "Everything that is not simply a role on its template.",
        meta: `${decisionsNeeded.length} need a decision · ${people.length} people in total`,
        noun: "item",
        nounPlural: "items",
        filters: [
          {
            label: "Kind",
            value: "All",
            options: ["All", "Above template", "Never activated", "Dormant", "Delegation"],
            column: 1,
          },
        ],
        acts: [{ label: "Confirm all as they are", primary: true, drawer: recertifyDrawer }],
        head: ["Person", "Kind", "Since", "What the decision is", ""],
        rows: decisionsNeeded.map(
          (entry): TableRow => ({
            cells: [
              nameCell(entry.name, entry.role),
              pill(entry.kind, entry.tone),
              text(entry.since),
              text(entry.decision),
              {
                kind: "action",
                label: entry.act,
                drawer:
                  entry.act === "Resend"
                    ? resendInvitesDrawer
                    : {
                        mode: "commit",
                        kicker: `Recertification · ${entry.kind}`,
                        title: `${entry.name} · ${entry.kind.toLowerCase()}`,
                        sub: entry.decision,
                        facts: [
                          ["Person", entry.name, entry.role],
                          ["Kind", entry.kind],
                          ["Since", entry.since],
                          ["The decision", entry.decision],
                          ["If you confirm", "It stands for this term", "Recorded against your name"],
                          ["If you reduce it", "They drop to their role template", "They are told what changed and why"],
                        ],
                        commitLabel: "Confirm as it is",
                        commitDone: "Access confirmed",
                        commitDoneBody: `${entry.name}'s access stands for this term, recorded against your name.`,
                      },
              },
            ],
            keywords: entry.kind,
          }),
        ),
        foot: "An account that looks configured but has never been activated is the single most dangerous state in a school system — work routes to it and silently stops.",
      },
    ]),
  ],
};

/* ----------------------------------------------------------------- Payroll */

const held = pay.filter((entry) => entry.state === "Held" || entry.state === "Awaiting approval").length;

const openRunDrawer: DrawerSpec = {
  kicker: "Payroll · September 2026",
  title: "The September run",
  sub: "Where the run stands, and what is waiting on a decision.",
  facts: [
    ["Month", "September 2026"],
    ["Pay date", "25 September", "Cut-off was 20 September"],
    ["State", "In review"],
    ["People", String(totals.n), totals.unmapped ? `${totals.unmapped} not mapped to a band` : "Everybody mapped"],
    ["Cost", nairaM(totals.cost), "Gross plus allowances, before deductions"],
    ["Statutory deductions", nairaM(totals.deductions), "PAYE, pension and NHF · Nigeria profile"],
    ["Net to pay", nairaM(totals.net)],
    ["Needing a decision", String(held), held ? "Held or waiting on approval" : "Nothing waiting"],
  ],
};

function bandDrawer(band: PayBand): DrawerSpec {
  const on = pay.filter((entry) => entry.band.code === band.code && !entry.unmapped).length;

  return {
    kicker: "Payroll · band",
    title: `${band.code} · ${band.name}`,
    sub: `${band.covers}. ${band.steps.length} steps.`,
    facts: [
      ["Covers", band.covers],
      ["Steps", String(band.steps.length), band.stepNames.join(" · ")],
      ["Monthly range", `${nairaK(band.steps[0]!)} – ${nairaK(band.steps.at(-1)!)}`],
      ["Staff on it", String(on)],
      ["Allowances", band.allowances.join(", ")],
      ["Next review", "1 January 2027"],
      ...band.steps.map(
        (step, index): [string, string, string?] => [
          band.stepNames[index]!,
          nairaK(step),
          `Step ${index + 1} of ${band.steps.length}`,
        ],
      ),
      [
        "Moving somebody up",
        "One decision, recorded once",
        "It reaches their pay on the next run — a step is a position on a ladder, not a negotiation",
      ],
    ],
  };
}

function payslipDrawer(entry: PayRow): DrawerSpec {
  const paye = Math.round(entry.deductions * 0.55);
  const pension = Math.round(entry.deductions * 0.33);

  return {
    kicker: "Payroll",
    title: `September payslip · ${entry.person.name}`,
    sub: "Every line, in the order it is calculated.",
    readOnly: true,
    readOnlyNote:
      "A payslip is a record of a payment — it cannot be edited. Correct the band, the step or the allowance and the next run reflects it.",
    facts: [
      ["Band and step", `${entry.band.code} · step ${entry.step}`, entry.band.name],
      ["Gross", nairaK(entry.gross), "From the step, not typed"],
      ["Allowances", nairaK(entry.allowances), entry.band.allowances.join(", ")],
      ["Taxable pay", nairaK(entry.gross + entry.allowances), "Gross plus taxable allowances"],
      ["PAYE", nairaK(paye), "Nigeria profile"],
      ["Pension 8%", nairaK(pension), "Employee portion"],
      ["NHF 2.5%", nairaK(entry.deductions - paye - pension)],
      ["Net pay", nairaK(entry.net), entry.method],
      ["Status", entry.state, entry.state === "Paid" ? "Paid 25 September" : "Not paid yet"],
    ],
  };
}

const mapToBandDrawer: DrawerSpec = {
  mode: "commit",
  kicker: "Payroll",
  title: "Map staff to a band",
  sub: "A person with no band cannot be paid and cannot be costed — there is no number to pay.",
  facts: [
    ["Not mapped", String(totals.unmapped), "Employed, and on the directory"],
    ["Band and step", "Decide the gross", "Everything else is calculated from it"],
    ["Effect", "They appear on the next run", "The run is short by that much until they do"],
    ["Backdating", "By an off-cycle payment", "Never by re-running a month"],
  ],
  commitLabel: "Map them",
  commitDone: "Staff mapped to a band",
  commitDoneBody: "They are on the next run. Nothing already paid changes.",
};

const payrollTab: TabContent = {
  title: "Payroll",
  desc: "One pay structure, and every person mapped into it.",
  primary: { label: "Open the September run", drawer: openRunDrawer },
  launchers: [
    {
      label: "Create a band",
      drawer: {
        mode: "commit",
        kicker: "Payroll",
        title: "Create a band",
        sub: "A band is a ladder of steps, not a salary.",
        facts: [
          ["Steps", "Each one a named position on the ladder"],
          ["Allowances", "Attach to the band, not the person"],
          ["Currency and statutory rules", "Follow the country on the school profile", "Nigeria · ₦"],
        ],
        commitLabel: "Create the band",
        commitDone: "Band created",
        commitDoneBody: "Nobody is on it yet. Map staff into it to put it to work.",
      },
    },
    { label: "Map staff to a band", drawer: mapToBandDrawer },
    {
      label: "Record an off-cycle payment",
      drawer: {
        mode: "commit",
        kicker: "Payroll",
        title: "Record an off-cycle payment",
        sub: "A payment outside the run, recorded against a named person and a reason.",
        facts: [
          ["Why it exists", "Backdating is never done by re-running a month"],
          ["Reason", "Required", "Kept on the payment permanently"],
          ["Deductions", "Calculated on it, per the statutory profile"],
          ["The run", "Untouched", "September stands exactly as it is"],
        ],
        commitLabel: "Record the payment",
        commitDone: "Off-cycle payment recorded",
        commitDoneBody: "It sits against the person with its reason. The September run is untouched.",
      },
    },
    {
      label: "Export the payroll register",
      drawer: {
        kicker: "Payroll",
        title: "Export the payroll register",
        sub: "September 2026, every line as it stands.",
        facts: [
          ["Month", "September 2026"],
          ["People", String(totals.n)],
          ["Cost", nairaM(totals.cost), "Gross plus allowances"],
          ["Format", "CSV and PDF"],
        ],
      },
    },
  ],
  rows: [
    row("1fr", [
      {
        type: "kpi",
        per: 5,
        cards: [
          { label: "Monthly payroll cost", value: nairaM(totals.cost), sub: "Gross plus allowances, before deductions" },
          {
            label: "On the payroll",
            value: String(totals.n),
            unit: `of ${pay.length}`,
            sub: totals.unmapped ? `${totals.unmapped} not mapped to a band` : "Everybody mapped",
            tone: totals.unmapped ? "attention" : "positive",
          },
          {
            label: "September run",
            value: "In review",
            sub: "Pay date 25 Sep · cut-off was 20 Sep",
            tone: "progress",
            link: "Open the run",
            drawer: openRunDrawer,
          },
          {
            label: "Statutory deductions",
            value: nairaM(totals.deductions),
            sub: "PAYE, pension and NHF · Nigeria profile",
          },
          {
            label: "Payments needing a decision",
            value: String(held),
            sub: held ? "Held or waiting on approval" : "Nothing waiting",
            tone: held ? "attention" : "positive",
            link: held ? "See them" : undefined,
            drawer: held ? openRunDrawer : undefined,
          },
        ],
      },
    ]),
    ...(totals.unmapped
      ? [
          row("1fr", [
            {
              type: "note" as const,
              tone: "attention" as PanelTone,
              title: `${totals.unmapped} ${totals.unmapped === 1 ? "member of staff is" : "members of staff are"} on the directory but not on a band`,
              body: "They are employed and they appear everywhere else in the product, so the run below is short by that much. A person with no band cannot be paid and cannot be costed — there is no number to pay.",
              acts: [
                { label: "Map them to a band", drawer: mapToBandDrawer },
                { label: "Open the directory", href: "/staff-access/directory" },
              ],
            },
          ]),
        ]
      : []),
    row("1fr", [
      {
        type: "table",
        title: "Bands",
        tag: `${payBands.length} bands`,
        tagTone: "neutral",
        sub: "Open a band to set its steps, its allowances and who sits on each.",
        meta: "Currency and statutory rules follow the country on the school profile · Nigeria · ₦",
        search: "Find a band",
        noun: "band",
        nounPlural: "bands",
        filters: [
          {
            label: "Covers",
            value: "All",
            options: ["All", "Leadership", "Academic", "Administration", "Support"],
            column: 0,
          },
        ],
        acts: [
          {
            label: "Create a band",
            primary: true,
            drawer: {
              mode: "commit",
              kicker: "Payroll",
              title: "Create a band",
              sub: "A band is a ladder of steps, not a salary.",
              facts: [
                ["Steps", "Each one a named position on the ladder"],
                ["Allowances", "Attach to the band, not the person"],
              ],
              commitLabel: "Create the band",
              commitDone: "Band created",
              commitDoneBody: "Nobody is on it yet.",
            },
          },
        ],
        head: ["Band", "Who it covers", "Steps", "Monthly range", "Staff", "Allowances", "Next review", ""],
        rows: payBands.map((band): TableRow => {
          const on = pay.filter((entry) => entry.band.code === band.code && !entry.unmapped).length;

          return {
            cells: [
              text(`${band.code} · ${band.name}`, { strong: true }),
              text(band.covers),
              text(String(band.steps.length), { mono: true }),
              text(`${nairaK(band.steps[0]!)} – ${nairaK(band.steps.at(-1)!)}`, { mono: true }),
              text(String(on), { mono: true }),
              text(band.allowances.join(", ")),
              text("1 January 2027"),
              { kind: "action", label: "Open", drawer: bandDrawer(band) },
            ],
            keywords: band.covers,
          };
        }),
        foot: "A step is a position on a ladder, not a negotiation. Moving somebody up a step is one decision, recorded once, and it reaches their pay on the next run.",
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "Staff on the payroll",
        tag: `${totals.n} of ${pay.length}`,
        tagTone: totals.unmapped ? "attention" : "positive",
        sub: "Band and step decide the gross; the rest is calculated.",
        meta: `September 2026 · ${nairaM(totals.cost)} cost · ${nairaM(totals.net)} net to pay`,
        search: "Find by name, band or step",
        noun: "staff member",
        nounPlural: "staff",
        per: 10,
        selectable: true,
        filters: [
          {
            label: "Band",
            value: "All",
            options: ["All", ...payBands.map((band) => `${band.code} · ${band.name}`)],
            column: 1,
          },
          { label: "Payment", value: "All", options: ["All", "Paid", "Awaiting approval", "Held", "Not mapped"], column: 8 },
          { label: "Method", value: "All", options: ["All", "Bank transfer", "Cash · collected"], column: 7 },
        ],
        bulkActs: [
          { label: "Mark these paid" },
          { label: "Hold these payments" },
          { label: "Release these payments" },
          { label: "Move up one step" },
          { label: "Export selected", primary: true },
        ],
        acts: [
          {
            label: "Export the register",
            drawer: {
              kicker: "Payroll",
              title: "Export the payroll register",
              sub: "September 2026, every line as it stands.",
              facts: [
                ["Month", "September 2026"],
                ["People", String(totals.n)],
                ["Cost", nairaM(totals.cost)],
              ],
            },
          },
          { label: "Open the run", primary: true, drawer: openRunDrawer },
        ],
        head: ["Staff member", "Band", "Step", "Gross", "Allowances", "Deductions", "Net", "Method", "Payment", ""],
        rows: pay.map(
          (entry): TableRow => ({
            cells: [
              nameCell(entry.person.name, `${entry.person.role} · ${entry.person.dept}`),
              entry.unmapped
                ? text("Not mapped", { strong: true, tone: "attention" })
                : text(`${entry.band.code} · ${entry.band.name}`),
              entry.unmapped ? text("—") : text(String(entry.step), { mono: true }),
              entry.unmapped ? text("—") : text(nairaK(entry.gross), { mono: true, strong: true }),
              entry.unmapped ? text("—") : text(nairaK(entry.allowances), { mono: true }),
              entry.unmapped
                ? text("—")
                : text(`−${nairaK(entry.deductions).slice(1)}`, { mono: true, tone: "attention" }),
              entry.unmapped ? text("—") : text(nairaK(entry.net), { mono: true, strong: true }),
              entry.unmapped ? text("—") : text(entry.method),
              pill(
                entry.state,
                entry.state === "Paid"
                  ? "positive"
                  : entry.state === "Awaiting approval"
                    ? "progress"
                    : entry.state === "Held"
                      ? "negative"
                      : "attention",
              ),
              entry.unmapped
                ? { kind: "action", label: "Map them", drawer: mapToBandDrawer }
                : { kind: "action", label: "Payslip", drawer: payslipDrawer(entry) },
            ],
            keywords: `${entry.band.code} ${entry.band.name} ${entry.person.role}`,
          }),
        ),
        foot: "Deductions are never entered by hand. They come from the statutory profile for the school's country, so the same structure is correct in Lagos, Accra, Nairobi or Dubai.",
      },
    ]),
  ],
};

/* ------------------------------------------------------------------- Leave */

const waiting = leaveRequests.filter((request) => request.status === "Waiting").length;
const noCover = leaveRequests.filter(
  (request) => /Not arranged/.test(request.cover) && /Waiting|In sequence/.test(request.status),
).length;

function leaveDrawer(request: LeaveRequest): DrawerSpec {
  const type = leaveTypes.find((entry) => entry.name === request.type);

  return {
    mode: request.status === "Waiting" ? "commit" : "read",
    kicker: `Leave · ${request.sequence}`,
    title: `${request.type} · ${request.name}`,
    sub:
      request.status === "Waiting"
        ? "Deciding advances you to the next request in the queue."
        : `${request.dates} · ${request.status.toLowerCase()}.`,
    tone: /Not arranged/.test(request.cover) ? "negative" : undefined,
    facts: [
      ["Staff member", request.name, request.role],
      ["Type", request.type, type?.pay ?? ""],
      ["Dates", request.dates, `${request.days} working days`],
      [
        "Balance after this",
        request.type === "Annual leave" ? "11 of 24 days left" : "Not drawn from annual leave",
      ],
      [
        "Cover",
        request.cover,
        /Not arranged/.test(request.cover)
          ? "Granting this leaves classes uncovered"
          : "Confirmed by the head of department",
      ],
      [
        "Effect on pay",
        /Unpaid/.test(request.type) ? `Prorated −${nairaK(26)} on the September run` : "None — this is paid leave",
      ],
      [
        "Term-time",
        /Oct|Sep|Nov/.test(request.dates) ? "Inside term time" : "In the holidays",
        "Policy discourages term-time annual leave",
      ],
      ["Sequence", request.sequence, request.status === "Waiting" ? "You are the current approver" : ""],
    ],
    commitLabel: request.status === "Waiting" ? "Approve the leave" : undefined,
    commitDone: request.status === "Waiting" ? "Leave approved" : undefined,
    commitDoneBody:
      request.status === "Waiting"
        ? `${request.name} is on ${request.type.toLowerCase()} for ${request.dates}. The cover named is now responsible for the register.`
        : undefined,
  };
}

const firstWaiting = leaveRequests.find((request) => request.status === "Waiting")!;
const firstUncovered = leaveRequests.find((request) => /Not arranged/.test(request.cover))!;

const leaveTab: TabContent = {
  title: "Leave",
  desc: "Every request, its approvals, and the cover it depends on.",
  primary: {
    label: `Decide the ${waiting} waiting on you`,
    drawer: leaveDrawer(firstWaiting),
  },
  launchers: [
    {
      label: "Define a leave type",
      drawer: {
        mode: "commit",
        kicker: "Leave",
        title: "Define a leave type",
        sub: "A leave type is a policy, not a label.",
        facts: [
          ["Entitlement", "In working days, or weeks"],
          ["Accrual", "Monthly, or full on day one"],
          ["Carry-over", "How much, and when it lapses"],
          ["Evidence", "What the school asks for, and after how long"],
          ["Pay", "Paid, half pay, or unpaid and prorated"],
          ["Statutory minimums", "Follow the country on the school profile", "Whichever is more generous applies"],
        ],
        commitLabel: "Create the type",
        commitDone: "Leave type created",
        commitDoneBody: "Staff can request it from now. Nothing already taken changes.",
      },
    },
    {
      label: "Record leave taken off-system",
      drawer: {
        mode: "commit",
        kicker: "Leave",
        title: "Record leave taken off-system",
        sub: "Leave agreed in a corridor still has to reach the register.",
        facts: [
          ["Why", "A balance that ignores what was actually taken is worse than none"],
          ["Approver", "Recorded as the person who agreed it"],
          ["Balance", "Reduced by the days recorded"],
          ["Payroll", "Only unpaid leave reaches the run"],
        ],
        commitLabel: "Record it",
        commitDone: "Leave recorded",
        commitDoneBody: "The register and the balance now match what was actually taken.",
      },
    },
    {
      label: "Export the leave register",
      drawer: {
        kicker: "Leave",
        title: "Export the leave register",
        sub: "Every request this session, decided and undecided.",
        facts: [
          ["Requests", String(leaveRequests.length)],
          ["Taken", String(leaveRequests.filter((request) => request.status === "Taken").length)],
          ["Declined", String(leaveRequests.filter((request) => request.status === "Declined").length)],
          ["Format", "CSV and PDF"],
        ],
      },
    },
  ],
  rows: [
    row("1fr", [
      {
        type: "kpi",
        per: 5,
        cards: [
          { label: "Away today", value: "3", sub: "2 sick, 1 annual · all three covered" },
          {
            label: "Waiting on you",
            value: String(waiting),
            sub: waiting ? "Oldest has waited 4 days" : "Nothing waiting",
            tone: waiting ? "attention" : "positive",
            link: waiting ? "Decide them" : undefined,
            drawer: waiting ? leaveDrawer(firstWaiting) : undefined,
          },
          {
            label: "Cover not arranged",
            value: String(noCover),
            sub: "Classes would be uncovered if granted",
            tone: "negative",
            link: "See them",
            drawer: leaveDrawer(firstUncovered),
          },
          { label: "Working days lost this term", value: "41", sub: "Of 1,054 staff working days · 3.9%" },
          { label: "Annual entitlement used", value: "38%", sub: "School-wide · term 2 of 3", tone: "progress" },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "note",
        tone: "negative",
        title: `${noCover} ${noCover === 1 ? "request would" : "requests would"} leave classes uncovered`,
        body: "Cover is the whole question. A school can nearly always spare a person; it can rarely spare a person and their five periods a day. These requests name no cover, so granting one silently sends a class to an empty room.",
        acts: [
          { label: "Arrange cover from the timetable", href: "/class-timetable/timetable" },
          { label: "Decide them anyway", drawer: leaveDrawer(firstUncovered) },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "Leave requests",
        tag: `${waiting} waiting on you`,
        tagTone: waiting ? "attention" : "positive",
        sub: "Every request this session, in and out of sequence, decided and undecided.",
        meta: `${leaveRequests.length} requests this session · ${leaveRequests.filter((r) => r.status === "Taken").length} taken · ${leaveRequests.filter((r) => r.status === "Declined").length} declined`,
        search: "Find by name or type",
        noun: "request",
        nounPlural: "requests",
        per: 8,
        selectable: true,
        filters: [
          { label: "Type", value: "All", options: ["All", ...leaveTypes.map((entry) => entry.name)], column: 1 },
          { label: "Status", value: "All", options: ["All", "Waiting", "In sequence", "Taken", "Declined"], column: 6 },
          { label: "Cover", value: "All", options: ["All", "arranged", "Not arranged", "No cover needed"], column: 4 },
        ],
        bulkActs: [
          { label: "Approve these" },
          { label: "Return for cover" },
          { label: "Export selected", primary: true },
        ],
        acts: [
          { label: "Export the register" },
          {
            label: "Record leave taken",
            primary: true,
            drawer: {
              mode: "commit",
              kicker: "Leave",
              title: "Record leave taken off-system",
              sub: "Leave agreed in a corridor still has to reach the register.",
              facts: [
                ["Balance", "Reduced by the days recorded"],
                ["Payroll", "Only unpaid leave reaches the run"],
              ],
              commitLabel: "Record it",
              commitDone: "Leave recorded",
              commitDoneBody: "The register and the balance now match what was actually taken.",
            },
          },
        ],
        head: ["Staff member", "Type", "Dates", "Days", "Cover", "Sequence", "Status", ""],
        rows: leaveRequests.map(
          (request): TableRow => ({
            cells: [
              nameCell(request.name, request.role),
              text(request.type, { strong: true }),
              text(request.dates),
              text(request.days, { mono: true }),
              /Not arranged/.test(request.cover)
                ? text(request.cover, { strong: true, tone: "negative" })
                : text(request.cover),
              text(request.sequence),
              pill(
                request.status,
                request.status === "Taken"
                  ? "positive"
                  : request.status === "Waiting"
                    ? "attention"
                    : request.status === "Declined"
                      ? "negative"
                      : "progress",
              ),
              {
                kind: "action",
                label: request.status === "Waiting" ? "Decide" : "Open",
                drawer: leaveDrawer(request),
              },
            ],
            keywords: `${request.role} ${request.cover}`,
          }),
        ),
        foot: "A request is never deleted. Declined, cancelled and withdrawn requests stay in the register with their reason — that history is what makes the next decision defensible.",
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "Leave types",
        tag: `${leaveTypes.length} types`,
        tagTone: "neutral",
        sub: "What the school offers, and on what terms.",
        meta: "Statutory minimums follow the country on the school profile · whichever is more generous applies",
        search: "Find a leave type",
        noun: "type",
        nounPlural: "types",
        per: 10,
        filters: [
          { label: "Pay", value: "All", options: ["All", "Paid", "Half pay", "Unpaid"], column: 6 },
          { label: "Evidence", value: "All", options: ["All", "Not required", "Medical", "certificate", "letter"], column: 5 },
        ],
        acts: [
          { label: "Export the policy" },
          {
            label: "Define a leave type",
            primary: true,
            drawer: {
              mode: "commit",
              kicker: "Leave",
              title: "Define a leave type",
              sub: "A leave type is a policy, not a label.",
              facts: [
                ["Entitlement", "In working days, or weeks"],
                ["Pay", "Paid, half pay, or unpaid and prorated"],
              ],
              commitLabel: "Create the type",
              commitDone: "Leave type created",
              commitDoneBody: "Staff can request it from now.",
            },
          },
        ],
        head: ["Type", "Who may take it", "Entitlement", "Accrual", "Carry-over", "Evidence", "Pay", "Taken", "When it may not be taken", ""],
        rows: leaveTypes.map((entry): TableRow => {
          const who = /Maternity/.test(entry.name)
            ? "Female staff"
            : /Paternity/.test(entry.name)
              ? "Male staff"
              : /Study/.test(entry.name)
                ? "Confirmed staff"
                : "All staff";
          const whoNote = /Maternity|Paternity/.test(entry.name)
            ? "After 6 months in service"
            : /Study/.test(entry.name)
              ? "Past probation"
              : "From day one";
          const restricted = /Annual|Study|Religious|Unpaid/.test(entry.name)
            ? "Exam weeks · report card week"
            : /Compassionate|Sick|Maternity|Paternity/.test(entry.name)
              ? "Never restricted"
              : "Exam weeks";
          const payLabel = /Unpaid/.test(entry.pay) ? "Unpaid" : /Half/.test(entry.pay) ? "Half pay" : "Paid";

          return {
            cells: [
              text(entry.name, { strong: true }),
              nameCell(who, whoNote, { avatar: false }),
              text(entry.entitlement),
              text(entry.accrual),
              text(entry.carryOver),
              text(entry.evidence),
              pill(payLabel, payLabel === "Unpaid" ? "attention" : payLabel === "Half pay" ? "progress" : "positive"),
              text(`${entry.taken} days`, { mono: true }),
              text(restricted),
              {
                kind: "action",
                label: "Edit",
                drawer: {
                  mode: "commit",
                  kicker: "Leave type",
                  title: entry.name,
                  sub: `${entry.entitlement} · ${entry.pay}.`,
                  facts: [
                    ["Who may take it", who, whoNote],
                    ["Entitlement", entry.entitlement],
                    ["Accrual", entry.accrual],
                    ["Carry-over", entry.carryOver],
                    ["Evidence", entry.evidence],
                    ["Pay", entry.pay],
                    ["Taken this session", `${entry.taken} days`, "School-wide"],
                    ["When it may not be taken", restricted],
                  ],
                  commitLabel: "Save the type",
                  commitDone: `${entry.name} saved`,
                  commitDoneBody: "It applies to requests made from now. Nothing already taken changes.",
                },
              },
            ],
            keywords: `${entry.pay} ${entry.evidence}`,
          };
        }),
        foot: "Unpaid leave is the only type that reaches payroll by itself — prorated by working day on the next run. Everything else is already inside what the person is paid.",
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "Balances, by staff member",
        tag: "Second Term",
        tagTone: "neutral",
        sub: "What each person has taken, what is left, and what is already booked.",
        meta: "Annual entitlement 24 working days a session · accrues monthly",
        search: "Find a staff member",
        noun: "staff member",
        nounPlural: "staff",
        per: 8,
        filters: [
          {
            label: "Balance",
            value: "All",
            options: ["All", "More than half left", "Less than 5 days left", "Nothing left"],
            column: 6,
          },
        ],
        head: ["Staff member", "Annual taken", "Sick", "Unpaid", "Other", "Next booked", "Left", ""],
        rows: leaveBalances.map(
          (balance): TableRow => ({
            cells: [
              nameCell(balance.person.name, `${balance.person.role} · ${balance.person.dept}`),
              text(`${balance.taken} of 24 days`, { mono: true }),
              text(String(balance.sick), { mono: true }),
              text(String(balance.unpaid), { mono: true }),
              text(balance.other),
              text(
                balance.nextBooked,
                /waiting/.test(balance.nextBooked) ? { tone: "attention", strong: true } : {},
              ),
              text(`${balance.left} days`, {
                mono: true,
                strong: true,
                tone: balance.left <= 0 ? "negative" : balance.left < 5 ? "attention" : "positive",
              }),
              {
                kind: "action",
                label: "Open",
                drawer: {
                  kicker: "Leave balance · Second Term",
                  title: balance.person.name,
                  sub: `${balance.taken} of 24 annual days taken. ${balance.left} left.`,
                  facts: [
                    ["Role", balance.person.role, balance.person.dept],
                    ["Annual taken", `${balance.taken} of 24 days`],
                    ["Annual left", `${balance.left} days`, balance.left <= 0 ? "Nothing left this session" : ""],
                    ["Sick", `${balance.sick} days`, "Of 12 a session"],
                    ["Unpaid", `${balance.unpaid} days`, balance.unpaid ? "Prorated on the run it fell in" : ""],
                    ["Other", balance.other],
                    ["Next booked", balance.nextBooked],
                    [
                      "Carry-over",
                      "5 days, expiring 31 December",
                      "Anything above it lapses, and is shown before it does",
                    ],
                  ],
                },
              },
            ],
            keywords: balance.person.dept,
          }),
        ),
        foot: "An unused entitlement is a cost, not a saving: five people who take nothing all session will all want December, and the school cannot give it to them.",
      },
    ]),
    row("1.1fr 1fr", [
      {
        type: "facts",
        title: "How leave is counted",
        sub: "The rules every request is measured against.",
        per: 1,
        facts: [
          ["Unit", "Working days", "Weekends and school holidays are never counted"],
          ["The school calendar decides", "Term dates and public holidays", "From Calendar, not typed here"],
          ["Accrual", "Monthly, from the start date", "A starter in January has 14 days, not 24"],
          ["Carry-over", "5 days, expiring 31 December", "Anything above it lapses, and is shown before it does"],
          ["Half days", "Permitted for medical appointments", "Counted as 0.5"],
          ["Term-time annual leave", "Discouraged, not forbidden", "Needs the Principal, and cover, and a reason"],
          ["Sick leave", "Full entitlement on day one", "A note is required after 2 consecutive days"],
          ["Unpaid leave", "Prorated by working day", "Reaches the next payroll run as a named variation"],
          ["Maternity", "Statutory minimum, or the school's policy if better", "Whichever is more generous"],
        ],
      },
      {
        type: "facts",
        title: "What leave touches elsewhere",
        sub: "Granting leave is never only about the person.",
        per: 1,
        facts: [
          ["Timetable", "Cover must exist before it is granted", "The first stage exists only to confirm this"],
          ["Attendance", "The register is marked by the covering teacher", "Under their own name, not the absentee's"],
          ["Score entry", "A returned sheet does not wait", "It reassigns, or the arm's cards stall"],
          ["Payroll", "Only unpaid leave reaches the run", "As a named variation, never a silent adjustment"],
          ["Approvals", "Anything routed to them is delegated", "Or it sits unread for the length of the leave"],
        ],
      },
    ]),
  ],
};

/* --------------------------------------------------------------- Appraisal */

const withMe = appraisals.filter((entry) => entry.stage === "With you").length;
const complete = appraisals.filter((entry) => entry.stage === "Complete").length;
const selfAssessing = appraisals.filter((entry) => entry.stage === "Self-assessment").length;

function appraisalDrawer(entry: AppraisalRow): DrawerSpec {
  const set = kpiSets[entry.set];

  return {
    mode: entry.stage === "With you" ? "commit" : "read",
    kicker: `Appraisal · ${entry.person.role}`,
    title: entry.person.name,
    sub:
      entry.stage === "With you"
        ? "Their self-assessment, against the same KPIs you rate them on."
        : `${entry.stage}. ${set.length} KPIs in the ${entry.set} set.`,
    facts: [
      ["Role", entry.person.role, entry.person.dept],
      ["KPI set", entry.set.replace(/^./, (char) => char.toUpperCase()), `${set.length} KPIs, weights total 100`],
      [
        "Self-assessment",
        entry.stage === "Not started" ? "Not started" : entry.stage === "Self-assessment" ? "In progress" : "Submitted",
      ],
      ["Their score", entry.selfScore ? `${entry.selfScore.toFixed(1)} of 5` : "—"],
      ["Your score", entry.mine ? `${entry.mine.toFixed(1)} of 5` : "Not rated yet"],
      ["Evidence attached", entry.evidence ? String(entry.evidence) : "None"],
      [
        "Automatic KPIs",
        String(set.filter((kpi) => /automatic/i.test(kpi.source)).length),
        "Read from the product — registers, submissions, remarks, results, queries",
      ],
      [
        "Rated KPIs",
        String(set.filter((kpi) => !/automatic/i.test(kpi.source)).length),
        "Scored by you, with evidence",
      ],
      ["Stage", entry.stage],
    ],
    commitLabel: entry.stage === "With you" ? "Submit your review" : undefined,
    commitDone: entry.stage === "With you" ? "Review submitted" : undefined,
    commitDoneBody:
      entry.stage === "With you"
        ? "It goes to moderation with every other review. No outcome is published until moderation closes."
        : undefined,
  };
}

const firstWithMe = appraisals.find((entry) => entry.stage === "With you")!;

const moderateDrawer: DrawerSpec = {
  mode: "commit",
  kicker: "Appraisal",
  title: "Moderate this cycle",
  sub: "Compare every manager's ratings before any outcome is published.",
  facts: [
    ["Reviews complete", `${complete} of ${appraisals.length}`],
    ["Average rating", "3.8 of 5", "School-wide"],
    ["Widest manager spread", "Sciences 4.4 · Languages 3.2", "Same role, same KPIs"],
    ["What moderation does", "Flags outliers for a conversation", "It never silently changes a rating"],
    ["Outcomes", "Published only after moderation", "Including step increases"],
  ],
  commitLabel: "Open moderation",
  commitDone: "Moderation open",
  commitDoneBody: "Every review is visible side by side. No outcome is published until you close it.",
};

const appraisalTab: TabContent = {
  title: "Appraisal",
  desc: "KPIs per role: published, self-assessed, then reviewed by you.",
  primary: {
    label: `Review the ${withMe} that have come back`,
    drawer: appraisalDrawer(firstWithMe),
  },
  launchers: [
    {
      label: "Define a KPI",
      drawer: {
        mode: "commit",
        kicker: "Appraisal",
        title: "Define a KPI",
        sub: "A KPI a school cannot measure is not a KPI — it is a hope.",
        facts: [
          ["Where the number comes from", "A figure the product already holds, or a manager's rating"],
          ["Weight", "The set must total 100 to be published"],
          ["Target", "Stated, so the same performance gets the same number everywhere"],
          ["Evidence", "Required for anything a manager rates"],
        ],
        commitLabel: "Create the KPI",
        commitDone: "KPI created",
        commitDoneBody: "It is on the set. The set cannot be published until its weights total 100.",
      },
    },
    {
      label: "Publish the cycle to staff",
      drawer: {
        mode: "commit",
        kicker: "Appraisal",
        title: "Publish the Second Term cycle",
        sub: "Everyone sees their own KPIs and can start their self-assessment.",
        facts: [
          ["Staff", String(appraisals.length), `Across ${Object.keys(kpiSets).length} KPI sets`],
          ["Weights", "Every set totals 100", "A set that does not cannot publish"],
          ["They see", "Their KPIs, and the automatic figures", "Nothing about anybody else"],
          ["Closes", "30 September"],
        ],
        commitLabel: "Publish the cycle",
        commitDone: "Cycle published",
        commitDoneBody: "Everyone can start their self-assessment. It closes on 30 September.",
      },
    },
    { label: "Moderate the ratings", drawer: moderateDrawer },
    {
      label: "Export the cycle",
      drawer: {
        kicker: "Appraisal",
        title: "Export the appraisal cycle",
        sub: "Second Term, every review as it stands.",
        facts: [
          ["Staff", String(appraisals.length)],
          ["Complete", String(complete)],
          ["Average rating", "3.8 of 5"],
          ["Format", "CSV and PDF"],
        ],
      },
    },
  ],
  rows: [
    row("1fr", [
      {
        type: "kpi",
        per: 5,
        cards: [
          { label: "Cycle", value: "Second Term", sub: "Published 1 September · closes 30 September" },
          {
            label: "Published to",
            value: String(appraisals.length),
            unit: "staff",
            sub: `Across ${Object.keys(kpiSets).length} KPI sets`,
          },
          {
            label: "Completed by staff",
            value: String(appraisals.filter((entry) => entry.stage !== "Not started").length - selfAssessing),
            unit: `of ${appraisals.length}`,
            sub: `${selfAssessing} still writing theirs`,
            tone: "progress",
          },
          {
            label: "Waiting on your review",
            value: String(withMe),
            sub: withMe ? "Oldest returned 6 days ago" : "Nothing waiting",
            tone: withMe ? "attention" : "positive",
            link: withMe ? "Review them" : undefined,
            drawer: withMe ? appraisalDrawer(firstWithMe) : undefined,
          },
          { label: "Average rating", value: "3.8", unit: "of 5", sub: "Moderation not yet run" },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "steps",
        title: "How this cycle runs",
        sub: "Where the Second Term cycle stands.",
        steps: [
          { label: "KPIs published to staff", sub: "1 September · every role against its own set", state: "done" },
          { label: "Self-assessment", sub: `${selfAssessing} still writing theirs`, state: "done" },
          { label: "Manager review", sub: `${withMe} have come back and are waiting on you`, state: "current" },
          { label: "Moderation", sub: "Managers compared against each other before anything publishes", state: "todo" },
          { label: "Outcomes published", sub: "Rating, comments, and any step increase", state: "todo" },
        ],
        foot: "A step increase reaches Payroll as a variation — never as a retyped salary.",
      },
    ]),
    row("1fr", [
      {
        type: "facts",
        title: "How a rating is arrived at",
        sub: "So the same performance gets the same number in every department.",
        per: 1,
        facts: [
          ["Automatic KPIs", "Read from the product", "Registers, submissions, remarks, results, queries"],
          ["Rated KPIs", "Scored by the manager, with evidence", "Observations, conduct"],
          ["Weighting", "Each KPI carries its weight", "The set must total 100 to be published"],
          ["The staff member first", "They self-assess against the same KPIs", "They see the automatic figures too"],
          ["Then the manager", "Agrees, or differs with a reason", "A silent disagreement is not a review"],
          ["Then moderation", "Managers compared against each other", "Outliers are a conversation, never an edit"],
          ["Outcome", "Rating, comments, and any step increase", "The increase reaches Payroll as a variation"],
          ["What staff keep", "Their own appraisal, permanently", "Downloadable, and quoted at the next cycle"],
        ],
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "KPI sets, by role",
        tag: `${Object.keys(kpiSets).length} sets in use`,
        tagTone: "neutral",
        sub: "Open a role to set its KPIs. Nothing publishes until the weights total 100.",
        meta: "A person is appraised against their role's set — never against a set written for somebody else",
        search: "Find a role",
        noun: "role",
        nounPlural: "roles",
        per: 11,
        filters: [
          { label: "Set", value: "All", options: ["All", "Teaching", "Leadership", "Support"], column: 1 },
          { label: "Published", value: "All", options: ["All", "Published", "Not in use"], column: 6 },
        ],
        acts: [
          {
            label: "Define a KPI",
            drawer: {
              mode: "commit",
              kicker: "Appraisal",
              title: "Define a KPI",
              sub: "A KPI a school cannot measure is not a KPI — it is a hope.",
              facts: [
                ["Where the number comes from", "A figure the product already holds, or a manager's rating"],
                ["Weight", "The set must total 100 to be published"],
              ],
              commitLabel: "Create the KPI",
              commitDone: "KPI created",
              commitDoneBody: "It is on the set.",
            },
          },
          {
            label: "Publish the cycle",
            primary: true,
            drawer: {
              mode: "commit",
              kicker: "Appraisal",
              title: "Publish the Second Term cycle",
              sub: "Everyone sees their own KPIs and can start their self-assessment.",
              facts: [
                ["Staff", String(appraisals.length)],
                ["Closes", "30 September"],
              ],
              commitLabel: "Publish the cycle",
              commitDone: "Cycle published",
              commitDoneBody: "Everyone can start their self-assessment.",
            },
          },
        ],
        head: ["Role", "KPI set", "KPIs", "Weight", "Where the numbers come from", "People", "Published", ""],
        rows: schoolRoleTemplates.map((template): TableRow => {
          const setName = kpiSetFor(template.name);
          const set = kpiSets[setName];
          const auto = set.filter((kpi) => /automatic/i.test(kpi.source)).length;
          const weight = set.reduce((total, kpi) => total + kpi.weight, 0);
          const holders = people.filter((person) => person.role === template.name).length;

          return {
            cells: [
              text(template.name, { strong: true }),
              text(setName.replace(/^./, (char) => char.toUpperCase())),
              text(String(set.length), { mono: true }),
              text(`${weight}%`, { mono: true, strong: true, tone: weight === 100 ? "positive" : "negative" }),
              text(`${auto} read from the product · ${set.length - auto} rated by the manager`),
              text(String(holders), { mono: true }),
              pill(holders ? "Published" : "Not in use", holders ? "positive" : "neutral"),
              {
                kind: "action",
                label: "Open",
                drawer: {
                  kicker: `${setName.replace(/^./, (char) => char.toUpperCase())} set`,
                  title: `${template.name} · KPIs`,
                  sub: `${auto} of ${set.length} KPIs read a figure the product already holds.`,
                  facts: [
                    ["People on this role", String(holders)],
                    ["Weights", `${weight}%`, weight === 100 ? "Ready to publish" : "Must total 100 to publish"],
                    ...set.map(
                      (kpi): [string, string, string?] => [
                        kpi.name,
                        `${kpi.weight}% · ${kpi.source}`,
                        `${kpi.detail} · target ${kpi.target}`,
                      ],
                    ),
                  ],
                },
              },
            ],
            keywords: setName,
          };
        }),
        foot: "A KPI a school cannot measure is not a KPI — it is a hope. Every KPI here either reads a figure the product already holds, or is rated by a named person against stated evidence.",
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "Where each person is",
        tag: `${withMe} with you`,
        tagTone: withMe ? "attention" : "positive",
        sub: "One line per person in the cycle. Open anyone to read their self-assessment and write your review.",
        meta: `Second Term cycle · closes 30 September · ${complete} complete`,
        search: "Find a staff member",
        noun: "staff member",
        nounPlural: "staff",
        per: 10,
        selectable: true,
        filters: [
          {
            label: "Stage",
            value: "All",
            options: ["All", "Not started", "Self-assessment", "With you", "Complete"],
            column: 7,
          },
          { label: "KPI set", value: "All", options: ["All", "Teaching", "Leadership", "Support"], column: 2 },
        ],
        bulkActs: [
          { label: "Send a reminder" },
          { label: "Extend the deadline" },
          { label: "Export selected", primary: true },
        ],
        acts: [
          { label: "Send a reminder", href: "/communication-center/compose" },
          { label: "Review the next one", primary: true, drawer: appraisalDrawer(firstWithMe) },
        ],
        head: ["Staff member", "Role", "KPI set", "Self-assessment", "Evidence", "Their score", "Your score", "Stage", ""],
        rows: appraisals.map(
          (entry): TableRow => ({
            cells: [
              nameCell(entry.person.name, entry.person.dept),
              text(entry.person.role),
              text(entry.set.replace(/^./, (char) => char.toUpperCase())),
              entry.stage === "Not started"
                ? text("Not started", { strong: true, tone: "negative" })
                : entry.stage === "Self-assessment"
                  ? text("In progress", { tone: "attention" })
                  : text("Submitted", { tone: "positive" }),
              entry.evidence ? text(String(entry.evidence), { mono: true }) : text("—"),
              entry.selfScore ? text(`${entry.selfScore.toFixed(1)} of 5`, { mono: true }) : text("—"),
              entry.mine ? text(`${entry.mine.toFixed(1)} of 5`, { mono: true, strong: true }) : text("—"),
              pill(
                entry.stage,
                entry.stage === "Complete"
                  ? "positive"
                  : entry.stage === "With you"
                    ? "attention"
                    : entry.stage === "Self-assessment"
                      ? "progress"
                      : "neutral",
              ),
              {
                kind: "action",
                label: entry.stage === "With you" ? "Review" : entry.stage === "Complete" ? "Open" : "Chase",
                drawer: appraisalDrawer(entry),
              },
            ],
            keywords: `${entry.person.dept} ${entry.set}`,
          }),
        ),
        foot: "A self-assessment far above the manager's rating is not a problem to hide — it is the most useful conversation in the cycle, and it is surfaced as its own view.",
      },
    ]),
  ],
};

/* ---------------------------------------------------------------- Activity */

type ActivityRow = {
  name: string;
  role: string;
  registers: string;
  registersTone?: PanelTone;
  sheets: string;
  sheetsTone?: PanelTone;
  remarks: string;
  remarksTone?: PanelTone;
  approvals: string;
  messages: string;
  lastLogin: string;
  lastLoginTone?: PanelTone;
};

const activityRows: ActivityRow[] = [
  { name: "Mr Ibrahim Danladi", role: "Form Master · Mathematics", registers: "31 of 34 · 79% on time", registersTone: "attention", sheets: "4 in · 2 returned", sheetsTone: "attention", remarks: "0 of 31", remarksTone: "negative", approvals: "—", messages: "2 · 62 recipients", lastLogin: "3 hours ago" },
  { name: "Mrs Ngozi Eze", role: "Form Master · Languages", registers: "28 of 34 · 71% on time", registersTone: "negative", sheets: "3 in · 0 returned", remarks: "18 of 29", remarksTone: "attention", approvals: "—", messages: "1 · 29 recipients", lastLogin: "Yesterday" },
  { name: "Mr Samuel Adeyemi", role: "Exam Officer · Sciences", registers: "34 of 34 · 100% on time", registersTone: "positive", sheets: "6 in · 1 returned", remarks: "—", approvals: "41 decided · 9 open · 2.1 days", messages: "4 · 186 recipients", lastLogin: "26 min ago" },
  { name: "Mrs Folake Adeniyi", role: "Exam Officer · Languages", registers: "34 of 34 · 100% on time", registersTone: "positive", sheets: "5 in · 0 returned", remarks: "29 of 29", remarksTone: "positive", approvals: "52 decided · 4 open · 0.8 days", messages: "3 · 118 recipients", lastLogin: "1 hour ago" },
  { name: "Mrs Blessing Uche", role: "Form Master · Commerce", registers: "33 of 34 · 94% on time", sheets: "4 in · 0 returned", remarks: "9 of 24", remarksTone: "attention", approvals: "—", messages: "0", lastLogin: "5 hours ago" },
  { name: "Mr Peter Obi", role: "Form Master · Sciences", registers: "30 of 34 · 88% on time", sheets: "4 in · 0 returned", remarks: "22 of 22", remarksTone: "positive", approvals: "—", messages: "0", lastLogin: "96 days ago", lastLoginTone: "negative" },
  { name: "Mrs Chinelo Obi", role: "Bursar · Finance", registers: "—", sheets: "—", remarks: "—", approvals: "18 decided · 3 open · 1.4 days", messages: "6 · 842 recipients", lastLogin: "18 min ago" },
  { name: "Adaeze Nwosu", role: "Principal · you", registers: "34 of 34 · 100% on time", registersTone: "positive", sheets: "—", remarks: "612 of 1,560", remarksTone: "attention", approvals: "96 decided · 6 open · 3.2 days", messages: "9 · 4,120 recipients", lastLogin: "2 min ago" },
];

const activityTab: TabContent = {
  title: "Activity",
  desc: "What each staff member has and has not submitted this term.",
  primary: {
    label: "Export for review",
    drawer: {
      kicker: "Activity",
      title: "Export for review",
      sub: "Second Term, every figure drawn from its own module.",
      facts: [
        ["Staff reporting", "31"],
        ["Term", "Second Term · term day 34"],
        ["What is in it", "Registers, sheets, remarks, approvals, messages, last sign-in"],
        ["Format", "CSV and PDF"],
      ],
    },
  },
  rows: [
    row("1fr", [
      {
        type: "kpi",
        per: 4,
        cards: [
          { label: "Staff reporting", value: "31", sub: "Every figure drawn from its own module" },
          { label: "Registers on time", value: "91%", sub: "School-wide, this term", tone: "positive" },
          { label: "Sheets outstanding", value: "16", sub: "Across 5 teachers", tone: "attention" },
          { label: "Remarks outstanding", value: "948", sub: "2 form masters have not started", tone: "attention" },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "This term, by staff member",
        sub: "Drawn from every module's tracker.",
        meta: "Second Term · term day 34",
        search: "Find a staff member",
        noun: "staff member",
        nounPlural: "staff",
        per: 8,
        filters: [
          {
            label: "Role",
            value: "All roles",
            options: ["All roles", "Form Master", "Exam Officer", "Bursar", "Principal"],
            column: 0,
          },
        ],
        head: ["Staff member", "Registers", "Score sheets", "Remarks", "Approvals", "Messages", "Last login"],
        rows: activityRows.map(
          (entry): TableRow => ({
            cells: [
              nameCell(entry.name, entry.role),
              text(entry.registers, entry.registersTone ? { tone: entry.registersTone } : {}),
              text(entry.sheets, entry.sheetsTone ? { tone: entry.sheetsTone } : {}),
              text(entry.remarks, entry.remarksTone ? { tone: entry.remarksTone, strong: entry.remarksTone === "negative" } : {}),
              text(entry.approvals),
              text(entry.messages),
              text(entry.lastLogin, entry.lastLoginTone ? { tone: entry.lastLoginTone, strong: true } : {}),
            ],
            drawer: {
              kicker: "Activity · Second Term",
              title: entry.name,
              sub: `${entry.role}. Every figure below is drawn from its own module.`,
              facts: [
                ["Role", entry.role],
                ["Registers", entry.registers, "Marked before the daily cut-off"],
                ["Score sheets", entry.sheets, "In, and how many came back"],
                ["Remarks", entry.remarks, "Written before the window closes"],
                ["Approvals", entry.approvals, "Decided, open, and the average age"],
                ["Messages", entry.messages],
                ["Last sign-in", entry.lastLogin],
              ],
            },
            keywords: entry.role,
          }),
        ),
      },
    ]),
  ],
};

export const staffAccessContent: ModuleContent = {
  directory: directoryTab,
  permissions: permissionsTab,
  payroll: payrollTab,
  leave: leaveTab,
  appraisal: appraisalTab,
  activity: activityTab,
};
