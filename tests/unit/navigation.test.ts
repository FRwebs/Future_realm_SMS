import { canAccessPath, normalizeRole, getDefaultPathForRole } from "@/lib/auth/roles";
import { getVisibleWorkflowNavGroups } from "@/lib/navigation/workflows";
import { schoolModuleSections, schoolModules } from "@/lib/modules/school-modules";

function labelsFor(role: Parameters<typeof getVisibleWorkflowNavGroups>[0]) {
  return getVisibleWorkflowNavGroups(role).flatMap((group) => group.items.map((item) => item.label));
}

function sectionsFor(role: Parameters<typeof getVisibleWorkflowNavGroups>[0]) {
  return getVisibleWorkflowNavGroups(role).map((group) => group.title);
}

describe("role-aware navigation and route access", () => {
  it("normalizes legacy lowercase role slugs used by old sessions", () => {
    expect(normalizeRole("super_admin")).toBe("SUPER_ADMIN");
    expect(normalizeRole("vice-principal-academics")).toBe("VICE_PRINCIPAL_ACADEMICS");
    expect(normalizeRole("exam officer")).toBe("EXAMINATION_OFFICER");
    expect(normalizeRole("guidance counsellor")).toBe("GUIDANCE_COUNSELOR");
    expect(normalizeRole("proprietor")).toBe("SCHOOL_OWNER");
    expect(normalizeRole("unknown_role")).toBeNull();
  });

  it("gives the proprietor every module, in the mockup's seven sections", () => {
    expect(sectionsFor("SCHOOL_OWNER")).toEqual(schoolModuleSections);
    expect(labelsFor("SCHOOL_OWNER")).toEqual(schoolModules.map((module) => module.name));
  });

  it("puts every staff role in the same shell rather than a portal of its own", () => {
    for (const role of ["PRINCIPAL", "EXAM_OFFICER", "BURSAR", "SUBJECT_TEACHER", "SCHOOL_NURSE"] as const) {
      const labels = labelsFor(role);

      expect(labels).toContain("Command Center");
      expect(labels).toContain("Sync & Support");
      // Nothing outside the sixteen modules reaches a staff sidebar.
      for (const label of labels) {
        expect(schoolModules.map((module) => module.name)).toContain(label);
      }
    }
  });

  it("scopes each staff role to the modules its template grants", () => {
    // The bursar works in money and the people money is owed for — never in scores.
    const bursar = labelsFor("BURSAR");
    expect(bursar).toContain("Fee Management");
    expect(bursar).toContain("Subscription & Billing");
    expect(bursar).not.toContain("Score Entry & Results");
    expect(bursar).not.toContain("Staff & Access");

    // The exam officer is the mirror image.
    const examOfficer = labelsFor("EXAM_OFFICER");
    expect(examOfficer).toContain("Score Entry & Results");
    expect(examOfficer).toContain("Report Cards");
    expect(examOfficer).not.toContain("Fee Management");
    expect(examOfficer).not.toContain("Staff & Access");

    // A subject teacher sees the narrowest slice of all.
    const subjectTeacher = labelsFor("SUBJECT_TEACHER");
    expect(subjectTeacher).toContain("Attendance");
    expect(subjectTeacher).not.toContain("Student Records");
    expect(subjectTeacher).not.toContain("Approvals & Workflow");
    expect(subjectTeacher.length).toBeLessThan(bursar.length);
  });

  it("gives staff the mockup does not template only the universal floor", () => {
    // Librarian, receptionist and the rest are staff with no role template:
    // every template reaches Command Center and Sync & Support, so that is the floor.
    for (const role of ["LIBRARIAN", "RECEPTIONIST", "HOSTEL_MANAGER", "TRANSPORT_MANAGER"] as const) {
      expect(labelsFor(role)).toEqual(["Command Center", "Sync & Support"]);
    }
  });

  it("keeps a module a role cannot reach out of its navigation entirely", () => {
    // Absent, never shown-and-greyed: the mockup is explicit that greying a
    // module out only teaches people to ask for it.
    expect(labelsFor("SUBJECT_TEACHER")).not.toContain("Fee Management");
    expect(canAccessPath("SUBJECT_TEACHER", "/fee-management/collections")).toBe(false);
    expect(canAccessPath("BURSAR", "/fee-management/collections")).toBe(true);
  });

  it("keeps personal portals exact to their own role", () => {
    expect(canAccessPath("STUDENT", "/portals/student")).toBe(true);
    expect(canAccessPath("PARENT", "/portals/parent/children")).toBe(true);

    expect(canAccessPath("PARENT", "/portals/student")).toBe(false);
    expect(canAccessPath("STUDENT", "/portals/parent")).toBe(false);
    expect(canAccessPath("SUPER_ADMIN", "/portals/parent")).toBe(false);

    // Staff never see a personal portal, and students never see the shell.
    expect(canAccessPath("PRINCIPAL", "/portals/student")).toBe(false);
    expect(canAccessPath("STUDENT", "/command-center/today")).toBe(false);
    expect(labelsFor("STUDENT")).not.toContain("Command Center");
  });

  it("keeps the student and parent portals intact", () => {
    expect(sectionsFor("STUDENT")).toEqual(["Student Portal"]);
    expect(labelsFor("STUDENT")).toEqual(
      expect.arrayContaining(["Dashboard", "Attendance", "Results", "Fees", "Timetable"]),
    );

    expect(sectionsFor("PARENT")).toEqual(["Parent Portal"]);
    expect(labelsFor("PARENT")).toEqual(expect.arrayContaining(["Dashboard", "My Children"]));
  });

  it("lands every role somewhere it can actually reach", () => {
    for (const role of [
      "SCHOOL_OWNER",
      "PRINCIPAL",
      "EXAM_OFFICER",
      "BURSAR",
      "SUBJECT_TEACHER",
      "SCHOOL_NURSE",
      "LIBRARIAN",
      "STUDENT",
      "PARENT",
    ] as const) {
      const path = getDefaultPathForRole(role);
      expect(canAccessPath(role, path)).toBe(true);
    }

    expect(getDefaultPathForRole("SCHOOL_OWNER")).toBe("/command-center/today");
    expect(getDefaultPathForRole("STUDENT")).toBe("/portals/student");
    expect(getDefaultPathForRole("SUPER_ADMIN")).toBe("/super-admin");
  });

  it("keeps platform staff out of the school shell and school staff out of the platform", () => {
    expect(canAccessPath("SUPER_ADMIN", "/command-center/today")).toBe(false);
    expect(canAccessPath("PRINCIPAL", "/super-admin")).toBe(false);
  });
});

