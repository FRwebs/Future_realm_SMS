import { renderToStaticMarkup } from "react-dom/server";

import { PanelRows } from "@/components/modules/panel-renderer";
import { changeRoleDrawer, inviteDrawer, permMapDrawer, recertifyDrawer, tabRows, templateTicks } from "@/lib/modules/live/m7-forms";
import { permissionsTab, againstTemplate } from "@/lib/modules/live/m7-permissions";
import { plainWords } from "@/lib/modules/live/m7-pages";
import { activityTab, directoryTab, nextStaffNumber } from "@/lib/modules/live/m7-staff-access";
import type { AccessOverview, Activity, Directory, DirectoryRow, ModuleGrant, Person, PersonAccess } from "@/lib/modules/live/m7-types";
import type { TabContent } from "@/lib/modules/panels";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/",
}));

const markup = (tab: TabContent) => renderToStaticMarkup(<PanelRows rows={tab.rows} />);

function row(over: Partial<DirectoryRow> = {}): DirectoryRow {
  return {
    id: "sp-1",
    userId: "u-1",
    name: "Boma Hart",
    phone: "+234 803 000 0001",
    email: "boma@school.ng",
    staffNo: "EMP-002",
    role: "Subject Teacher",
    roleCode: "SUBJECT_TEACHER",
    department: "Sciences",
    employment: "Full time",
    joined: "2025-09-01T00:00:00.000Z",
    joinedLabel: "Joined Sep 2025",
    account: "Active",
    accountDays: 2,
    lastLoginAt: "2026-10-13T08:00:00.000Z",
    openTasks: 0,
    periods: 18,
    isYou: false,
    ...over,
  };
}

function directory(rows: DirectoryRow[]): Directory {
  const count = (state: string) => rows.filter((item) => item.account === state).length;
  return {
    counts: {
      total: rows.length,
      departments: new Set(rows.map((item) => item.department)).size,
      active: count("Active"),
      dormant: count("Dormant"),
      never: count("Never activated"),
      suspended: count("Suspended"),
      delegationsActive: 0,
      delegationsExpired: 0,
      offboarded: 0,
    },
    never: [],
    rows,
    delegations: [],
    roleOptions: ["Subject Teacher"],
    departmentOptions: ["Sciences"],
  };
}

const context = {
  roles: [
    { label: "Subject Teacher", role: "SUBJECT_TEACHER", teaching: true, template: "Subject Teacher" },
    { label: "Bursar", role: "BURSAR", teaching: false, template: "Bursar" },
  ],
  subjects: [{ id: "sub-1", label: "Chemistry" }],
  arms: [{ id: "arm-1", label: "SSS 2A" }],
  groups: ["Health and welfare records"],
  ceiling: 24,
};

describe("M07 Directory", () => {
  it("says how many were invited and never activated, by name", () => {
    const tab = directoryTab(
      directory([row(), row({ id: "sp-2", userId: "u-2", name: "Ada Obi", account: "Never activated", lastLoginAt: null, accountDays: 12 })]),
      context,
    );
    const html = markup(tab);
    expect(html).toContain("1 person invited and never activated");
    expect(html).toContain("Ada Obi");
    expect(html).toContain("Resend invitations");
  });

  it("reads the last sign-in from the account, not from a typed field", () => {
    const html = markup(directoryTab(directory([row({ accountDays: 0 }), row({ id: "sp-3", userId: "u-3", name: "Never In", account: "Never activated", lastLoginAt: null })]), context));
    expect(html).toContain("Today");
    expect(html).toContain("Never");
  });

  it("offers the wizard, and offboarding as a way out", () => {
    const tab = directoryTab(directory([row()]), context);
    expect(tab.primary?.label).toBe("Add staff");
    expect(tab.primary?.drawer?.steps?.map((step) => step.title)).toEqual(["Person", "Role", "Teaching or duties", "Access", "Review"]);
    expect(tab.launchers?.[0]).toMatchObject({ label: "Offboard someone", href: "/staff-access/directory/offboard" });
  });

  it("numbers the next staff member the way the server will", () => {
    expect(nextStaffNumber([{ staffNo: "EMP-009" }, { staffNo: "EMP-014" }, { staffNo: null }])).toBe("EMP-015");
    expect(nextStaffNumber([])).toBe("EMP-001");
  });

  it("sends a bulk resend the ticked people, not a fixed list", () => {
    const tab = directoryTab(directory([row()]), context);
    const table = tab.rows.flatMap((item) => item.panels).find((panel) => panel.type === "table" && panel.title === "Staff");
    expect(table && table.type === "table" ? table.bulkActs?.[0].selection : null).toEqual({ key: "userIds", noun: "person" });
    expect(inviteDrawer([], { selection: true }).submit?.body).toBeUndefined();
  });
});

function module(slug: string, name: string, over: Partial<ModuleGrant> = {}): ModuleGrant {
  const none = { View: false, Create: false, Edit: false, Approve: false, Export: false, Delete: false };
  const all = { ...none, View: true, Edit: true };
  return {
    code: slug.toUpperCase(),
    slug,
    name,
    description: `${name}.`,
    level: 2,
    levelLabel: "Edit",
    all,
    any: all,
    ticks: 2,
    tabs: [{ slug: "main", label: "Main", rowKey: `${slug}.main`, a: all, on: 2 }],
    ...over,
  };
}

