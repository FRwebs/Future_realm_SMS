import { apiGet } from "@/lib/api/server";
import {
  addStaffDrawer,
  API,
  delegationDrawer,
  inviteDrawer,
  type Option,
} from "@/lib/modules/live/m7-forms";
import { appraisalTab, loadAppraisal, loadModeration } from "@/lib/modules/live/m7-appraisal";
import { leaveTab, loadLeave } from "@/lib/modules/live/m7-leave";
import { loadPayroll, payrollTab } from "@/lib/modules/live/m7-payroll";
import { permissionsTab } from "@/lib/modules/live/m7-permissions";
import type {
  AccessOverview,
  AccountState,
  Activity,
  DelegationRow,
  Directory,
  DirectoryRow,
  RoleOption,
} from "@/lib/modules/live/m7-types";
import {
  bar,
  name as nameCell,
  pill,
  text,
  type DrawerSpec,
  type KpiCard,
  type ListItem,
  type PanelTone,
  type TabContent,
  type TableRow,
} from "@/lib/modules/panels";

/**
 * M07 Staff & Access, read from `/api/v1/staff-access`.
 *
 * Six tabs over one idea — who works here, what they hold and what they can reach. The
 * Directory is the people; Permissions is what each can open; Activity is whether they are
 * using it. Payroll, Leave and Appraisal read their own endpoints.
 */

import { ACCOUNT_TONE, dayLabel, dayLong, lastSeen, plural } from "@/lib/modules/live/m7-format";

export { ACCOUNT_TONE, dayLabel, dayLong, lastSeen, plural };

/* ───────────────────────────── Directory ───────────────────────────── */

export type DirectoryContext = {
  roles: RoleOption[];
  subjects: Option[];
  arms: Option[];
  groups: string[];
  ceiling: number;
};

export async function loadDirectory() {
  return apiGet<Directory>(`${API}/directory`);
}
export async function loadOverview() {
  return apiGet<AccessOverview>(`${API}/access/overview`);
}
export async function loadActivity() {
  return apiGet<Activity>(`${API}/activity`);
}

type TeachingLite = { schoolCeiling: number; catalogue: Array<{ id: string; name: string; code?: string; category?: string }> };
type OverviewLite = { arms: Array<{ id: string; name: string }> };

/** Two subjects can share a name; a form that pairs names with ids cannot, so the second is told apart. */
export function uniqueLabels(items: Array<{ id: string; label: string; extra?: string }>): Option[] {
  const seen = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.label, (counts.get(item.label) ?? 0) + 1);
  return items.map((item) => {
    if ((counts.get(item.label) ?? 0) < 2) return { id: item.id, label: item.label };
    const withExtra = item.extra ? `${item.label} (${item.extra})` : item.label;
    const times = (seen.get(withExtra) ?? 0) + 1;
    seen.set(withExtra, times);
    return { id: item.id, label: times > 1 ? `${withExtra} · ${times}` : withExtra };
  });
}

/** What the Add-staff wizard needs: roles, the subject and arm catalogue, and the groups. */
export async function loadDirectoryContext(): Promise<DirectoryContext> {
  const [roles, teaching, structure, access] = await Promise.all([
    apiGet<RoleOption[]>(`${API}/role-options`),
    apiGet<TeachingLite>("/api/v1/class-structure/teaching").catch(() => ({ schoolCeiling: 24, catalogue: [] }) as TeachingLite),
    apiGet<OverviewLite>("/api/v1/class-structure/overview").catch(() => ({ arms: [] }) as OverviewLite),
    loadOverview().catch(() => null),
  ]);
  return {
    roles,
    subjects: uniqueLabels(teaching.catalogue.map((subject) => ({ id: subject.id, label: subject.name, extra: subject.code ?? subject.category }))),
    arms: uniqueLabels(structure.arms.map((arm) => ({ id: arm.id, label: arm.name }))),
    groups: access?.groups.map((group) => group.name) ?? [],
    ceiling: teaching.schoolCeiling,
  };
}

/** The next EMP-### the way the backend counts them, so the wizard can show what it will be given. */
export function nextStaffNumber(rows: Array<{ staffNo: string | null }>): string {
  const highest = rows.reduce((max, row) => Math.max(max, Number.parseInt((row.staffNo ?? "").replace(/\D+/g, ""), 10) || 0), 0);
  return `EMP-${String(highest + 1).padStart(3, "0")}`;
}

export function addStaffFor(directory: Directory, context: DirectoryContext): DrawerSpec {
  return addStaffDrawer({
    roles: context.roles,
    departments: directory.departmentOptions,
    people: directory.rows.map((row) => ({ id: row.userId, name: row.name, role: row.role })),
    subjects: context.subjects,
    arms: context.arms,
    groups: context.groups,
    nextStaffNo: nextStaffNumber(directory.rows),
    ceiling: context.ceiling,
  });
}

