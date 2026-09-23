import {
  allSchoolPermissionKeys,
  getSchoolModule,
  getSchoolModuleTab,
  schoolModuleActions,
  schoolModuleActionsFor,
  schoolModuleLevel,
  schoolModulePath,
  schoolModuleSections,
  schoolModules,
  schoolPermissionKey,
  schoolPermissionKeysForRoleTemplate,
  schoolRoleTemplates,
  schoolTemplateReach,
} from "@/lib/modules/school-modules";

describe("school admin module spec", () => {
  it("defines the sixteen modules across seven sections, as the mockup does", () => {
    expect(schoolModules).toHaveLength(16);
    expect(schoolModuleSections).toHaveLength(7);
    expect(schoolModules.map((module) => module.code)).toEqual(
      Array.from({ length: 16 }, (_, index) => `m${index + 1}`),
    );

    for (const module of schoolModules) {
      expect(schoolModuleSections).toContain(module.section);
      expect(module.tabs.length).toBeGreaterThan(0);
    }
  });

  it("keeps module and tab slugs unique so routes cannot collide", () => {
    const slugs = schoolModules.map((module) => module.slug);
    expect(new Set(slugs).size).toBe(slugs.length);

    for (const module of schoolModules) {
      const tabSlugs = module.tabs.map((tab) => tab.slug);
      expect(new Set(tabSlugs).size).toBe(tabSlugs.length);
    }
  });

  it("resolves modules and tabs by slug, defaulting to the first tab", () => {
    const attendance = getSchoolModule("attendance");
    expect(attendance?.name).toBe("Attendance");
    expect(attendance?.tabs.map((tab) => tab.label)).toEqual([
      "Register",
      "Mark",
      "Compliance",
      "Log",
    ]);

    expect(getSchoolModuleTab(attendance!)?.slug).toBe("register");
    expect(getSchoolModuleTab(attendance!, "compliance")?.label).toBe("Compliance");
    expect(getSchoolModuleTab(attendance!, "not-a-tab")).toBeUndefined();
    expect(schoolModulePath(attendance!)).toBe("/attendance/register");
    expect(getSchoolModule("clinic-queue")).toBeUndefined();
  });

  it("derives one permission key per module, tab and action", () => {
    const tabCount = schoolModules.reduce((total, module) => total + module.tabs.length, 0);
    const keys = allSchoolPermissionKeys();

    expect(keys).toHaveLength(tabCount * schoolModuleActions.length);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("attendance.register.view");
    expect(schoolPermissionKey("fee-management", "collections", "Approve")).toBe(
      "fee-management.collections.approve",
    );
  });

  it("treats an unlisted module as full access, which is how Proprietor is expressed", () => {
    expect(schoolModuleLevel("Proprietor", "m10")).toBe(3);
    expect(schoolTemplateReach("Proprietor")).toBe(16);
    expect(schoolPermissionKeysForRoleTemplate("Proprietor")).toHaveLength(
      allSchoolPermissionKeys().length,
    );
  });

  it("never implies approval or deletion from a full access level", () => {
    // Registrar holds m8 at full, but only approves record changes — never deletes.
    const registrar = schoolModuleActionsFor("Registrar", "m8");
    expect(registrar.Edit).toBe(true);
    expect(registrar.Approve).toBe(true);
    expect(registrar.Delete).toBe(false);

    // Head of Department holds m5 at full, yet deletion stays with the leadership.
    expect(schoolModuleActionsFor("Head of Department", "m5").Delete).toBe(false);
    expect(schoolModuleActionsFor("Principal", "m5").Delete).toBe(true);
  });

  it("gates export on the roles the mockup names, not on access level", () => {
    // Form Master reaches attendance at full, and still cannot export.
    expect(schoolModuleLevel("Form Master", "m4")).toBe(3);
    expect(schoolModuleActionsFor("Form Master", "m4").Export).toBe(false);

    expect(schoolModuleActionsFor("Bursar", "m10").Export).toBe(true);
    expect(schoolModuleActionsFor("Exam Officer", "m5").Export).toBe(true);
  });

  it("grants nothing at all in a module a template is locked out of", () => {
    expect(schoolModuleLevel("Subject Teacher", "m10")).toBe(0);

    const actions = schoolModuleActionsFor("Subject Teacher", "m10");
    for (const action of schoolModuleActions) {
      expect(actions[action]).toBe(false);
    }
  });

  it("gives every role template a coherent, non-empty reach", () => {
    expect(schoolRoleTemplates).toHaveLength(11);

    for (const template of schoolRoleTemplates) {
      const reach = schoolTemplateReach(template.name);
      expect(reach).toBeGreaterThan(0);
      expect(reach).toBeLessThanOrEqual(16);
      expect(schoolPermissionKeysForRoleTemplate(template.name).length).toBeGreaterThan(0);
    }

    // The teaching roles stay narrower than the leadership ones.
    expect(schoolTemplateReach("Subject Teacher")).toBeLessThan(schoolTemplateReach("Principal"));
    expect(schoolTemplateReach("ICT Officer")).toBeLessThan(schoolTemplateReach("Registrar"));
  });
});
