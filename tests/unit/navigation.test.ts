import { canAccessPath, canManagePath, normalizeRole } from "@/lib/auth/roles";
import { getVisibleWorkflowNavGroups } from "@/lib/navigation/workflows";

describe("role-aware navigation and route access", () => {
  it("normalizes legacy lowercase role slugs used by old sessions", () => {
    expect(normalizeRole("super_admin")).toBe("SUPER_ADMIN");
    expect(normalizeRole("vice-principal-academics")).toBe("VICE_PRINCIPAL_ACADEMICS");
    expect(normalizeRole("exam officer")).toBe("EXAM_OFFICER");
    expect(normalizeRole("unknown_role")).toBeNull();
  });

  it("keeps personal portals exact to their own role", () => {
    expect(canAccessPath("STUDENT", "/portals/student")).toBe(true);
    expect(canAccessPath("PARENT", "/portals/parent/children")).toBe(true);
    expect(canAccessPath("TEACHER", "/portals/teacher/scores")).toBe(true);

    expect(canAccessPath("PRINCIPAL", "/portals/teacher")).toBe(false);
    expect(canAccessPath("SUPER_ADMIN", "/portals/parent")).toBe(false);
    expect(canAccessPath("PARENT", "/portals/student")).toBe(false);
  });

  it("filters sidebar items by exact route permissions", () => {
    const studentLabels = getVisibleWorkflowNavGroups("STUDENT").flatMap((group) =>
      group.items.map((item) => item.label)
    );
    expect(studentLabels).toEqual([
      "Dashboard",
      "My Profile",
      "Attendance",
      "Results",
      "Scheme of Work",
      "Timetable",
      "Assignments",
      "Fees",
      "Services",
      "Announcements",
      "Notifications"
    ]);

    const principalLabels = getVisibleWorkflowNavGroups("PRINCIPAL").flatMap((group) =>
      group.items.map((item) => item.label)
    );
    expect(principalLabels).toEqual(expect.arrayContaining(["Scheme of Work", "Staff Attendance", "Teacher Training", "Welfare & Discipline", "Lesson Plans & Questions"]));
    expect(principalLabels).not.toContain("Attendance");
    expect(principalLabels).not.toContain("Profiles");
    expect(principalLabels).not.toContain("Teachers");

    const bursarLabels = getVisibleWorkflowNavGroups("ACCOUNTANT").flatMap((group) =>
      group.items.map((item) => item.label)
    );
    expect(bursarLabels).toContain("Fees & Payments");
    expect(bursarLabels).not.toContain("Results & Exams");
    expect(bursarLabels).not.toContain("Teacher Training");
    expect(bursarLabels).not.toContain("Student Portal");
  });

  it("keeps exam officer navigation focused on exam operations without final approval routes", () => {
    const examOfficerLabels = getVisibleWorkflowNavGroups("EXAM_OFFICER").flatMap((group) =>
      group.items.map((item) => item.label)
    );

    expect(examOfficerLabels).toEqual(expect.arrayContaining(["Students", "Assessments & Exams", "Results & Broadsheets", "Lesson Plans & Questions", "Exam Logistics", "Welfare & Discipline", "Reports", "My Permissions"]));
    expect(examOfficerLabels).not.toContain("Settings");
    expect(canAccessPath("EXAM_OFFICER", "/students")).toBe(true);
    expect(canAccessPath("EXAM_OFFICER", "/academics/results")).toBe(true);
    expect(canAccessPath("EXAM_OFFICER", "/academics/results/assessments")).toBe(true);
    expect(canAccessPath("EXAM_OFFICER", "/academics/results/broadsheets")).toBe(true);
    expect(canAccessPath("EXAM_OFFICER", "/academics/results/analytics")).toBe(true);
    expect(canAccessPath("EXAM_OFFICER", "/operations/academics")).toBe(true);
    expect(canAccessPath("EXAM_OFFICER", "/operations/exams")).toBe(true);
    expect(canAccessPath("EXAM_OFFICER", "/operations/welfare")).toBe(true);
    expect(canAccessPath("EXAM_OFFICER", "/academics/results/publish")).toBe(false);
    expect(canAccessPath("EXAM_OFFICER", "/academics/results/approvals")).toBe(false);
    expect(canAccessPath("EXAM_OFFICER", "/academics/results/settings")).toBe(false);
    expect(canAccessPath("EXAM_OFFICER", "/academics/subjects")).toBe(false);
  });

  it("allows intended Nigerian admin roles to access the admin dashboard", () => {
    expect(canAccessPath("SUPER_ADMIN", "/dashboard")).toBe(false);
    expect(canAccessPath("SUPER_ADMIN", "/super-admin")).toBe(true);
    expect(canAccessPath("ADMINISTRATOR", "/dashboard")).toBe(true);
    expect(canAccessPath("PRINCIPAL", "/dashboard")).toBe(true);
    expect(canAccessPath("HEAD_TEACHER", "/dashboard")).toBe(true);
    expect(canAccessPath("VICE_PRINCIPAL_ACADEMICS", "/dashboard")).toBe(true);
    expect(canAccessPath("EXAM_OFFICER", "/dashboard")).toBe(true);

    expect(canAccessPath("TEACHER", "/dashboard")).toBe(true);
    expect(canAccessPath("PARENT", "/dashboard")).toBe(false);
    expect(canAccessPath("STUDENT", "/dashboard")).toBe(false);
  });

  it("keeps Nigerian operations pages permission-aware", () => {
    expect(canAccessPath("PRINCIPAL", "/academics/curriculum")).toBe(true);
    expect(canAccessPath("ADMIN_OFFICER", "/teachers/attendance")).toBe(true);
    expect(canAccessPath("TEACHER", "/portals/teacher/staff-attendance")).toBe(true);
    expect(canAccessPath("TEACHER", "/portals/teacher/curriculum")).toBe(true);
    expect(canAccessPath("PARENT", "/portals/parent/curriculum")).toBe(true);
    expect(canAccessPath("STUDENT", "/portals/student/curriculum")).toBe(true);

    expect(canAccessPath("ACCOUNTANT", "/teachers/training")).toBe(false);
    expect(canAccessPath("STUDENT", "/academics/curriculum")).toBe(false);
    expect(canAccessPath("PARENT", "/teachers/attendance")).toBe(false);
  });

  it("routes real-school operations to operational staff without exposing parent/student portals", () => {
    expect(canAccessPath("PRINCIPAL", "/operations/welfare")).toBe(true);
    expect(canAccessPath("VICE_PRINCIPAL_ADMINISTRATION", "/operations/assets")).toBe(true);
    expect(canAccessPath("RECEPTIONIST", "/operations/front-desk")).toBe(true);
    expect(canAccessPath("NURSE", "/operations/welfare")).toBe(true);

    expect(canAccessPath("PARENT", "/operations/front-desk")).toBe(false);
    expect(canAccessPath("STUDENT", "/operations/welfare")).toBe(false);
  });

  it("keeps finance mutations away from oversight-only users", () => {
    expect(canAccessPath("PRINCIPAL", "/finance")).toBe(true);
    expect(canManagePath("PRINCIPAL", "/finance")).toBe(false);
    expect(canManagePath("ACCOUNTANT", "/finance/payments")).toBe(true);
    expect(canManagePath("BURSAR", "/finance/payments")).toBe(true);
  });

  it("hides roles navigation unless the resolved permission set includes roles.view", () => {
    const withoutRolesPermission = getVisibleWorkflowNavGroups("PRINCIPAL", ["students.view"]).flatMap((group) =>
      group.items.map((item) => item.label)
    );
    const withRolesPermission = getVisibleWorkflowNavGroups("PRINCIPAL", ["roles.view"]).flatMap((group) =>
      group.items.map((item) => item.label)
    );

    expect(withoutRolesPermission).not.toContain("Roles & Permissions");
    expect(withRolesPermission).toContain("Roles & Permissions");
  });

  it("shows permission-backed school modules for staff roles that also have a personal portal", () => {
    const labels = getVisibleWorkflowNavGroups("CLASS_TEACHER", [
      "students.view",
      "classes.view",
      "attendance.view",
      "timetable.view",
      "results.view",
      "profiles.view",
      "staff.view",
      "roles.view",
    ]).flatMap((group) => group.items.map((item) => item.label));

    expect(labels).toEqual(expect.arrayContaining([
      "Dashboard",
      "Students",
      "Classes",
      "Timetable",
      "Results & Broadsheets",
      "Staff",
      "Roles & Permissions",
      "My Classes",
    ]));
    expect(labels).not.toContain("Attendance");
    expect(labels).not.toContain("Profiles");
    expect(labels).not.toContain("Teachers");
    expect(labels).not.toContain("Student Portal");
    expect(labels).not.toContain("Parent Portal");
  });
});