function delegationDrawerFor(item: DelegationRow): DrawerSpec {
  const active = item.status === "Active";
  return {
    mode: "view",
    kicker: "Delegation",
    title: `${item.person} · ${item.holds}`,
    sub: active ? "Held for a while, by a named person, with an end date." : "This delegation has ended; the record is kept.",
    tone: active ? "progress" : "neutral",
    facts: [
      ["Holds", item.holds],
      ["Person", item.person],
      ["Granted by", item.grantedBy, dayLong(item.grantedOn)],
      ["Ends", item.expiresOn ? dayLong(item.expiresOn) : "No end date", active ? "Ends on its own that day" : "Ended"],
      ["Why", item.reason || "No reason recorded"],
    ],
    remove: {
      endpoint: `${API}/access/delegations/${item.id}`,
      noun: "delegation",
      warn: "They stop holding it today. What they decided while they held it stays on the record.",
    },
    readOnlyNote: "End it here; to change it, record a new one.",
  };
}

const ACCOUNT_STATES: Array<[AccountState | "Offboarded", string]> = [
  ["Active", "Signed in within the last 90 days"],
  ["Dormant", "Has signed in, but not for 90 days or more"],
  ["Never activated", "The account exists and the activation link has never been used"],
  ["Suspended", "Cannot sign in; the record and history are intact and it can be restored"],
  ["Offboarded", "Left the school; the account is closed and what they held moved on"],
];