function person(over: Partial<Person> = {}): Person {
  return {
    userId: "u-1",
    staffId: "sp-1",
    name: "Boma Hart",
    department: "Sciences",
    role: "Subject Teacher",
    roleCode: "SUBJECT_TEACHER",
    hasTemplate: true,
    reach: 6,
    moduleSlugs: ["m4"],
    tabs: 12,
    scope: "Only their own subject-arms",
    fees: "Cannot see fee information",
    approve: "Nothing",
    sensitive: [],
    account: "Active",
    accountDays: 3,
    above: 0,
    aboveWhere: [],
    below: 0,
    isYou: false,
    ...over,
  };
}

function overview(people: Person[]): AccessOverview {
  return {
    people,
    templates: [
      { name: "Subject Teacher", custom: false, id: null, people: 1, reach: 6, moduleSlugs: ["m4"], scope: "Only their own subject-arms", approve: "Nothing" },
      { name: "Bursar", custom: false, id: null, people: 0, reach: 5, moduleSlugs: ["m10"], scope: "The whole school", approve: "Fee adjustments only" },
    ],
    groups: [],
    delegations: [],
    recertification: { last: null, dueOn: null },
    modules: [],
  };
}

describe("M07 Permissions", () => {
  it("counts people above their template and puts each on the decision list", () => {
    const tab = permissionsTab(overview([person({ above: 3, aboveWhere: ["Fee Management"] }), person({ userId: "u-2", name: "Plain Staff" })]));
    const html = markup(tab);
    expect(html).toContain("Above their role template");
    expect(html).toContain("3 actions granted individually");
    expect(html).not.toContain("Nothing needs a decision");
  });

  it("says nothing needs deciding when everyone is at their template and has signed in", () => {
    expect(markup(permissionsTab(overview([person()])))).toContain("Nothing needs a decision");
  });

  it("reads where a person stands against their template", () => {
    expect(againstTemplate({ above: 1, below: 0 })).toBe("Above template");
    expect(againstTemplate({ above: 0, below: 2 })).toBe("Below template");
    expect(againstTemplate({ above: 0, below: 0 })).toBe("At template");
  });

  it("offers the termly recertification as the primary action", () => {
    const tab = permissionsTab(overview([person()]));
    expect(tab.primary?.drawer?.submit?.endpoint).toBe("/api/v1/staff-access/access/recertify");
    expect(recertifyDrawer(overview([person()])).mode).toBe("decide");
  });
});

describe("M07 access forms", () => {
  const access = (modules: ModuleGrant[]): PersonAccess =>
    ({ userId: "u-1", name: "Boma Hart", role: "Subject Teacher", scope: "Only their own subject-arms", above: 0, modules, sensitive: [] }) as unknown as PersonAccess;

  it("seeds the access matrix with exactly what is ticked today", () => {
    const drawer = permMapDrawer({ kind: "person", person: access([module("m4", "Attendance")]) });
    const matrix = drawer.fields?.[0];
    expect(matrix && matrix.kind === "matrix" ? matrix.checked : []).toEqual(expect.arrayContaining(["m4|View", "m4|Edit"]));
    expect(drawer.submit?.endpoint).toBe("/api/v1/staff-access/access/people/u-1/grid");
    expect(drawer.submit?.method).toBe("PUT");
  });

  it("works out what a role change gains and loses from the two roles themselves", () => {
    const base = overview([person()]);
    const drawer = changeRoleDrawer({ ...access([module("m4", "Attendance")]), department: "Sciences", sensitive: [], above: 0 } as PersonAccess, base);
    const summary = drawer.fields?.find((field) => field.label === "What changes for them");
    const bursar = summary && summary.kind === "static" ? summary.by?.cases.Bursar : undefined;
    expect(bursar?.value).toContain("modules gained");
    expect(bursar?.hint).toContain("Loses");
  });

  it("lists every tab of every module as a row, grouped by the module", () => {
    const rows = tabRows();
    expect(rows.length).toBeGreaterThan(40);
    expect(rows.every((item) => item.group && item.key.includes("."))).toBe(true);
    expect(templateTicks("Subject Teacher").every((tick) => tick.includes("|"))).toBe(true);
  });
});

describe("M07 plain words", () => {
  it("says what a tab's ticks come to", () => {
    const none = { View: false, Create: false, Edit: false, Approve: false, Export: false, Delete: false };
    expect(plainWords({ ...none, View: true, Edit: true })).toBe("Can see it and change what is there. Cannot add, approve, export and delete.");
    expect(plainWords(none)).toContain("absent");
  });
});

describe("M07 Activity", () => {
  it("shows what each person has done against what they were given", () => {
    const data: Activity = {
      term: { name: "First Term", day: 30 },
      totals: { staff: 1, registerPct: 80, sheetsOutstanding: 2, teachersWithSheets: 1, remarksOutstanding: 4, formMastersNotStarted: 1 },
      rows: [
        {
          id: "sp-1",
          userId: "u-1",
          name: "Boma Hart",
          role: "Form Master",
          department: "Sciences",
          isYou: false,
          registers: { marked: 24, of: 30 },
          sheets: { total: 4, submitted: 2, returned: 1, inProgress: 1 },
          remarks: { written: 0, of: 30 },
          approvals: null,
          messages: 0,
          lastLoginAt: null,
          account: "Never activated",
        },
      ],
    };
    const html = markup(activityTab(data));
    expect(html).toContain("24 / 30");
    expect(html).toContain("2 of 4 submitted");
    expect(html).toContain("1 form master not started");
  });
});

