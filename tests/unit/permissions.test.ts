import {
  allGrantablePermissionKeys,
  allPermissionKeys,
  groupPermissions,
  permissionCatalog,
  permissionModules,
  schoolModulePermissionKeys,
  systemRolePermissionKeys,
} from "@/lib/permissions/catalog";
import {
  schoolPermissionKeysForRoleTemplate,
  schoolRoleTemplates,
} from "@/lib/modules/school-modules";

describe("school role and permission catalog", () => {
  it("contains unique permission keys for every seeded permission", () => {
    expect(new Set(allPermissionKeys).size).toBe(allPermissionKeys.length);
    expect(permissionCatalog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "students.view", module: "Students" }),
        expect.objectContaining({ key: "fees.collect", module: "Fees" }),
        expect.objectContaining({ key: "results.publish", module: "Results & Grades" }),
        expect.objectContaining({ key: "roles.assign", module: "Roles & Permissions" }),
        expect.objectContaining({ key: "discipline.create", module: "Discipline" }),
        expect.objectContaining({ key: "lesson_plans.approve", module: "Lesson Plans" }),
        expect.objectContaining({ key: "visitors.create", module: "Visitors" }),
      ])
    );
  });

  it("groups resolved permissions by module without leaking unassigned permissions", () => {
    const grouped = groupPermissions(["students.view", "fees.collect", "roles.assign"]);
    const visible = grouped.filter((group) => group.permissions.length > 0);

    expect(visible.map((group) => group.module)).toEqual(["Students", "Fees", "Roles & Permissions"]);
    expect(visible.flatMap((group) => group.permissions.map((permission) => permission.key))).toEqual([
      "students.view",
      "fees.collect",
      "roles.assign",
    ]);
  });

  it("seeds system roles with safe default permission boundaries", () => {
    expect(systemRolePermissionKeys.SCHOOL_OWNER).toEqual(allPermissionKeys);
    expect(systemRolePermissionKeys.PRINCIPAL).toContain("roles.assign");
    expect(systemRolePermissionKeys.PRINCIPAL).not.toContain("settings.school_profile");
    expect(systemRolePermissionKeys.VICE_PRINCIPAL_ADMINISTRATION).toEqual(expect.arrayContaining(["staff_leave.approve", "discipline.approve", "facilities.create"]));
    expect(systemRolePermissionKeys.EXAM_OFFICER).toEqual(expect.arrayContaining(["exams.view", "exam_timetable.view", "seating_plan.view", "invigilation.view", "external_exams.view", "results.compile", "results.publish", "results.approve", "students.view", "question_bank.view", "question_bank.create", "question_bank.edit", "question_bank.delete", "reports.view", "discipline.view", "classes.view", "subjects.view"]));
    expect(systemRolePermissionKeys.ACCOUNTANT).toEqual(expect.arrayContaining(["fees.view", "fees.collect", "fees.waive", "expenses.create"]));
    expect(systemRolePermissionKeys.STUDENT).toEqual(expect.arrayContaining(["results.view", "assignments.submit", "report_cards.download"]));
  });

  it("keeps module definitions aligned with the flattened catalog", () => {
    const modulePermissionCount = permissionModules.reduce((total, module) => total + module.permissions.length, 0);
    expect(permissionCatalog).toHaveLength(modulePermissionCount);
  });
});

describe("the module grid as grantable permissions", () => {
  it("accepts every key the sixteen-module grid can grant", () => {
    // The backend validates a custom role's permissions against this list. Every
    // key a role template can hold has to be in it, or the role is refused.
    const grantable = new Set(allGrantablePermissionKeys);
    for (const template of schoolRoleTemplates) {
      for (const key of schoolPermissionKeysForRoleTemplate(template.name)) {
        expect(grantable.has(key), `${template.name} · ${key}`).toBe(true);
      }
    }
  });

  it("keeps the module keys out of the legacy list the role builders read", () => {
    // `attendance.view` is a legacy key and `attendance.register.view` is a
    // module one, so merging the two lists would silently hand every role built
    // from keysFor("attendance") the whole module.
    const moduleKeys = new Set(schoolModulePermissionKeys);
    expect(allPermissionKeys.some((key) => moduleKeys.has(key))).toBe(false);

    for (const [role, keys] of Object.entries(systemRolePermissionKeys)) {
      const gained = (keys ?? []).filter((key) => moduleKeys.has(key));
      expect(gained, `${role} must not hold a module key by default`).toEqual([]);
    }
  });

  it("groups a module key under its own module", () => {
    const grouped = groupPermissions(["attendance.register.view", "students.view"])
      .filter((group) => group.permissions.length)
      .map((group) => group.module);
    expect(grouped).toContain("Attendance");
    expect(grouped).toContain("Students");
  });
});