describe("sidebar chrome", () => {
  it("carries the mockup's badges and dots", () => {
    const items = getVisibleWorkflowNavGroups("SCHOOL_OWNER").flatMap((group) => group.items);
    const byLabel = new Map(items.map((item) => [item.label, item]));

    // Straight from the mockup's NAV table.
    const badges: Record<string, string> = {
      "Command Center": "3",
      Attendance: "2",
      "Score Entry & Results": "7",
      "Report Cards": "4",
      "Parents & Guardians": "5",
      "Approvals & Workflow": "9",
    };
    for (const [label, badge] of Object.entries(badges)) {
      expect(byLabel.get(label)?.badge, label).toBe(badge);
    }

    // An unresolved problem sits on exactly these two modules.
    const dotted = items.filter((item) => item.dot).map((item) => item.label).sort();
    expect(dotted).toEqual(["Audit & Security", "Class & Timetable"]);

    // Everything else is unadorned.
    const badged = items.filter((item) => item.badge).map((item) => item.label).sort();
    expect(badged).toEqual(Object.keys(badges).sort());
  });

  it("orders the sections as the mockup's rail does", () => {
    expect(getVisibleWorkflowNavGroups("SCHOOL_OWNER").map((group) => group.title)).toEqual([
      "Overview",
      "Academic Operations",
      "People",
      "Finance",
      "Engagement & Control",
      "Intelligence",
      "System",
    ]);
  });
});
