import { canAccessPath, canManagePath } from "@/lib/auth/roles";
import { getVisibleWorkflowNavGroups } from "@/lib/navigation/workflows";

describe("role-aware navigation and route access", () => {
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
    expect(studentLabels).toEqual(["Communication", "Student Portal"]);

    const principalLabels = getVisibleWorkflowNavGroups("PRINCIPAL").flatMap((group) =>
      group.items.map((item) => item.label)
    );
    expect(principalLabels).toEqual(expect.arrayContaining(["Scheme of Work", "Staff Attendance", "Teacher Training"]));

    const bursarLabels = getVisibleWorkflowNavGroups("ACCOUNTANT").flatMap((group) =>
      group.items.map((item) => item.label)
    );
    expect(bursarLabels).toContain("Fees & Payments");
    expect(bursarLabels).not.toContain("Results & Exams");
    expect(bursarLabels).not.toContain("Teacher Training");
    expect(bursarLabels).not.toContain("Student Portal");
  });

  it("keeps Nigerian operations pages permission-aware", () => {
    expect(canAccessPath("PRINCIPAL", "/academics/curriculum")).toBe(true);
    expect(canAccessPath("ADMIN_OFFICER", "/teachers/attendance")).toBe(true);
    expect(canAccessPath("TEACHER", "/portals/teacher/staff-attendance")).toBe(true);
    expect(canAccessPath("PARENT", "/portals/parent/curriculum")).toBe(true);
    expect(canAccessPath("STUDENT", "/portals/student/curriculum")).toBe(true);

    expect(canAccessPath("ACCOUNTANT", "/teachers/training")).toBe(false);
    expect(canAccessPath("STUDENT", "/academics/curriculum")).toBe(false);
    expect(canAccessPath("PARENT", "/teachers/attendance")).toBe(false);
  });

  it("keeps finance mutations away from oversight-only users", () => {
    expect(canAccessPath("PRINCIPAL", "/finance")).toBe(true);
    expect(canManagePath("PRINCIPAL", "/finance")).toBe(false);
    expect(canManagePath("ACCOUNTANT", "/finance/payments")).toBe(true);
  });
});
