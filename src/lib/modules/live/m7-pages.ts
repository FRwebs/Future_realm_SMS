import { apiGet } from "@/lib/api/server";
import {
  ACTIONS,
  API,
  assignmentDrawer,
  applyTemplateDrawer,
  changeRoleDrawer,
  copyModuleDrawer,
  editRecordDrawer,
  inviteDrawer,
  offboardDrawer,
  permMapDrawer,
  permTabsDrawer,
  revealDrawer,
  scopeDrawer,
  simulateDrawer,
  suspendDrawer,
  customRoleDrawer,
} from "@/lib/modules/live/m7-forms";
import { personHref, againstTemplate } from "@/lib/modules/live/m7-permissions";
import { loadPayPerson, loadPayroll, paymentsSection } from "@/lib/modules/live/m7-payroll";
import { ACCOUNT_TONE, dayLabel, dayLong, lastSeen, plural } from "@/lib/modules/live/m7-format";
import { loadDirectory, loadDirectoryContext, loadOverview } from "@/lib/modules/live/m7-staff-access";
import type {
  ActionName,
  ModuleGrant,
  OffboardingPlan,
  PersonAccess,
  StaffRecord,
  TabGrant,
  TemplateGrid,
} from "@/lib/modules/live/m7-types";
import {
  name as nameCell,
  pill,
  text,
  type DrawerSpec,
  type KpiCard,
  type ListItem,
  type PanelFact,
  type PanelTone,
  type TabContent,
  type TableCellKind,
  type TableRow,
} from "@/lib/modules/panels";

/**
 * The pages Staff & Access opens from its tabs: one staff record in four sections, one
 * person's access map, one module of it, one role template, and the exit.
 */

export type RecordSection = "personal" | "assignments" | "payments" | "access";
export type PageContent = TabContent & { crumb?: { label: string; href: string }; name?: string };

const loadRecord = (id: string) => apiGet<StaffRecord>(`${API}/staff/${id}`);
const loadPerson = (userId: string) => apiGet<PersonAccess>(`${API}/access/people/${userId}`);
const loadTemplate = (name: string) => apiGet<TemplateGrid>(`${API}/access/templates/${encodeURIComponent(name)}`);

/* ───────────────────────── marks and plain words ───────────────────────── */

const cellFor = (grant: ModuleGrant["all"], any: ModuleGrant["any"], action: ActionName): TableCellKind =>
  grant[action] ? { kind: "mark", ok: true } : any[action] ? text("Some", { tone: "attention" }) : { kind: "mark", ok: false };

