import { canAccessPath, canManagePath, normalizeRole } from "@/lib/auth/roles";
import { getVisibleWorkflowNavGroups } from "@/lib/navigation/workflows";

describe("role-aware navigation and route access", () => {
  it("normalizes legacy lowercase role slugs used by old sessions", () => {
    expect(normalizeRole("super_admin")).toBe("SUPER_ADMIN");
    expect(normalizeRole("vice-principal-academics")).toBe("VICE_PRINCIPAL_ACADEMICS");
    expect(normalizeRole("exam officer")).toBe("EXAM_OFFICER");
    expect(normalizeRole("guidance counsellor")).toBe("GUIDANCE_COUNSELLOR");
    expect(normalizeRole("unknown_role")).toBeNull();
  });

  it("keeps personal portals exact to their own role", () => {
    expect(canAccessPath("STUDENT", "/portals/student")).toBe(true);
    expect(canAccessPath("PARENT", "/portals/parent/children")).toBe(true);
    expect(canAccessPath("TEACHER", "/portals/teacher/scores")).toBe(true);
    expect(canAccessPath("TEACHER", "/portals/teacher/timetable")).toBe(true);
    expect(canAccessPath("TEACHER", "/dashboard")).toBe(false);
    expect(canAccessPath("TEACHER", "/timetable")).toBe(false);

    expect(canAccessPath("PRINCIPAL", "/portals/teacher")).toBe(false);
    expect(canAccessPath("NURSE", "/portals/nurse")).toBe(true);
    expect(canAccessPath("LIBRARIAN", "/portals/librarian")).toBe(true);
    expect(canAccessPath("RECEPTIONIST", "/portals/front-desk")).toBe(true);
    expect(canAccessPath("HOSTEL_MANAGER", "/portals/hostel")).toBe(true);
    expect(canAccessPath("TRANSPORT_MANAGER", "/portals/transport")).toBe(true);
    expect(canAccessPath("TEACHER", "/portals/nurse")).toBe(false);
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
      "My Subjects",
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
    expect(principalLabels).toEqual(
      expect.arrayContaining([
        "Executive Dashboard",
        "Pending Approvals",
        "Academic Performance",
        "Staff Management",
        "Announcements",
        "School Analytics",
        "School Settings",
      ]),
    );
    expect(principalLabels).not.toContain("Student Portal");
    expect(principalLabels).not.toContain("Parent Portal");
    expect(principalLabels).not.toContain("Teacher Portal");

    const bursarLabels = getVisibleWorkflowNavGroups("ACCOUNTANT").flatMap((group) =>
      group.items.map((item) => item.label)
    );
    expect(bursarLabels).toEqual(
      expect.arrayContaining([
        "Bursary Dashboard",
        "Fee Structures",
        "Payments & Receipts",
        "Discounts & Plans",
        "Staff Payroll",
        "Expenditure",
        "Finance Reports",
        "Audit Log",
        "Finance Settings"
      ])
    );
    expect(bursarLabels).not.toContain("Results & Exams");
    expect(bursarLabels).not.toContain("Teacher Training");
    expect(bursarLabels).not.toContain("Student Portal");
    expect(bursarLabels).not.toContain("Students");
  });

  it("keeps exam officer navigation focused on exam operations without finance or HR routes", () => {
    const examOfficerLabels = getVisibleWorkflowNavGroups("EXAM_OFFICER").flatMap((group) =>
      group.items.map((item) => item.label)
    );

    expect(examOfficerLabels).toEqual(
      expect.arrayContaining([
        "Dashboard",
        "All Exams",
        "Score Entry Status",
        "Exam Timetable",
        "Publication Control",
        "Question Bank",
      ])
    );
    expect(examOfficerLabels).not.toContain("Settings");
    expect(examOfficerLabels).not.toContain("Students");
    expect(examOfficerLabels).not.toContain("Finance Reports");
    expect(canAccessPath("EXAM_OFFICER", "/students")).toBe(false);
    expect(canAccessPath("EXAM_OFFICER", "/academics/results")).toBe(false);
    expect(canAccessPath("EXAM_OFFICER", "/academics/results/assessments")).toBe(false);
    expect(canAccessPath("EXAM_OFFICER", "/academics/results/broadsheets")).toBe(true);
    expect(canAccessPath("EXAM_OFFICER", "/academics/results/analytics")).toBe(true);
    expect(canAccessPath("EXAM_OFFICER", "/operations/academics")).toBe(false);
    expect(canAccessPath("EXAM_OFFICER", "/operations/exams")).toBe(false);
    expect(canAccessPath("EXAM_OFFICER", "/operations/welfare")).toBe(false);
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

    expect(canAccessPath("TEACHER", "/dashboard")).toBe(false);
    expect(canAccessPath("PARENT", "/dashboard")).toBe(false);
    expect(canAccessPath("STUDENT", "/dashboard")).toBe(false);
  });

  it("keeps Nigerian operations pages permission-aware", () => {
    expect(canAccessPath("PRINCIPAL", "/academics/curriculum")).toBe(true);
    expect(canAccessPath("ADMIN_OFFICER", "/teachers/attendance")).toBe(true);
    expect(canAccessPath("TEACHER", "/portals/teacher/staff-attendance")).toBe(true);
    expect(canAccessPath("TEACHER", "/portals/teacher/curriculum")).toBe(true);
    expect(canAccessPath("TEACHER", "/portals/teacher/content")).toBe(true);
    expect(canAccessPath("TEACHER", "/portals/teacher/content/lesson-notes/planning")).toBe(true);
    expect(canAccessPath("TEACHER", "/portals/teacher/content/scheme-of-work/approvals")).toBe(true);
    expect(canAccessPath("PARENT", "/portals/parent/curriculum")).toBe(true);
    expect(canAccessPath("STUDENT", "/portals/student/curriculum")).toBe(true);

    expect(canAccessPath("ACCOUNTANT", "/teachers/training")).toBe(false);
    expect(canAccessPath("STUDENT", "/academics/curriculum")).toBe(false);
    expect(canAccessPath("TEACHER", "/academics/curriculum")).toBe(false);
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

  it("keeps support-service portals scoped to their owning roles", () => {
    const nurseLabels = getVisibleWorkflowNavGroups("NURSE").flatMap((group) =>
      group.items.map((item) => item.label)
    );
    expect(nurseLabels).toEqual(expect.arrayContaining([
      "Dashboard",
      "Clinic Queue",
      "Log Visit",
      "Inventory",
      "Health Summary",
    ]));
    expect(nurseLabels).not.toContain("Students");
    expect(nurseLabels).not.toContain("Teacher Portal");

    const librarianLabels = getVisibleWorkflowNavGroups("LIBRARIAN").flatMap((group) =>
      group.items.map((item) => item.label)
    );
    expect(librarianLabels).toEqual(expect.arrayContaining([
      "Dashboard",
      "Issue Book",
      "Return Book",
      "All Books",
      "All Members",
    ]));

    const receptionistLabels = getVisibleWorkflowNavGroups("RECEPTIONIST").flatMap((group) =>
      group.items.map((item) => item.label)
    );
    expect(receptionistLabels).toEqual(expect.arrayContaining([
      "Dashboard",
      "Check In Visitor",
      "Active Visitors",
      "Room Availability",
      "Call Log",
    ]));
  });

  it("keeps finance mutations away from oversight-only users", () => {
    expect(canAccessPath("PRINCIPAL", "/finance")).toBe(true);
    expect(canManagePath("PRINCIPAL", "/finance")).toBe(false);
    expect(canManagePath("ACCOUNTANT", "/finance/payments")).toBe(true);
    expect(canManagePath("BURSAR", "/finance/payments")).toBe(true);
    expect(canAccessPath("ACCOUNTANT", "/students")).toBe(false);
    expect(canAccessPath("ACCOUNTANT", "/communications")).toBe(false);
    expect(canAccessPath("ACCOUNTANT", "/school/staff")).toBe(false);
    expect(canAccessPath("ACCOUNTANT", "/academics/results")).toBe(false);
    expect(canAccessPath("ACCOUNTANT", "/finance/audit")).toBe(true);
    expect(canAccessPath("ACCOUNTANT", "/finance/payroll")).toBe(true);
  });

  it("hides roles navigation unless the resolved permission set includes roles.view", () => {
    const withoutRolesPermission = getVisibleWorkflowNavGroups("PRINCIPAL", ["students.view"]).flatMap((group) =>
      group.items.map((item) => item.label)
    );
    const withRolesPermission = getVisibleWorkflowNavGroups("PRINCIPAL", ["roles.view"]).flatMap((group) =>
      group.items.map((item) => item.label)
    );

    expect(withoutRolesPermission).not.toContain("Roles & Permissions");
    expect(withRolesPermission).not.toContain("Roles & Permissions");
  });

  it("keeps teacher-facing navigation compact and portal-scoped for class teachers", () => {
    const labels = getVisibleWorkflowNavGroups("CLASS_TEACHER", [
      "students.view",
      "classes.view",
      "attendance.view",
      "timetable.view",
      "results.view",
      "results.create",
      "profiles.view",
      "staff.view",
      "roles.view",
      "sow.view_own",
    ]).flatMap((group) => group.items.map((item) => item.label));

    expect(labels).toEqual(expect.arrayContaining([
      "Dashboard",
      "Timetable",
      "My Classes",
      "Mark Attendance",
      "Attendance History",
      "Attendance Reports",
      "Gradebook",
      "Lesson Notes",
      "Scheme of Work",
    ]));
    expect(labels).not.toContain("My Subjects");
    expect(labels).not.toContain("Students");
    expect(labels).not.toContain("Classes");
    expect(labels).not.toContain("Broadsheet");
    expect(labels).not.toContain("Assessment Format");
    expect(labels).not.toContain("Roles & Permissions");
  });
});