export function directoryTab(directory: Directory): TabContent {
  const { counts, rows } = directory;
  const never = rows.filter((row) => row.account === "Never activated");
  const resendAll = inviteDrawer(never, { title: "Resend the activation links" });

  const cards: KpiCard[] = [
    { label: "Total staff", value: String(counts.total), sub: `Across ${plural(counts.departments, "department")}` },
    { label: "Activated", value: String(counts.active), tone: counts.active ? "positive" : "neutral", sub: "Signed in within the last 90 days" },
    {
      label: "Never activated",
      value: String(counts.never),
      tone: counts.never ? "negative" : "positive",
      sub: counts.never ? "Invited, never signed in" : "Everyone has signed in",
      ...(counts.never ? { link: "Resend invitations", drawer: resendAll } : {}),
    },
    { label: "Dormant", value: String(counts.dormant), tone: counts.dormant ? "attention" : "positive", sub: "No sign-in for 90 days or more" },
    {
      label: "Active delegations",
      value: String(counts.delegationsActive),
      sub: counts.delegationsExpired ? `${counts.delegationsExpired} expired` : "None have expired",
    },
  ];

  const roleNames = Array.from(new Set(rows.map((row) => row.role)));
  const departments = Array.from(new Set(rows.map((row) => row.department)));
  const employments = Array.from(new Set(rows.map((row) => row.employment)));
  const states = Array.from(new Set(rows.map((row) => row.account)));
  const token = (kind: string, value: string) => `${kind}:${value}|`;

  const tableRows: TableRow[] = rows.map((row) => {
    const href = `/staff-access/directory/${row.id}`;
    return {
      id: row.userId,
      cells: [
        nameCell(row.isYou ? `${row.name} (you)` : row.name, row.phone ?? row.email),
        text(row.staffNo ?? "—", { mono: true }),
        { kind: "name", name: row.role, sub: row.department, avatar: false },
        { kind: "name", name: row.employment, sub: row.joinedLabel, avatar: false },
        row.account === "Never activated"
          ? { kind: "pill", label: row.account, tone: ACCOUNT_TONE[row.account], drawer: inviteDrawer([row]) }
          : pill(row.account, ACCOUNT_TONE[row.account]),
        text(lastSeen(row), { tone: row.account === "Dormant" || row.account === "Never activated" ? "attention" : undefined }),
        text(String(row.openTasks), { tone: row.openTasks ? "attention" : undefined }),
        text(row.periods ? String(row.periods) : "—"),
        { kind: "action", label: "Open", href },
      ],
      href,
      keywords: `${token("role", row.role)}${token("dept", row.department)}${token("emp", row.employment)}${token("acct", row.account)}${row.email} ${row.staffNo ?? ""}`,
    };
  });

  const matchFor = (kind: string, values: string[]) => Object.fromEntries(values.map((value) => [value, token(kind, value)]));

  const delegationItems: ListItem[] = directory.delegations.map((item) => ({
    label: `${item.person} · ${item.holds}`,
    sub: `${item.grantedBy} · ${item.expiresOn ? `ends ${dayLabel(item.expiresOn)}` : "no end date"}${item.reason ? ` · ${item.reason}` : ""}`,
    pill: item.status,
    tone: item.status === "Active" ? "progress" : "neutral",
    viewLabel: item.status === "Active" ? "Manage" : "View",
    drawer: delegationDrawerFor(item),
  }));

  return {
    title: "Directory",
    desc: "Everyone who works here, what state their account is in, and what they are holding.",
    primary: { label: "Add staff", href: "/staff-access/directory/new" },
    launchers: [{ label: "Offboard someone", href: "/staff-access/directory/offboard" }],
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: "Staff and activation", sub: "Account states are read from sign-ins, never typed", per: 5, cards }] },
      ...(never.length
        ? [
            {
              cols: "1fr",
              panels: [
                {
                  type: "note" as const,
                  tone: "negative" as PanelTone,
                  title: `${plural(never.length, "person", "people")} invited and never activated`,
                  body: `${never
                    .slice(0, 3)
                    .map((row) => row.name)
                    .join(", ")}${never.length > 3 ? ` and ${never.length - 3} more` : ""} ${never.length === 1 ? "has" : "have"} an account and no sign-in. Anything routed to their role waits unread until they use their link.`,
                  acts: [
                    { label: "Resend invitations", drawer: resendAll },
                    { label: "Correct a contact", href: `/staff-access/directory/${rows.find((row) => row.account === "Never activated")?.id ?? ""}` },
                  ],
                },
              ],
            },
          ]
        : []),
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Staff",
            sub: "Open a person to see what they hold, what they are paid and what they can reach.",
            meta: `${plural(rows.length, "person", "people")} · ${plural(counts.departments, "department")}`,
            noun: "person",
            nounPlural: "people",
            search: "Find a person by name, staff number or email",
            filters: [
              { label: "Role", value: "All roles", options: ["All roles", ...roleNames], match: matchFor("role", roleNames) },
              { label: "Department", value: "All departments", options: ["All departments", ...departments], match: matchFor("dept", departments) },
              { label: "Employment", value: "All types", options: ["All types", ...employments], match: matchFor("emp", employments) },
              { label: "Account", value: "All accounts", options: ["All accounts", ...states], match: matchFor("acct", states) },
            ],
            acts: [{ label: "Export directory", export: true }],
            selectable: true,
            bulkActs: [
              { label: "Resend invitation", drawer: inviteDrawer([], { selection: true }), selection: { key: "userIds", noun: "person" } },
              { label: "Export for review", primary: true, export: true },
            ],
            head: ["Name", "Staff ID", "Role", "Employment", "Account", "Last sign-in", "Open tasks", "Periods / week", ""],
            rows: tableRows,
            per: 10,
            empty: "Nobody matches this filter.",
            foot: "Never-activated and dormant accounts are the first thing to look at: work routed to them sits unread.",
          },
        ],
      },
      {
        cols: "1.4fr 1fr",
        panels: [
          {
            type: "list",
            title: "Active delegations",
            sub: "Named people holding a named responsibility for a while.",
            tag: String(counts.delegationsActive),
            acts: [{ label: "Record a delegation", drawer: delegationDrawer({ people: rows.map((row) => ({ userId: row.userId, name: row.name })) }) }],
            items: delegationItems,
            readOnly: false,
            foot: delegationItems.length ? "Each ends on its date. One with no end date survives every recertification, so none is allowed here." : "Nobody is holding anything on behalf of somebody else.",
          },
          {
            type: "facts",
            title: "Account states in use",
            sub: "Every account is in exactly one of these.",
            per: 1,
            facts: ACCOUNT_STATES.map(([state, meaning]) => {
              const value = state === "Offboarded" ? counts.offboarded : state === "Active" ? counts.active : state === "Dormant" ? counts.dormant : state === "Never activated" ? counts.never : counts.suspended;
              return [`${state} · ${value}`, meaning] as [string, string];
            }),
          },
        ],
      },
    ],
  };
}

/* ───────────────────────────── Activity ───────────────────────────── */

const ratio = (done: number, of: number) => (of > 0 ? Math.round((done / of) * 100) : 0);