function listOf(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** What a tab's ticks come to, in a sentence a headteacher could say. */
export function plainWords(a: Record<ActionName, boolean>): string {
  if (!a.View) return "Cannot open this tab — it is absent from their module.";
  const can: string[] = ["see it"];
  if (a.Create) can.push("add to it");
  if (a.Edit) can.push("change what is there");
  if (a.Approve) can.push("approve what is routed to them");
  if (a.Export) can.push("export it");
  if (a.Delete) can.push("delete from it");
  const cannot = ACTIONS.filter((action) => !a[action]).map((action) => (action === "Create" ? "add" : action === "Edit" ? "change" : action === "Approve" ? "approve" : action === "Export" ? "export" : "delete"));
  return `Can ${listOf(can)}.${cannot.length ? ` Cannot ${listOf(cannot)}.` : ""}`;
}

/* ───────────────────────── the staff record ───────────────────────── */

const SECTIONS: Array<{ slug: RecordSection; label: string; path: string }> = [
  { slug: "personal", label: "Personal & Employment", path: "" },
  { slug: "assignments", label: "Assignments", path: "/assignments" },
  { slug: "payments", label: "Payments", path: "/payments" },
  { slug: "access", label: "Access & Activity", path: "/access" },
];

export const recordTabs = (id: string) => SECTIONS.map((section) => ({ href: `/staff-access/directory/${id}${section.path}`, label: section.label }));

export type StaffRecordPage = { content: TabContent; tabs: Array<{ href: string; label: string }>; name: string };

export async function staffRecordPage(id: string, section: RecordSection): Promise<StaffRecordPage | null> {
  const record = await loadRecord(id).catch(() => null);
  if (!record) return null;
  const [directory, context] = await Promise.all([loadDirectory(), loadDirectoryContext()]);
  const people = directory.rows.filter((row) => row.userId !== record.userId).map((row) => ({ id: row.userId, name: row.name }));
  const first = record.name.split(" ")[0];

  const edit = editRecordDrawer(record, { departments: directory.departmentOptions, people });
  const suspended = record.account === "Suspended";
  const suspend = suspendDrawer(
    { staffId: record.id, name: record.name, suspended },
    directory.rows.filter((row) => row.userId !== record.userId).map((row) => ({ id: row.userId, label: `${row.name} · ${row.role}` })),
  );
  const invite = inviteDrawer([{ userId: record.userId, name: record.name, role: record.role, accountDays: record.accountDays, phone: record.phone, email: record.email }]);

  const launchers = [
    ...(record.account === "Never activated" ? [{ label: "Resend the link", drawer: invite }] : []),
    { label: suspended ? "Restore the account" : "Suspend the account", drawer: suspend },
    { label: "Offboard", href: `/staff-access/directory/${record.id}/offboarding` },
  ];

  const head = {
    title: record.name,
    desc: `${record.role} · ${record.department} · ${record.staffNo}`,
    primary: { label: "Edit this record", drawer: edit },
    launchers,
  };

  if (section === "personal") {
    const personal = record.personal;
    const dob = personal.dateOfBirth ? dayLong(personal.dateOfBirth) : "Not recorded";
    const employment: PanelFact[] = [
      ["Staff number", record.staffNo],
      ["Designation", record.designation],
      ["Role template", record.role, "Decides what they can open"],
      ["Department", record.department],
      ["Employment", record.employment],
      ["Joined", dayLong(record.since)],
      ["Reports to", record.reportsTo?.name ?? "Nobody named", "Where approvals and escalations about them go"],
      ["Campus", record.campus],
      ["Likely cover", record.cover?.name ?? "Nobody in the department", "Someone in the same department; not a formal cover"],
    ];
    const about: PanelFact[] = [
      ["Gender", personal.gender ? personal.gender.charAt(0) + personal.gender.slice(1).toLowerCase() : "Not recorded"],
      ["Date of birth", dob],
      ["Nationality", personal.nationality ?? "Not recorded"],
      ["State of origin", personal.stateOfOrigin ?? "Not recorded"],
      ["Phone", record.phone ?? "Not recorded", "Their sign-in"],
      ["Email", record.email],
      ["Home address", personal.address ?? "Not recorded"],
      ["Qualification", personal.qualification ?? "Not recorded"],
      ["Years of experience", personal.years === null ? "Not recorded" : String(personal.years)],
    ];
    const holding = record.assignments.filter((item) => item.source !== "duty").length;
    return {
      tabs: recordTabs(id),
      name: record.name,
      content: {
        ...head,
        rows: [
          {
            cols: "1fr 1fr",
            panels: [
              { type: "facts", title: "Employment", sub: "The post, and who they answer to.", per: 1, facts: employment, acts: [{ label: "Edit", drawer: edit }] },
              { type: "facts", title: "Personal", sub: "Contact and background.", per: 1, facts: about, acts: [{ label: "Edit", drawer: edit }] },
            ],
          },
          {
            cols: "1fr 1fr",
            panels: [
              {
                type: "facts",
                title: "Sensitive fields",
                sub: "Next of kin, salary band, health details and emergency contacts stay closed until opened — and opening them is logged.",
                per: 1,
                tag: record.sensitiveHeld.length ? `${plural(record.sensitiveHeld.length, "group")} held` : undefined,
                facts: [
                  ["Next of kin", "Held back"],
                  ["Salary band", "Held back"],
                  ["Health and emergency contacts", "Held back"],
                  ...(record.sensitiveHeld.length ? ([["They themselves hold", record.sensitiveHeld.join(", ")]] as PanelFact[]) : []),
                ],
                acts: [{ label: "Open sensitive fields", drawer: revealDrawer({ id: record.id, name: record.name }) }],
              },
              {
                type: "note",
                tone: holding ? "attention" : "neutral",
                title: holding ? `Before ${first} can leave` : `${first} holds nothing that blocks an exit`,
                body: holding
                  ? `${first} holds ${plural(holding, "teaching or form assignment")}. Each must be given to somebody else before the exit can complete — the offboarding flow asks for that, one by one.`
                  : `No subject-arm and no form class sits with ${first}, so the exit has nothing to reassign.`,
                acts: [{ label: "Offboard", href: `/staff-access/directory/${record.id}/offboarding` }],
              },
            ],
          },
        ],
      },
    };
  }

  if (section === "assignments") {
    const assign = assignmentDrawer(record, { subjects: context.subjects.map((item) => ({ id: item.id, name: item.label })), arms: context.arms.map((item) => ({ id: item.id, name: item.label })) });
    const subjects = record.assignments.filter((item) => item.kind === "Subject").length;
    const forms = record.assignments.filter((item) => item.kind === "Form class").length;
    const duties = record.assignments.filter((item) => item.source === "duty").length;
    const over = record.periods > record.ceiling;
    const cards: KpiCard[] = [
      { label: "Periods a week", value: String(record.periods), unit: `of ${record.ceiling}`, tone: over ? "negative" : "positive", sub: over ? `${record.periods - record.ceiling} over the school ceiling` : "Within the school ceiling" },
      { label: "Subject-arms", value: String(subjects), sub: subjects ? record.subjects.slice(0, 3).join(", ") : "Teaches nothing" },
      { label: "Form class", value: String(forms), sub: forms ? record.arms.slice(0, 2).join(", ") : "Not a form master" },
      { label: "Duties and functions", value: String(duties), sub: duties ? "Held beyond the classroom" : "None recorded" },
    ];
    const rows: TableRow[] = record.assignments.map((item) => {
      const drawer = assignmentDrawer(record, { subjects: [], arms: [] }, item);
      return {
        id: item.id,
        cells: [
          text(item.what, { strong: true }),
          pill(item.kind, "neutral"),
          text(item.where),
          text(item.load),
          text(item.since ? dayLabel(item.since) : "—"),
          pill(item.state, item.state === "Active" ? "positive" : "neutral"),
        ],
        drawer,
        keywords: item.kind,
      };
    });
    return {
      tabs: recordTabs(id),
      name: record.name,
      content: {
        ...head,
        primary: { label: "Assign something", drawer: assign },
        rows: [
          { cols: "1fr", panels: [{ type: "kpi", title: "What they hold", sub: record.role, per: 4, cards }] },
          ...(over
            ? [
                {
                  cols: "1fr",
                  panels: [
                    {
                      type: "note" as const,
                      tone: "attention" as PanelTone,
                      title: `${first} is over the school’s ceiling`,
                      body: `${record.periods} periods a week against a ceiling of ${record.ceiling}. The timetable builder will warn on every week it is built with this load.`,
                      acts: [{ label: "See the load", href: "/class-timetable/teaching" }],
                    },
                  ],
                },
              ]
            : []),
          {
            cols: "1.6fr 1fr",
            panels: [
              {
                type: "table",
                title: "Assignments",
                sub: "Everything this person holds, and where it applies.",
                meta: plural(record.assignments.length, "assignment"),
                noun: "assignment",
                nounPlural: "assignments",
                acts: [{ label: "Assign something", primary: true, drawer: assign }],
                filters: [{ label: "Kind", value: "All kinds", options: ["All kinds", "Subject", "Form class", "Duty", "Approval", "Function"] }],
                head: ["What they hold", "Kind", "Applies to", "Load", "Since", "State"],
                rows,
                empty: "Nothing is assigned yet.",
                emptyTitle: "Nothing assigned",
                emptyBody: `${first} holds no subject, form class or duty yet. Assign one and it routes to them from today.`,
                foot: "Open one to read it, or to remove it.",
              },
              {
                type: "facts",
                title: "The post",
                sub: "What the role asks, and who is behind them.",
                per: 1,
                facts: [
                  ["Role", record.role],
                  ["Designation", record.designation],
                  ["Department", record.department],
                  ["Reports to", record.reportsTo?.name ?? "Nobody named"],
                  ["Ceiling", `${record.ceiling} periods a week`, "Set by the school in Class & Timetable"],
                ],
                acts: [{ label: "Offboard", href: `/staff-access/directory/${record.id}/offboarding` }],
              },
            ],
          },
        ],
      },
    };
  }

  if (section === "payments") {
    const [pay, overview] = await Promise.all([loadPayPerson(record.id), loadPayroll()]);
    return { tabs: recordTabs(id), name: record.name, content: paymentsSection(pay, record, head, overview) };
  }

  // Access & Activity
  const access = await loadPerson(record.userId);
  const overview = await loadOverview().catch(() => null);
  const open = access.modules.filter((module) => module.level > 0);
  const absent = access.modules.filter((module) => module.level === 0);
  const tabsOn = open.reduce((sum, module) => sum + module.tabs.filter((tab) => tab.a.View).length, 0);
  const cards: KpiCard[] = [
    { label: "Modules", value: String(open.length), unit: "of 16", sub: absent.length ? `${absent.length} absent from their navigation` : "Everything is open" },
    { label: "Tabs", value: String(tabsOn), sub: "They can open" },
    { label: "Data scope", value: access.scope, sub: access.scopeEnds ? `Ends ${dayLong(access.scopeEnds)}` : "Until changed" },
    { label: "Fee amounts", value: access.fees, sub: "What they can see of what families owe" },
    { label: "Can approve", value: access.approve === "Nothing" ? "Nothing" : "Yes", sub: access.approve === "Nothing" ? "Cannot decide anything" : access.approve },
    { label: "Sensitive groups", value: String(access.sensitive.length), tone: access.sensitive.length ? "sensitive" : "neutral", sub: access.sensitive.length ? access.sensitive.join(", ") : "None held" },
  ];
  const cannot: ListItem[] = absent.slice(0, 8).map((module) => ({ label: module.name, sub: "Absent from their navigation — not greyed out", pill: "Cannot open", tone: "neutral" as PanelTone }));
  const signIn: PanelFact[] = [
    ["Account", record.account, record.account === "Never activated" ? `The account is ${record.accountDays} days old, with no sign-in` : undefined],
    ["Last sign-in", record.lastLoginAt ? `${dayLong(record.lastLoginAt)} · ${lastSeen(record)}` : "Never"],
    ["Two-step sign-in", record.mfa ? "Required and on" : "Not on", record.mfa ? undefined : "Password only"],
    ["Open sessions", String(record.sessions.length)],
    ["Above their template", access.above ? `${access.above} ${access.above === 1 ? "action" : "actions"}` : "No", access.above ? "Granted to them individually" : "Exactly what the template gives"],
  ];
  const sessions: ListItem[] = record.sessions.map((item) => ({
    label: item.device,
    sub: `${item.ip ?? "Address not recorded"} · started ${dayLabel(item.startedAt)} · active ${dayLabel(item.lastActivityAt)}`,
    pill: "Open",
    tone: "positive",
  }));
  const attempts: ListItem[] = record.signIns.map((item) => ({
    label: item.ok ? "Signed in" : `Refused${item.reason ? ` · ${item.reason}` : ""}`,
    sub: `${dayLong(item.at)} · ${item.device ?? "Device not recorded"}${item.ip ? ` · ${item.ip}` : ""}`,
    pill: item.ok ? "Success" : "Failed",
    tone: item.ok ? "positive" : "attention",
  }));
  void overview;
  return {
    tabs: recordTabs(id),
    name: record.name,
    content: {
      ...head,
      primary: { label: "Open the access map", href: personHref(record.userId) },
      rows: [
        { cols: "1fr", panels: [{ type: "kpi", title: "What they can reach", sub: `${access.role} · read from the permission engine`, per: 6, cards }] },
        {
          cols: "1.5fr 1fr",
          panels: [
            moduleGridTable(access, { limit: 16 }),
            {
              type: "list",
              title: "What they cannot do",
              sub: "Whole modules that are absent for them.",
              tag: String(absent.length),
              items: cannot,
              foot: absent.length > 8 ? `And ${absent.length - 8} more` : absent.length ? undefined : "Every module is open to them.",
            },
          ],
        },
        {
          cols: "1fr 1fr",
          panels: [
            { type: "facts", title: "Sign-in and device", sub: "Read from their account, not typed.", per: 1, facts: signIn },
            {
              type: "list",
              title: "Sessions open now",
              sub: "Where they are signed in at this moment.",
              tag: String(sessions.length),
              items: sessions,
              foot: sessions.length ? undefined : "They have no open session.",
            },
          ],
        },
        {
          cols: "1fr 1fr",
          panels: [
            { type: "list", title: "Recent sign-ins", sub: "Their last attempts, successful or not.", items: attempts, foot: attempts.length ? undefined : "No sign-in has been attempted." },
            {
              type: "list",
              title: "How this access was arrived at",
              sub: "The changes made to it, newest first.",
              items: access.changes.map((change) => ({ label: change.label, sub: change.detail })),
              foot: access.changes.length ? undefined : `Nothing has been changed: ${first} holds exactly what the ${access.role} template gives.`,
            },
          ],
        },
      ],
    },
  };
}

/* ───────────────────────── a person's access map ───────────────────────── */

export function moduleGridTable(person: PersonAccess, o: { limit?: number; editable?: boolean } = {}) {
  const person_ = person;
  const rows: TableRow[] = person_.modules.slice(0, o.limit ?? 16).map((module) => {
    const href = `${personHref(person_.userId)}/${module.slug}`;
    return {
      id: module.slug,
      cells: [
        { kind: "name", name: module.name, sub: module.level ? `${module.tabs.filter((tab) => tab.a.View).length} of ${module.tabs.length} tabs` : "Absent from their navigation", avatar: false },
        ...ACTIONS.map((action) => cellFor(module.all, module.any, action)),
        text(module.level ? person_.scope : "—"),
        { kind: "action", label: module.level ? "Open" : "Grant", href },
      ],
      href,
      keywords: module.level ? "open" : "absent",
    };
  });
  return {
    type: "table" as const,
    title: "Modules and what they may do in each",
    sub: "A tick is every tab of the module; “Some” is some of them. Open a module for the tabs.",
    meta: `${person_.modules.filter((module) => module.level > 0).length} of 16 open`,
    noun: "module",
    nounPlural: "modules",
    filters: [{ label: "Reach", value: "All modules", options: ["All modules", "Open", "Absent"], match: { Open: "open", Absent: "absent" } }],
    head: ["Module", ...ACTIONS, "Data scope", ""],
    rows,
    empty: "No module matches.",
  };
}

export type PersonPage = { content: PageContent; person: PersonAccess };

export async function personPage(userId: string): Promise<PersonPage | null> {
  const person = await loadPerson(userId).catch(() => null);
  if (!person) return null;
  const overview = await loadOverview();
  const first = person.name.split(" ")[0];
  const open = person.modules.filter((module) => module.level > 0);
  const tabsOn = open.reduce((sum, module) => sum + module.tabs.filter((tab) => tab.a.View).length, 0);
  const mapDrawer = permMapDrawer({ kind: "person", person });
  const cards: KpiCard[] = [
    { label: "Modules", value: String(open.length), unit: "of 16", sub: `${16 - open.length} absent from their navigation` },
    { label: "Tabs", value: String(tabsOn), sub: "They can open" },
    { label: "Data scope", value: person.scope, sub: person.scopeEnds ? `Ends ${dayLong(person.scopeEnds)}` : "Until changed", link: "Change", drawer: scopeDrawer(person) },
    { label: "Fee amounts", value: person.fees, sub: "What they can see of what families owe" },
    { label: "Can approve", value: person.approve === "Nothing" ? "Nothing" : "Yes", sub: person.approve === "Nothing" ? "Cannot decide anything" : person.approve },
    { label: "Sensitive groups", value: String(person.sensitive.length), tone: person.sensitive.length ? "sensitive" : "neutral", sub: person.sensitive.length ? person.sensitive.join(", ") : "None held" },
  ];
  const notices = [
    ...(person.account !== "Active"
      ? [
          {
            cols: "1fr",
            panels: [
              {
                type: "note" as const,
                tone: (person.account === "Never activated" ? "negative" : "attention") as PanelTone,
                title: person.account === "Never activated" ? `${first} has never signed in` : person.account === "Dormant" ? `${first} has not signed in for ${person.accountDays} days` : `${first}’s account is suspended`,
                body:
                  person.account === "Never activated"
                    ? "They hold all of this access and have not used it. Anything routed to their role waits unread."
                    : person.account === "Dormant"
                      ? "Dormant accounts hold access nobody is watching. Confirm they still need it, or take it away."
                      : "They cannot sign in; what they held is intact until the account is restored or they are offboarded.",
                acts:
                  person.account === "Never activated"
                    ? [{ label: "Resend the link", drawer: inviteDrawer([{ userId: person.userId, name: person.name, role: person.role, accountDays: person.accountDays, phone: person.phone, email: person.email }]) }]
                    : undefined,
              },
            ],
          },
        ]
      : []),
    ...(person.above
      ? [
          {
            cols: "1fr",
            panels: [
              {
                type: "note" as const,
                tone: "attention" as PanelTone,
                title: `${first} holds ${person.above} ${person.above === 1 ? "action" : "actions"} above the ${person.role} template`,
                body: `${person.aboveKeys.slice(0, 3).map((key) => key.replace(/\./g, " · ")).join("; ")}${person.aboveKeys.length > 3 ? `; and ${person.aboveKeys.length - 3} more` : ""}. These were granted to ${first} personally, so a role change would not remove them.`,
                acts: [{ label: "Apply the template", drawer: applyTemplateDrawer(overview, { userIds: [person.userId], names: person.name, role: person.role }) }],
              },
            ],
          },
        ]
      : []),
  ];
  return {
    person,
    content: {
      title: person.name,
      desc: `${person.role} · ${person.department}${person.hasTemplate ? "" : " · custom role"}`,
      crumb: { label: "Back to Permissions", href: "/staff-access/permissions" },
      primary: { label: "Edit this access map", drawer: mapDrawer },
      launchers: [
        { label: "Change their role", drawer: changeRoleDrawer(person, overview) },
        { label: "Simulate", drawer: simulateDrawer({ name: person.name, role: person.role, modules: person.modules, scope: person.scope, approve: person.approve, fees: person.fees, sensitive: person.sensitive }) },
      ],
      rows: [
        { cols: "1fr", panels: [{ type: "kpi", title: "Access in force", sub: `${person.role} · ${againstTemplate({ above: person.above, below: person.below }).toLowerCase()}`, per: 6, cards }] },
        ...notices,
        { cols: "1fr", panels: [moduleGridTable(person)] },
        {
          cols: "1fr 1fr",
          panels: [
            {
              type: "facts",
              title: "The person behind the access",
              sub: "What the permissions are attached to.",
              per: 1,
              facts: [
                ["Name", person.name],
                ["Role template", person.role],
                ["Department", person.department],
                ["Staff number", person.staffNo ?? "—"],
                ["Account", person.account, person.account === "Never activated" ? `Made ${person.accountDays} days ago` : undefined],
                ["Last sign-in", person.lastLoginAt ? dayLong(person.lastLoginAt) : "Never"],
                ["Two-step sign-in", person.mfa ? "On" : "Not on"],
                ["Access ends", person.accessEnds ? dayLong(person.accessEnds) : "When someone removes it"],
                ["Last recertified", person.recertified ? `${dayLong(person.recertified.at)} · ${person.recertified.by}` : "Not yet"],
              ],
              acts: [
                ...(person.staffId ? [{ label: "Open their record", href: `/staff-access/directory/${person.staffId}` }] : []),
                { label: "Change data scope", drawer: scopeDrawer(person) },
                { label: "Apply a role template", drawer: applyTemplateDrawer(overview, { userIds: [person.userId], names: person.name, role: person.role }) },
              ],
            },
            {
              type: "list",
              title: "Every change to this person’s access",
              sub: "Newest first, with who made it.",
              items: person.changes.map((change) => ({ label: change.label, sub: change.detail })),
              foot: person.changes.length ? undefined : "Nothing has been changed since the account was made.",
            },
          ],
        },
      ],
    },
  };
}

/* ───────────────────────── one module of a person's access ───────────────────────── */

export async function modulePage(userId: string, slug: string): Promise<{ content: PageContent; person: PersonAccess } | null> {
  const person = await loadPerson(userId).catch(() => null);
  const module = person?.modules.find((item) => item.slug === slug);
  if (!person || !module) return null;
  const overview = await loadOverview();
  const first = person.name.split(" ")[0];
  const tabsOn = module.tabs.filter((tab) => tab.a.View);
  const granted = module.tabs.reduce((sum, tab) => sum + tab.on, 0);
  const cards: KpiCard[] = [
    { label: "Reach", value: module.levelLabel || (module.level ? "Open" : "Absent"), sub: module.level ? "In their navigation" : "Absent from their navigation" },
    { label: "Tabs they can open", value: String(tabsOn.length), unit: `of ${module.tabs.length}` },
    { label: "Actions granted", value: String(granted), unit: `of ${module.tabs.length * ACTIONS.length}`, tone: module.baseTicks !== undefined && granted > module.baseTicks ? "attention" : undefined, sub: module.baseTicks !== undefined ? `${module.baseTicks} from the template` : undefined },
    { label: "Can approve", value: module.any.Approve ? "Yes" : "No", sub: module.any.Approve ? "In at least one tab" : "Nothing here is routed to them" },
    { label: "Can export", value: module.any.Export ? "Yes" : "No", sub: module.any.Export ? "Every export is logged" : "Nothing leaves this module" },
  ];
  const tabRows: TableRow[] = module.tabs.map((tab: TabGrant) => ({
    id: tab.slug,
    cells: [text(tab.label, { strong: true }), ...ACTIONS.map<TableCellKind>((action) => ({ kind: "mark", ok: tab.a[action] })), text(plainWords(tab.a))],
  }));
  const withoutModule = person.modules.filter((item) => item.slug !== slug && item.level > 0).flatMap((item) => ACTIONS.filter((action) => item.all[action]).map((action) => `${item.slug}|${action}`));
  const remove: DrawerSpec = {
    mode: "commit",
    kicker: `Permissions · ${person.name}`,
    title: `Remove ${module.name} from ${person.name}`,
    sub: "The module disappears from their navigation.",
    facts: [["Person", person.name], ["Module", module.name], ["Effect", "Absent from their navigation", "Not greyed out — gone"]],
    commitLabel: "Remove the module",
    commitDone: `${module.name} removed`,
    commitDoneBody: "It is absent for them from their next screen. The history of what they did here stays on the record.",
    submit: { endpoint: `${API}/access/people/${person.userId}/grid`, method: "PUT", body: { scope: "module", ticks: withoutModule }, reasonKey: "reason", reasonRequired: true, reasonLabel: "Why it is being taken away" },
  };
  return {
    person,
    content: {
      title: `${module.name} · ${person.name}`,
      desc: module.description,
      crumb: { label: `Back to ${first}’s access`, href: personHref(person.userId) },
      primary: { label: "Edit the tabs and actions", drawer: permTabsDrawer({ kind: "person", person }, module) },
      launchers: [
        { label: "Copy these actions", drawer: copyModuleDrawer(person, module, overview) },
        ...(module.level ? [{ label: "Remove this module", drawer: remove }] : []),
      ],
      rows: [
        { cols: "1fr", panels: [{ type: "kpi", title: "In this module", sub: person.role, per: 5, cards }] },
        {
          cols: "1fr",
          panels: [
            {
              type: "table",
              title: "Tabs and what they may do in each",
              sub: "Six actions per tab, and the same thing said plainly.",
              noun: "tab",
              nounPlural: "tabs",
              head: ["Tab", ...ACTIONS, "In plain words"],
              rows: tabRows,
              foot: "Approval never applies to a person’s own submission, whatever is ticked.",
            },
          ],
        },
        {
          cols: "1fr 1fr",
          panels: [
            {
              type: "facts",
              title: "How this access behaves",
              tuck: "How this access behaves",
              per: 1,
              facts: [
                ["Whose records", person.scope, "Every tick operates over this"],
                ["A tab with no View", "Absent from the module", "Not locked — gone"],
                ["Approval", "Never their own submission", "Even where Approve is ticked"],
                ["Export", module.any.Export ? "Written to the audit log each time" : "Not granted"],
                ["Changing it", "Takes effect on their next screen", "They are not signed out"],
              ],
            },
            {
              type: "list",
              title: "In plain words",
              tuck: "What this means in plain words",
              tuckIcon: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17M8.5 12h7M12 8.5v7",
              sub: "What the ticks come to, tab by tab.",
              items: module.tabs.map((tab) => ({ label: tab.label, sub: plainWords(tab.a), pill: tab.a.View ? `${tab.on} of 6` : "Absent", tone: (tab.a.View ? "neutral" : "negative") as PanelTone })),
            },
          ],
        },
      ],
    },
  };
}

/* ───────────────────────── a role template ───────────────────────── */

export async function rolePage(name: string): Promise<{ content: PageContent; grid: TemplateGrid } | null> {
  const grid = await loadTemplate(name).catch(() => null);
  if (!grid) return null;
  const overview = await loadOverview();
  const open = grid.modules.filter((module) => module.level > 0);
  const tabsOn = open.reduce((sum, module) => sum + module.tabs.filter((tab) => tab.a.View).length, 0);
  const cards: KpiCard[] = [
    { label: "People on it", value: String(grid.people.length), sub: grid.custom ? "Mapped to this role" : "Hold this template" },
    { label: "Modules", value: String(open.length), unit: "of 16" },
    { label: "Tabs", value: String(tabsOn) },
    { label: "Data scope", value: grid.scope },
    { label: "Can approve", value: grid.approve === "Nothing" ? "Nothing" : "Yes", sub: grid.approve },
  ];
  const rows: TableRow[] = grid.modules.map((module) => ({
    id: module.slug,
    cells: [
      { kind: "name", name: module.name, sub: module.level ? `${module.tabs.filter((tab) => tab.a.View).length} of ${module.tabs.length} tabs` : "Absent", avatar: false },
      text(module.level ? module.levelLabel : "Absent"),
      ...ACTIONS.map((action) => cellFor(module.all, module.any, action)),
      text(String(module.ticks)),
      { kind: "action", label: "Edit", drawer: permTabsDrawer({ kind: "template", grid }, module) },
    ],
    drawer: permTabsDrawer({ kind: "template", grid }, module),
  }));
  const holders: ListItem[] = grid.people.map((person) => ({
    label: person.name,
    sub: `${person.department}${person.above ? ` · ${person.above} above` : ""}${person.below ? ` · ${person.below} below` : ""}`,
    pill: person.above ? "Above" : person.below ? "Below" : "At template",
    tone: (person.above ? "attention" : "positive") as PanelTone,
    href: personHref(person.userId),
    viewLabel: "Open",
  }));
  return {
    grid,
    content: {
      title: `The ${grid.name} template`,
      desc: grid.purpose ?? "What a new account in this role starts from — and what everyone on it holds.",
      crumb: { label: "Back to Permissions", href: "/staff-access/permissions" },
      primary: { label: "Edit the whole template", drawer: permMapDrawer({ kind: "template", grid }) },
      launchers: [
        ...(grid.people.length ? [{ label: `Apply it to the ${grid.people.length}`, drawer: applyTemplateDrawer(overview, { userIds: grid.people.map((person) => person.userId), names: `the ${grid.people.length} on ${grid.name}`, role: grid.name }) }] : []),
        { label: "Duplicate as a custom role", drawer: customRoleDrawer(overview, grid.name) },
      ],
      rows: [
        { cols: "1fr", panels: [{ type: "kpi", title: "This template", sub: grid.custom ? "A custom role" : "Built in", per: 5, cards }] },
        {
          cols: "1fr",
          panels: [
            {
              type: "table",
              title: "Sixteen modules, and what the template grants in each",
              sub: "Open a module to set its tabs.",
              meta: `${open.length} of 16 open`,
              noun: "module",
              nounPlural: "modules",
              head: ["Module", "Reach", ...ACTIONS, "Ticks", ""],
              rows,
            },
          ],
        },
        {
          cols: "1fr 1fr",
          panels: [
            { type: "list", title: "Who is on this template", sub: "Open one to see their map.", tag: String(holders.length), items: holders, foot: holders.length ? undefined : "Nobody is on it yet." },
            {
              type: "facts",
              title: "How a template behaves",
              tuck: "How a role template behaves",
              per: 1,
              facts: [
                ["Changing it", "Applies to everyone on it, from their next screen", "Anything granted to a person individually is untouched"],
                ["New accounts", "Start from it, then you confirm every line"],
                ["A tab with no View", "Absent from the module"],
                ["Deleting actions", "Stay with leadership", "Closed for everyone else"],
              ],
            },
          ],
        },
      ],
    },
  };
}

/* ───────────────────────── leaving ───────────────────────── */

export async function offboardChooser(): Promise<PageContent> {
  const directory = await loadDirectory();
  const rows: TableRow[] = directory.rows
    .filter((row) => !row.isYou)
    .map((row) => ({
      id: row.id,
      cells: [
        nameCell(row.name, row.phone ?? row.email),
        text(row.role),
        text(row.department),
        pill(row.account, ACCOUNT_TONE[row.account]),
        text(row.periods ? `${row.periods} periods` : "—"),
        { kind: "action", label: "Begin", href: `/staff-access/directory/${row.id}/offboarding` },
      ],
      href: `/staff-access/directory/${row.id}/offboarding`,
      keywords: `${row.email} ${row.staffNo ?? ""}`,
    }));
  return {
    title: "Offboard someone",
    desc: "Choose who is leaving. Everything they hold finds an owner before the account closes.",
    crumb: { label: "Back to the Directory", href: "/staff-access/directory" },
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Who is leaving",
            sub: "You cannot offboard yourself, or anybody with equal or higher authority than yours.",
            noun: "person",
            nounPlural: "people",
            search: "Find a person",
            head: ["Name", "Role", "Department", "Account", "Teaching", ""],
            rows,
            per: 12,
          },
        ],
      },
    ],
  };
}

