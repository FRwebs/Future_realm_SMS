import { schoolPermissionKey, schoolPermissionKeysForRoleTemplate, templateTabActions, templateTabSlugs } from "@/lib/modules/school-modules";
import { defaultTeacherTabs, isTeachingRole, orderTeacherTabs, personaTemplate, teacherNavigation, teacherModuleLabel } from "@/lib/modules/teacher-workspace";

describe("the teaching workspace", () => {
  it("opens for teaching roles and nobody else", () => {
    for (const role of ["TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER", "HEAD_OF_DEPARTMENT"]) expect(isTeachingRole(role)).toBe(true);
    for (const role of ["PRINCIPAL", "SCHOOL_OWNER", "BURSAR", "PARENT"]) expect(isTeachingRole(role)).toBe(false);
  });

  it("gives each persona the modules the teacher mockup names, and nothing it does not", () => {
    const rail = (persona: keyof typeof personaTemplate) =>
      teacherNavigation(persona, schoolPermissionKeysForRoleTemplate(personaTemplate[persona])).items.map((item) => item.code);
    expect(rail("form-master")).toEqual(["m1", "m3", "m17", "m8", "m4", "m5", "m6", "m9", "m12", "m19", "m18", "m2", "m16"]);
    expect(rail("subject-teacher")).toEqual(["m1", "m3", "m17", "m4", "m5", "m19", "m18", "m2", "m16"]);
    expect(rail("head-of-department")).toContain("m13");
    expect(rail("teaching-assistant")).toEqual(["m1", "m3", "m4", "m19", "m18", "m2", "m16"]);
    // A cover teacher reads notes and has no employment module.
    expect(rail("cover")).not.toContain("m18");
    expect(rail("cover")).toContain("m17");
  });

  it("calls the scores module Observations for an early-years teacher", () => {
    expect(teacherModuleLabel("m5", "early-years")).toBe("Observations");
    expect(teacherModuleLabel("m5", "form-master")).toBe("Scores");
  });

  it("shows a module an administrator has granted beyond the defaults, after a divider, and never a module that is off", () => {
    const base = schoolPermissionKeysForRoleTemplate("Subject Teacher");
    expect(teacherNavigation("subject-teacher", base).extra).toEqual([]);
    const granted = [...base, schoolPermissionKey("fee-management", "collections", "View")];
    const view = teacherNavigation("subject-teacher", granted);
    expect(view.extra.map((item) => item.code)).toEqual(["m10"]);
    expect(view.items.map((item) => item.code)).not.toContain("m10");
  });

  it("orders a module's tabs the way the teacher meets them, then whatever an administrator added", () => {
    expect(orderTeacherTabs("m5", ["results", "enter", "review"])).toEqual(["enter", "review", "results"]);
    expect(orderTeacherTabs("m4", ["register", "extra", "mark"])).toEqual(["mark", "register", "extra"]);
    expect(defaultTeacherTabs("m17", "subject-teacher")).toEqual(["curriculum", "notes"]);
    expect(defaultTeacherTabs("m17", "head-of-department")).toEqual(["curriculum", "notes", "review", "coverage"]);
  });

  it("lets a teacher only read the tabs it does not work in", () => {
    const actions = { View: true, Create: true, Edit: true, Approve: true, Export: true, Delete: true };
    expect(templateTabActions("Form Master", "m6", "remarks", actions).Create).toBe(true);
    expect(templateTabActions("Form Master", "m6", "completion", actions)).toMatchObject({ View: true, Create: false, Edit: false, Approve: false });
    expect(templateTabSlugs("Subject Teacher", "m6")).toBeNull();
  });

  it("keeps leadership out of a teacher's own curriculum, and in the notes they must sign", () => {
    expect(templateTabSlugs("Principal", "m17")).toEqual(["review", "coverage"]);
    const keys = new Set(schoolPermissionKeysForRoleTemplate("Principal"));
    expect(keys.has(schoolPermissionKey("lesson-notes", "review", "Approve"))).toBe(true);
    expect(keys.has(schoolPermissionKey("lesson-notes", "curriculum", "View"))).toBe(false);
  });
});
