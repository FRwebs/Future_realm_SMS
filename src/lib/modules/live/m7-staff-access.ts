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

export async function staffAccessLiveTab(tabSlug: string): Promise<TabContent | undefined> {
  if (tabSlug !== "directory") return undefined;

  const staff = await apiGet<StaffRow[]>("/api/v1/staff");
  return directoryTab(staff ?? []);
}
