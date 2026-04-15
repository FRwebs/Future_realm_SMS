import { canAccessPath } from "@/lib/auth/roles";
import type { DashboardQuickAction, Role } from "@/lib/domain/types";

const financeManagers: Role[] = ["SUPER_ADMIN", "SCHOOL_OWNER", "ADMIN_OFFICER", "ACCOUNTANT"];
const academicLeaders: Role[] = [
  "SUPER_ADMIN",
  "SCHOOL_OWNER",
  "PROPRIETOR",
  "ADMINISTRATOR",
  "PRINCIPAL",
  "HEAD_TEACHER",
  "VICE_PRINCIPAL_ACADEMICS",
  "EXAM_OFFICER",
  "HEAD_OF_DEPARTMENT",
  "CLASS_TEACHER",
  "TEACHER",
  "SUBJECT_TEACHER"
];

export function canSeeDashboardWidget(role: Role, widget: "finance" | "admissions" | "academics" | "attendance" | "staff" | "system") {
  if (widget === "finance") return financeManagers.includes(role) || role === "PRINCIPAL";
  if (widget === "admissions") return ["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "ADMISSIONS_OFFICER"].includes(role);
  if (widget === "academics") return academicLeaders.includes(role) || role === "ADMIN_OFFICER";
  if (widget === "attendance") return academicLeaders.includes(role) || role === "ADMIN_OFFICER" || role === "ATTENDANCE_OFFICER";
  if (widget === "staff") return ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "VICE_PRINCIPAL_ADMINISTRATION", "ADMIN_OFFICER"].includes(role);
  return ["SUPER_ADMIN", "SCHOOL_OWNER"].includes(role);
}

export function getDashboardQuickActions(role: Role): DashboardQuickAction[] {
  const actions: DashboardQuickAction[] = [
    {
      label: "Review admissions",
      href: "/admissions",
      description: "Review applications, screening, approvals, offers, and enrollment clearance.",
      roleScope: ["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "ADMISSIONS_OFFICER"]
    },
    {
      label: "Add student",
      href: "/students",
      description: "Open the student register for student records and onboarding tasks.",
      roleScope: ["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER"]
    },
    {
      label: "Mark attendance",
      href: "/attendance",
      description: "Capture class attendance and follow up on absences.",
      roleScope: ["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER"]
    },
    {
      label: "Create invoice",
      href: "/finance",
      description: "Open fees, invoices, payment tracking, receipts, and arrears.",
      roleScope: financeManagers
    },
    {
      label: "Publish announcement",
      href: "/communications",
      description: "Send notices to parents, students, staff, or classes.",
      roleScope: ["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER"]
    },
    {
      label: "Review results",
      href: "/academics/results",
      description: "Check score entry, comments, report cards, and result publishing.",
      roleScope: academicLeaders
    }
  ];

  return actions.filter((action) => action.roleScope?.includes(role) && canAccessPath(role, action.href));
}