export async function offboardingPage(id: string): Promise<{ content: PageContent; plan: OffboardingPlan } | null> {
  const plan = await apiGet<OffboardingPlan>(`${API}/staff/${id}/offboarding`).catch(() => null);
  if (!plan) return null;
  const first = plan.name.split(" ")[0];
  const drawer = offboardDrawer(plan);
  const holding = plan.formClasses.length + plan.subjects.length;
  const cards: KpiCard[] = [
    { label: "Form classes", value: String(plan.formClasses.length), tone: plan.formClasses.length ? "attention" : "positive", sub: plan.formClasses.map((arm) => arm.name).join(", ") || "None" },
    { label: "Subject-arms", value: String(plan.subjects.length), tone: plan.subjects.length ? "attention" : "positive", sub: plan.subjects.length ? "Each needs a teacher" : "None" },
    { label: "Score sheets unfinished", value: String(plan.unsubmittedSheets), tone: plan.unsubmittedSheets ? "negative" : "positive" },
    { label: "Approvals waiting", value: String(plan.routedApprovals), tone: plan.routedApprovals ? "attention" : "positive" },
    { label: "Delegations", value: String(plan.delegations), sub: plan.delegations ? "End on exit" : "None" },
  ];
  return {
    plan,
    content: {
      title: `Offboard ${plan.name}`,
      desc: "The exit completes only when everything they hold has an owner.",
      crumb: { label: `Back to ${plan.name}`, href: `/staff-access/directory/${plan.id}` },
      primary: { label: "Begin the exit", drawer },
      rows: [
        { cols: "1fr", panels: [{ type: "kpi", title: "What they hold today", sub: plan.name, per: 5, cards }] },
        {
          cols: "1fr",
          panels: [
            {
              type: "note",
              tone: holding ? "attention" : "positive",
              title: holding ? `${plural(holding, "thing")} must find ${holding === 1 ? "an owner" : "owners"} first` : `${first} holds nothing that needs reassigning`,
              body: holding
                ? "The exit is taken in four stages: why, what they hold, who takes each over, and the confirmation. The account closes — it is never deleted — and the history stays."
                : "No form class and no subject sits with them. The exit takes four stages, and the account closes without deleting anything.",
              acts: [{ label: "Begin the exit", drawer }],
            },
          ],
        },
        {
          cols: "1fr 1fr",
          panels: [
            {
              type: "list",
              title: "Form classes",
              items: plan.formClasses.map((arm) => ({ label: arm.name, sub: `${arm.roll} on the roll`, pill: "Needs a form master", tone: "attention" as PanelTone })),
              foot: plan.formClasses.length ? undefined : "None.",
            },
            {
              type: "list",
              title: "Subject-arms",
              items: plan.subjects.map((row) => ({ label: `${row.subject} · ${row.arm}`, pill: "Needs a teacher", tone: "attention" as PanelTone })),
              foot: plan.subjects.length ? undefined : "None.",
            },
          ],
        },
      ],
    },
  };
}
