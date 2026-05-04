import {
  allPermissionKeys,
  groupPermissions,
  permissionCatalog,
  permissionModules,
  systemRolePermissionKeys,
} from "@/lib/permissions/catalog";

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
