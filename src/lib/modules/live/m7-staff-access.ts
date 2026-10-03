import { apiGet } from "@/lib/api/server";
import {
  name as nameCell,
  pill,
  text,
  type DrawerSpec,
  type KpiCard,
  type PanelTone,
  type TabContent,
  type TableRow,
} from "@/lib/modules/panels";

/**
 * M07 Staff & Access · Directory, read from `GET /v1/staff`.
 *
 * Directory only. Permissions, Payroll, Leave, Appraisal and Activity keep
 * their authored content — payroll and leave have their own endpoints but not
 * ones shaped for these tabs, and the permissions grid is a 330-key matrix that
 * deserves its own pass rather than a table squeezed out of this call.
 */

type StaffRow = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  roles: string[];
  status: string;
  isActive: boolean;
  staffType: string | null;
  employeeNo: string | null;
  designation: string | null;
  departmentName?: string | null;
  campusName?: string | null;
};

const STATUS_TONE: Record<string, PanelTone> = {
  ACTIVE: "positive",
  PENDING: "attention",
  INACTIVE: "neutral",
  SUSPENDED: "negative",
  LOCKED: "negative",
};

/** A role reads as a title, not a constant. */
function roleLabel(role: string): string {
  return role
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * The drawer behind a staff row.
 *
 * Its command is the account's standing, because that is the decision this page
 * exists to carry: somebody has left, or should not be signing in today. The
 * reason is required and kept — a suspension nobody can explain later is how a
 * directory stops being trusted. Everything else about a person (their pay,
 * their leave, their appraisal) belongs to the tab that owns it.
 */
function staffDrawer(staff: StaffRow): DrawerSpec {
  const suspended = staff.status === "SUSPENDED" || staff.status === "LOCKED";

  return {
    kicker: staff.employeeNo ?? roleLabel(staff.role),
    title: staff.fullName,
    sub: `${staff.designation ?? roleLabel(staff.role)} · ${staff.status.toLowerCase()}`,
    tone: STATUS_TONE[staff.status] ?? "neutral",
    facts: [
      ["Employee number", staff.employeeNo ?? "Not issued"],
      ["Role", roleLabel(staff.role)],
      ["Designation", staff.designation ?? "—"],
      ["Department", staff.departmentName ?? "Not assigned"],
      ["Campus", staff.campusName ?? "—"],
      ["Staff type", staff.staffType ? roleLabel(staff.staffType) : "—"],
      ["Email", staff.email],
      ["Phone", staff.phone ?? "—"],
      ["Account", staff.status],
      ["Extra roles held", staff.roles.length ? staff.roles.join(", ") : "None beyond their role"],
    ],
    mode: "commit",
    commitLabel: suspended ? "Restore this account" : "Suspend this account",
    commitNote: suspended
      ? "They will be able to sign in again immediately."
      : "They are signed out and cannot sign in again until the account is restored.",
    commitDone: suspended ? "Account restored" : "Account suspended",
    commitDoneBody: suspended
      ? `${staff.fullName} can sign in again.`
      : `${staff.fullName} can no longer sign in.`,
    submit: {
      endpoint: `/api/v1/staff/${staff.id}/status`,
      method: "PATCH",
      body: { status: suspended ? "ACTIVE" : "SUSPENDED" },
      reasonKey: "reason",
      reasonLabel: suspended ? "Why they are coming back" : "Why they are being suspended",
      reasonRequired: true,
    },
  };
}

export function directoryTab(staff: StaffRow[]): TabContent {
  const active = staff.filter((person) => person.status === "ACTIVE");
  const blocked = staff.filter(
    (person) => person.status === "SUSPENDED" || person.status === "LOCKED",
  );
  const pending = staff.filter((person) => person.status === "PENDING");
  const academic = staff.filter((person) => person.staffType === "ACADEMIC");
  const noDepartment = staff.filter((person) => !person.departmentName);

  const cards: KpiCard[] = [
    { label: "On the payroll list", value: String(staff.length), sub: "Every staff record" },
    {
      label: "Active accounts",
      value: `${active.length} of ${staff.length}`,
      tone: active.length === staff.length ? "positive" : "attention",
      sub: pending.length ? `${pending.length} never signed in` : "Nobody is pending",
    },
    {
      label: "Suspended or locked",
      value: String(blocked.length),
      tone: blocked.length > 0 ? "negative" : "positive",
      sub: blocked.length ? "Cannot sign in today" : "Nobody is shut out",
    },
    {
      label: "Teaching staff",
      value: String(academic.length),
      sub: `${staff.length - academic.length} non-teaching`,
    },
    {
      label: "No department",
      value: String(noDepartment.length),
      tone: noDepartment.length > 0 ? "attention" : "positive",
      sub: noDepartment.length ? "Nothing to report them under" : "Everybody is placed",
    },
  ];

  const rows: TableRow[] = staff.map((person) => ({
    cells: [
      nameCell(person.fullName, person.email),
      text(roleLabel(person.role)),
      text(person.departmentName ?? "—", {
        tone: person.departmentName ? "neutral" : "attention",
      }),
      text(person.employeeNo ?? "—", { mono: true }),
      text(person.staffType ? roleLabel(person.staffType) : "—"),
      pill(person.status, STATUS_TONE[person.status] ?? "neutral"),
      { kind: "action" as const, label: "Open", drawer: staffDrawer(person) },
    ],
    drawer: staffDrawer(person),
    keywords: `${person.email} ${person.phone ?? ""} ${person.designation ?? ""}`,
  }));

  return {
    title: "Directory",
    desc: "Everybody who works here, what they are allowed to be, and whether they can sign in today.",
    launchers: [{ label: "Permissions", href: "/staff-access/permissions" }],
    rows: [
      {
        cols: "1fr",
        panels: [{ type: "kpi", title: "Who works here", per: 5, cards }],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Every staff record",
            sub: staff.length
              ? `${staff.length} record${staff.length === 1 ? "" : "s"}.`
              : "No staff record has been created yet.",
            head: ["Name", "Role", "Department", "Employee no.", "Type", "Account", ""],
            rows,
            per: 10,
            empty: "No staff member matches this filter.",
          },
        ],
      },
    ],
  };
}


type RoleRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  systemRole: string | null;
  permissionsCount: number;
  staffCount: number;
};

type PermissionGroup = {
  module: string;
  permissions: Array<{ key: string; label: string; description: string; module: string }>;
};

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  actor: string | null;
  actorRole: string | null;
  ipAddress: string | null;
  createdAt: string;
};

type AuditFeed = {
  entries: AuditEntry[];
  total: number;
  byAction: Array<{ action: string; count: number }>;
  byActor: Array<{ actor: string; count: number }>;
};

function readableKey(value: string): string {
  const words = value.replace(/_/g, " ").toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function whenStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * M07 · Permissions, read from the roles-management endpoints.
 *
 * The thing worth seeing here is not the catalogue but the shape of it: how
 * many roles exist, how many are actually held by somebody, and how wide the
 * widest one is. A role nobody holds is not access control, it is furniture.
 */
function permissionsTab(roles: RoleRow[], groups: PermissionGroup[]): TabContent {
  const held = roles.filter((role) => role.staffCount > 0);
  const unheld = roles.filter((role) => role.staffCount === 0);
  const totalKeys = groups.reduce((sum, group) => sum + group.permissions.length, 0);
  const widest = roles.slice().sort((a, b) => b.permissionsCount - a.permissionsCount)[0];
  const custom = roles.filter((role) => !role.isSystem);

  return {
    title: "Permissions",
    desc: "Which roles exist, who holds them, and how much each one can reach.",
    launchers: [{ label: "Directory", href: "/staff-access/directory" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "How access is shaped",
            per: 4,
            cards: [
              { label: "Roles defined", value: String(roles.length), sub: `${custom.length} custom` },
              {
                label: "Roles actually held",
                value: String(held.length),
                sub: `${unheld.length} held by nobody`,
                tone: unheld.length > held.length ? "attention" : "positive",
              },
              {
                label: "Permission keys",
                value: String(totalKeys),
                sub: `Across ${groups.length} areas`,
              },
              {
                label: "Widest role",
                value: widest ? String(widest.permissionsCount) : "—",
                sub: widest ? widest.name : "none",
                tone: widest && widest.permissionsCount > totalKeys * 0.8 ? "attention" : undefined,
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          unheld.length
            ? {
                type: "note",
                tone: "attention",
                title: `${unheld.length} of the ${roles.length} roles are held by nobody`,
                body: "An unheld role still carries its permissions, so it is a grant waiting to be made rather than one in force. Worth pruning the ones this school will never use — a shorter list is one somebody can actually audit.",
              }
            : {
                type: "note",
                tone: "positive",
                title: "Every role is held by somebody",
                body: "Nothing in the list is a grant waiting to happen.",
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Roles",
            sub: "Most widely held first.",
            meta: `${roles.length} roles · ${totalKeys} permission keys`,
            head: ["Role", "Holders", "Permissions", "Kind", ""],
            per: 12,
            rows: roles
              .slice()
              .sort((a, b) => b.staffCount - a.staffCount || b.permissionsCount - a.permissionsCount)
              .map((role) => ({
                cells: [
                  nameCell(role.name, role.description ?? ""),
                  text(String(role.staffCount), {
                    tone: role.staffCount ? "positive" : "attention",
                    strong: role.staffCount > 0,
                  }),
                  text(String(role.permissionsCount)),
                  pill(role.isSystem ? "System" : "Custom", role.isSystem ? "neutral" : "positive"),
                  {
                    kind: "action" as const,
                    label: "View",
                    drawer: {
                      kicker: role.isSystem ? "System role" : "Custom role",
                      title: role.name,
                      sub: role.description ?? undefined,
                      readOnly: true,
                      readOnlyNote:
                        "A system role's permissions are defined by the platform. Changing what somebody can reach is done by moving them between roles, which keeps the change on the audit trail.",
                      facts: [
                        ["Role", role.name],
                        ["Slug", role.slug],
                        ["Kind", role.isSystem ? "System" : "Custom"],
                        ["Maps to", role.systemRole ?? "—"],
                        ["Held by", `${role.staffCount} staff`],
                        ["Permissions", String(role.permissionsCount)],
                        ["Description", role.description ?? "none"],
                      ],
                    },
                  },
                ],
                keywords: `${role.name} ${role.slug} ${role.systemRole ?? ""}`,
              })),
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "bars",
            title: "Permission keys by area",
            sub: "Where the surface area is.",
            rows: groups
              .slice()
              .sort((a, b) => b.permissions.length - a.permissions.length)
              .slice(0, 10)
              .map((group) => ({
                label: group.module,
                value: group.permissions.length,
                display: String(group.permissions.length),
              })),
          },
        ],
      },
    ],
  };
}

/**
 * M07 · Activity, read from `GET /v1/audit/recent`.
 *
 * Same trail M15 reads, asked a different question: not what happened to the
 * records, but which members of staff are doing things — and whether anybody
 * is acting without leaving a name behind.
 */
function activityTab(feed: AuditFeed): TabContent {
  const named = feed.entries.filter((entry) => entry.actor);
  const system = feed.entries.filter((entry) => !entry.actor);
  const roles = new Map<string, number>();
  for (const entry of named) {
    const key = entry.actorRole ? readableKey(entry.actorRole) : "Unknown";
    roles.set(key, (roles.get(key) ?? 0) + 1);
  }

  return {
    title: "Activity",
    desc: "What staff have been doing, from the school's own audit trail.",
    launchers: [{ label: "Full audit log", href: "/audit-security/audit-log" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "Who is acting on this school",
            per: 4,
            cards: [
              { label: "Entries read", value: String(feed.entries.length), sub: `of ${feed.total.toLocaleString()} on file` },
              {
                label: "Named people",
                value: String(feed.byActor.length),
                sub: feed.byActor.length ? `Busiest: ${feed.byActor[0]?.actor}` : "Nobody named",
              },
              {
                label: "By the system",
                value: String(system.length),
                sub: system.length ? "No person attached" : "Every action has a name",
                tone: system.length ? "attention" : "positive",
              },
              {
                label: "Roles acting",
                value: String(roles.size),
                sub: Array.from(roles.keys()).slice(0, 2).join(" · ") || "none",
              },
            ],
          },
        ],
      },
      {
        cols: "1.1fr 1fr",
        panels: [
          {
            type: "bars",
            title: "Busiest staff",
            sub: "Counted off the entries read, not the whole table.",
            rows: feed.byActor.map((row) => ({
              label: row.actor,
              value: row.count,
              display: String(row.count),
            })),
          },
          {
            type: "bars",
            title: "By role",
            sub: "Which seats the work is being done from.",
            rows: Array.from(roles.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([role, count]) => ({ label: role, value: count, display: String(count) })),
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Recent staff activity",
            sub: "Most recent first.",
            meta: `${named.length} named · ${system.length} by the system`,
            head: ["Who", "Role", "Action", "Record", "From", "When"],
            per: 15,
            rows: feed.entries.map((entry) => ({
              cells: [
                text(entry.actor ?? "System", {
                  strong: Boolean(entry.actor),
                  tone: entry.actor ? undefined : "attention",
                }),
                text(entry.actorRole ? readableKey(entry.actorRole) : "—"),
                pill(readableKey(entry.action), "neutral"),
                text(entry.entityType),
                text(entry.ipAddress ?? "—", { mono: Boolean(entry.ipAddress) }),
                text(whenStamp(entry.createdAt)),
              ],
              keywords: `${entry.actor ?? "system"} ${entry.action} ${entry.entityType}`,
            })),
          },
        ],
      },
    ],
  };
}