export function activityTab(activity: Activity): TabContent {
  const { totals, rows } = activity;
  const term = activity.term ? `${activity.term.name} · day ${activity.term.day}` : "No active term";
  const cards: KpiCard[] = [
    { label: "Staff", value: String(totals.staff), sub: term },
    {
      label: "Registers marked",
      value: totals.registerPct === null ? "—" : `${totals.registerPct}%`,
      tone: totals.registerPct === null ? "neutral" : totals.registerPct >= 90 ? "positive" : "attention",
      sub: totals.registerPct === null ? "No register has been marked this term" : "Of the days a register was taken, by their form masters",
    },
    {
      label: "Score sheets outstanding",
      value: String(totals.sheetsOutstanding),
      tone: totals.sheetsOutstanding ? "attention" : "positive",
      sub: totals.sheetsOutstanding ? `Across ${plural(totals.teachersWithSheets, "teacher")}` : "None owed",
    },
    {
      label: "Remarks outstanding",
      value: String(totals.remarksOutstanding),
      tone: totals.remarksOutstanding ? "attention" : "positive",
      sub: totals.formMastersNotStarted ? `${plural(totals.formMastersNotStarted, "form master")} not started` : "Every form master has started",
    },
  ];

  const roleNames = Array.from(new Set(rows.map((row) => row.role)));
  const outstanding = (row: Activity["rows"][number]) =>
    (row.sheets ? row.sheets.inProgress + row.sheets.returned : 0) > 0 ||
    (row.remarks ? row.remarks.of - row.remarks.written : 0) > 0 ||
    (row.registers ? row.registers.of - row.registers.marked : 0) > 0 ||
    (row.approvals ? row.approvals.open : 0) > 0;

  const tableRows: TableRow[] = rows.map((row) => {
    const pending = outstanding(row);
    return {
      id: row.userId,
      cells: [
        nameCell(row.isYou ? `${row.name} (you)` : row.name, `${row.role} · ${row.department}`),
        row.registers
          ? bar(ratio(row.registers.marked, row.registers.of), `${row.registers.marked} / ${row.registers.of}`, ratio(row.registers.marked, row.registers.of) >= 90 ? "positive" : "attention")
          : text("Not a form master"),
        row.sheets
          ? text(`${row.sheets.submitted} of ${row.sheets.total} submitted${row.sheets.returned ? ` · ${row.sheets.returned} returned` : ""}`, { tone: row.sheets.inProgress + row.sheets.returned ? "attention" : undefined })
          : text("None"),
        row.remarks
          ? bar(ratio(row.remarks.written, row.remarks.of), `${row.remarks.written} / ${row.remarks.of}`, row.remarks.written >= row.remarks.of ? "positive" : "attention")
          : text("None"),
        row.approvals ? text(`${row.approvals.decided} decided${row.approvals.open ? ` · ${row.approvals.open} waiting` : ""}`, { tone: row.approvals.open ? "attention" : undefined }) : text("None"),
        text(row.messages ? String(row.messages) : "—"),
        text(row.lastLoginAt ? dayLabel(row.lastLoginAt) : "Never", { tone: row.account === "Dormant" || row.account === "Never activated" ? "attention" : undefined }),
      ],
      href: `/staff-access/directory/${row.id}`,
      keywords: `|role:${row.role}| |work:${pending ? "Has work outstanding" : "Nothing outstanding"}|`,
    };
  });

  return {
    title: "Activity",
    desc: "Whether the access people hold is being used: registers, score sheets, remarks and approvals this term.",
    primary: { label: "Export for review", export: true },
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: "What staff have done", sub: term, per: 4, cards }] },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "This term by staff member",
            sub: "What each person has actually done, against what they were given to do.",
            meta: `${plural(rows.length, "person", "people")}`,
            noun: "person",
            nounPlural: "people",
            search: "Find a person",
            filters: [
              { label: "Role", value: "All roles", options: ["All roles", ...roleNames], match: Object.fromEntries(roleNames.map((role) => [role, `|role:${role}|`])) },
              {
                label: "Work",
                value: "Everyone",
                options: ["Everyone", "Has work outstanding", "Nothing outstanding"],
                match: { "Has work outstanding": "|work:Has work outstanding|", "Nothing outstanding": "|work:Nothing outstanding|" },
              },
            ],
            acts: [{ label: "Export for review", export: true }],
            head: ["Person", "Registers", "Score sheets", "Remarks", "Approvals", "Messages sent", "Last sign-in"],
            rows: tableRows,
            per: 10,
            empty: "Nobody matches this filter.",
            foot: "Read from the registers, score sheets, report cards and approvals themselves — nobody types these.",
          },
        ],
      },
    ],
  };
}

/* ───────────────────────────── the module ───────────────────────────── */

export async function staffAccessLiveTab(tabSlug: string): Promise<TabContent | undefined> {
  if (tabSlug === "directory") {
    return directoryTab(await loadDirectory());
  }
  if (tabSlug === "permissions") {
    return permissionsTab(await loadOverview());
  }
  if (tabSlug === "activity") {
    return activityTab(await loadActivity());
  }
  if (tabSlug === "payroll") {
    return payrollTab(await loadPayroll());
  }
  if (tabSlug === "leave") {
    return leaveTab(await loadLeave());
  }
  if (tabSlug === "appraisal") {
    const [overview, moderation] = await Promise.all([loadAppraisal(), loadModeration()]);
    return appraisalTab(overview, moderation);
  }
  return undefined;
}

export type { DirectoryRow };