type LeaveRow = {
  id: string;
  staffId: string;
  staffName: string | null;
  employeeNo: string | null;
  designation: string | null;
  department: string | null;
  type: string;
  reason: string;
  status: string;
  startDate: string;
  endDate: string;
  reviewedAt: string | null;
  days: number;
  active: boolean;
};

type PayrollFeed = {
  runs: Array<{
    id: string;
    month: number;
    year: number;
    status: string;
    processedAt: string | null;
    publishedAt: string | null;
    itemCount: number;
    netTotal: number;
    payslipsSent: number;
    paid: number;
  }>;
  staffCount: number;
  bands: Array<{ band: string; count: number }>;
  unbanded: number;
};

function leaveTone(status: string): PanelTone {
  switch (status.toUpperCase()) {
    case "APPROVED":
      return "positive";
    case "PENDING":
      return "attention";
    case "REJECTED":
    case "CANCELLED":
      return "negative";
    default:
      return "neutral";
  }
}

function dayStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** M07 · Leave, read from `GET /v1/staff/leave`. */
function leaveTab(rows: LeaveRow[]): TabContent {
  const pending = rows.filter((row) => row.status.toUpperCase() === "PENDING");
  const active = rows.filter((row) => row.active);
  const days = rows.reduce((sum, row) => sum + row.days, 0);
  const unreviewed = pending.filter((row) => !row.reviewedAt);

  return {
    title: "Leave",
    desc: "Who is away, who is asking to be, and what is waiting on a decision.",
    launchers: [{ label: "Directory", href: "/staff-access/directory" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "Leave on file",
            per: 4,
            cards: [
              { label: "Requests", value: String(rows.length), sub: `${days} days in total` },
              {
                label: "Waiting on a decision",
                value: String(pending.length),
                sub: pending.length ? "Nobody has answered these" : "Nothing outstanding",
                tone: pending.length ? "attention" : "positive",
              },
              {
                label: "Away right now",
                value: String(active.length),
                sub: active.length ? "Covered by somebody, hopefully" : "Everyone is in",
                tone: active.length ? "attention" : "positive",
              },
              {
                label: "Longest request",
                value: rows.length ? `${Math.max(...rows.map((row) => row.days))} days` : "—",
                sub: "Single stretch",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          unreviewed.length
            ? {
                type: "note",
                tone: "attention",
                title: `${unreviewed.length} request${unreviewed.length === 1 ? " has" : "s have"} never been looked at`,
                body: "A leave request with no decision is a teacher who does not know whether to plan cover. The dates arrive whether or not anybody answered.",
              }
            : {
                type: "note",
                tone: "positive",
                title: "Every request has been answered",
                body: "Nobody is waiting to hear whether they can go.",
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          rows.length
            ? {
                type: "table",
                title: "Requests",
                sub: "Most recent dates first.",
                meta: `${rows.length} request${rows.length === 1 ? "" : "s"} · ${pending.length} pending`,
                head: ["Who", "Type", "From", "To", "Days", "Status", ""],
                per: 12,
                rows: rows.map((row) => ({
                  cells: [
                    nameCell(row.staffName ?? "—", `${row.designation ?? ""}${row.department ? ` · ${row.department}` : ""}`),
                    text(row.type),
                    text(dayStamp(row.startDate)),
                    text(dayStamp(row.endDate)),
                    text(String(row.days), { strong: row.days > 5 }),
                    pill(row.status.toLowerCase(), leaveTone(row.status)),
                    {
                      kind: "action" as const,
                      label: "View",
                      drawer: {
                        kicker: row.type,
                        title: row.staffName ?? "Staff member",
                        sub: `${row.days} day${row.days === 1 ? "" : "s"} from ${dayStamp(row.startDate)}`,
                        tone: leaveTone(row.status),
                        readOnly: true,
                        facts: [
                          ["Staff", row.staffName ?? "—"],
                          ["Employee number", row.employeeNo ?? "—"],
                          ["Designation", row.designation ?? "—"],
                          ["Department", row.department ?? "—"],
                          ["Type", row.type],
                          ["From", dayStamp(row.startDate)],
                          ["To", dayStamp(row.endDate)],
                          ["Days", String(row.days)],
                          ["Reason", row.reason],
                          ["Status", row.status.toLowerCase()],
                          ["Reviewed", row.reviewedAt ? dayStamp(row.reviewedAt) : "not yet"],
                        ],
                      },
                    },
                  ],
                  keywords: `${row.staffName ?? ""} ${row.type} ${row.status}`,
                })),
              }
            : {
                type: "note",
                tone: "attention",
                title: "No leave has been requested",
                body: "Nothing on this school has been asked for or recorded.",
              },
        ],
      },
    ],
  };
}

/** M07 · Payroll, read from `GET /v1/staff/payroll`. */
function payrollTab(feed: PayrollFeed): TabContent {
  const published = feed.runs.filter((run) => run.publishedAt);
  const lastRun = feed.runs[0];
  const banded = feed.staffCount - feed.unbanded;

  return {
    title: "Payroll",
    desc: "What the school pays, and whether a run has ever been made.",
    launchers: [{ label: "Directory", href: "/staff-access/directory" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "Payroll as configured",
            per: 4,
            cards: [
              {
                label: "Runs",
                value: String(feed.runs.length),
                sub: feed.runs.length ? `${published.length} published` : "None has ever been made",
                tone: feed.runs.length ? undefined : "attention",
              },
              {
                label: "Staff on the books",
                value: String(feed.staffCount),
                sub: "Would be on a run",
              },
              {
                label: "On a salary band",
                value: String(banded),
                sub: feed.unbanded ? `${feed.unbanded} unbanded` : "Everyone is banded",
                tone: feed.unbanded ? "negative" : "positive",
              },
              {
                label: "Last run",
                value: lastRun ? `${MONTHS[lastRun.month - 1] ?? lastRun.month} ${lastRun.year}` : "—",
                sub: lastRun ? lastRun.status.toLowerCase() : "nothing to show",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          feed.unbanded === feed.staffCount && feed.staffCount > 0
            ? {
                type: "note",
                tone: "negative",
                title: "No member of staff has a salary band",
                body: `All ${feed.staffCount} staff are unbanded, and no payroll run has ever been processed. A run compiled today would have nothing to compute a basic salary from — the band is the input, not an attribute of the run. Payroll cannot start from this page until the bands are set on the staff records.`,
              }
            : feed.unbanded
              ? {
                  type: "note",
                  tone: "attention",
                  title: `${feed.unbanded} staff have no salary band`,
                  body: "A run would skip them or compute nothing for them. The band is what a basic salary is derived from.",
                }
              : {
                  type: "note",
                  tone: "positive",
                  title: "Every staff record carries a salary band",
                  body: "A run has everything it needs to compute from.",
                },
        ],
      },
      {
        cols: "1fr",
        panels: [
          feed.runs.length
            ? {
                type: "table",
                title: "Runs",
                sub: "Most recent first.",
                meta: `${feed.runs.length} run${feed.runs.length === 1 ? "" : "s"}`,
                head: ["Period", "Status", "Staff", "Net total", "Payslips", "Paid"],
                per: 12,
                rows: feed.runs.map((run) => ({
                  cells: [
                    text(`${MONTHS[run.month - 1] ?? run.month} ${run.year}`, { strong: true }),
                    pill(run.status.toLowerCase(), run.publishedAt ? "positive" : "attention"),
                    text(String(run.itemCount)),
                    text(run.netTotal.toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 })),
                    text(`${run.payslipsSent}/${run.itemCount}`),
                    text(`${run.paid}/${run.itemCount}`, {
                      tone: run.paid === run.itemCount ? "positive" : "attention",
                    }),
                  ],
                  keywords: `${run.year} ${run.status}`,
                })),
              }
            : {
                type: "table",
                title: "Salary bands",
                sub: "What the staff records say today, since no run exists to show instead.",
                head: ["Band", "Staff"],
                per: 10,
                rows: feed.bands.map((band) => ({
                  cells: [
                    text(band.band, {
                      tone: band.band === "Unbanded" ? "negative" : undefined,
                      strong: true,
                    }),
                    text(String(band.count)),
                  ],
                  keywords: band.band,
                })),
              },
        ],
      },
    ],
  };
}

export async function staffAccessLiveTab(tabSlug: string): Promise<TabContent | undefined> {
  if (tabSlug === "directory") {
    const staff = await apiGet<StaffRow[]>("/api/v1/staff");
    return directoryTab(staff ?? []);
  }

  if (tabSlug === "permissions") {
    // roles-management is addressed by school in the path and dashboard/context
    // does not carry the id, so the school record supplies it. One extra call,
    // and it is the only place the id is available without a session here.
    const school = await apiGet<{ record: { id: string } }>(
      "/api/v1/configuration/school-information",
    );
    const schoolId = school?.record?.id;
    if (!schoolId) return undefined;

    const base = `/api/v1/school/${schoolId}/roles-management`;
    const [roles, groups] = await Promise.all([
      apiGet<RoleRow[]>(`${base}/roles`),
      apiGet<PermissionGroup[]>(`${base}/permissions`).catch(() => [] as PermissionGroup[]),
    ]);
    return permissionsTab(roles ?? [], groups ?? []);
  }

  if (tabSlug === "activity") {
    const feed = await apiGet<AuditFeed>("/api/v1/audit/recent?take=100");
    return activityTab(feed);
  }

  if (tabSlug === "leave") {
    const rows = await apiGet<LeaveRow[]>("/api/v1/staff/leave");
    return leaveTab(rows ?? []);
  }

  if (tabSlug === "payroll") {
    const feed = await apiGet<PayrollFeed>("/api/v1/staff/payroll");
    if (!feed) return undefined;
    return payrollTab(feed);
  }

  // Appraisal stays authored, and this one is not a seeding gap: there is no
  // appraisal model in the schema at all. Wiring it means designing what an
  // appraisal is before any page can read one.
  return undefined;
}
