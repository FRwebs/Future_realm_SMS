import type { Role } from "@/lib/domain/types";
import { systemRolePermissionKeys } from "@/lib/permissions/catalog";

export type PortalType = "school" | "super_admin";

export type NavigationGroup =
  | "Academic"
  | "People"
  | "Finance"
  | "Operations"
  | "Welfare"
  | "Communication"
  | "HR"
  | "Management"
  | "Account"
  | "Student Portal"
  | "Parent Portal"
  | "Teacher Portal"
  | "Platform";

export type NavigationRegistryItem = {
  id: string;
  label: string;
  icon: string;
  path: string;
  requiredPermissions: string[];
  portalType: PortalType;
  group: NavigationGroup | null;
  requireAny?: boolean;
  hideFromSidebar?: boolean;
  badge?: string;
  order: number;
};

export type NavigationGroupView = {
  title: string;
  items: NavigationRegistryItem[];
};

export type RoleAccent = {
  name: string;
  active: string;
  badge: string;
  button: string;
  gradient: string;
};

const defaultAccent: RoleAccent = {
  name: "Brand",
  active: "bg-brand-500",
  badge: "border-brand-200 bg-brand-50 text-brand-800",
  button: "bg-ink hover:bg-brand-800",
  gradient: "from-brand-700 via-brand-600 to-ink",
};

const roleAccents: Partial<Record<Role, RoleAccent>> = {
  PLATFORM_OWNER: { name: "Deep Indigo", active: "bg-indigo-600", badge: "border-indigo-200 bg-indigo-50 text-indigo-800", button: "bg-indigo-700 hover:bg-indigo-800", gradient: "from-indigo-950 via-slate-900 to-indigo-700" },
  PLATFORM_ADMIN: { name: "Deep Indigo", active: "bg-indigo-600", badge: "border-indigo-200 bg-indigo-50 text-indigo-800", button: "bg-indigo-700 hover:bg-indigo-800", gradient: "from-indigo-950 via-slate-900 to-indigo-700" },
  SUPPORT_AGENT: { name: "Deep Indigo", active: "bg-indigo-600", badge: "border-indigo-200 bg-indigo-50 text-indigo-800", button: "bg-indigo-700 hover:bg-indigo-800", gradient: "from-indigo-950 via-slate-900 to-indigo-700" },
  SALES_MANAGER: { name: "Deep Indigo", active: "bg-indigo-600", badge: "border-indigo-200 bg-indigo-50 text-indigo-800", button: "bg-indigo-700 hover:bg-indigo-800", gradient: "from-indigo-950 via-slate-900 to-indigo-700" },
  FINANCE_MANAGER: { name: "Deep Indigo", active: "bg-indigo-600", badge: "border-indigo-200 bg-indigo-50 text-indigo-800", button: "bg-indigo-700 hover:bg-indigo-800", gradient: "from-indigo-950 via-slate-900 to-indigo-700" },
  DEVELOPER: { name: "Deep Indigo", active: "bg-indigo-600", badge: "border-indigo-200 bg-indigo-50 text-indigo-800", button: "bg-indigo-700 hover:bg-indigo-800", gradient: "from-indigo-950 via-slate-900 to-indigo-700" },
  SUPER_ADMIN: { name: "Deep Indigo", active: "bg-indigo-600", badge: "border-indigo-200 bg-indigo-50 text-indigo-800", button: "bg-indigo-700 hover:bg-indigo-800", gradient: "from-indigo-950 via-slate-900 to-indigo-700" },
  SCHOOL_OWNER: { name: "Deep Blue", active: "bg-blue-800", badge: "border-blue-200 bg-blue-50 text-blue-800", button: "bg-blue-800 hover:bg-blue-900", gradient: "from-blue-950 via-blue-800 to-sky-700" },
  PROPRIETOR: { name: "Deep Blue", active: "bg-blue-800", badge: "border-blue-200 bg-blue-50 text-blue-800", button: "bg-blue-800 hover:bg-blue-900", gradient: "from-blue-950 via-blue-800 to-sky-700" },
  PRINCIPAL: { name: "Royal Blue", active: "bg-blue-600", badge: "border-blue-200 bg-blue-50 text-blue-800", button: "bg-blue-700 hover:bg-blue-800", gradient: "from-blue-800 via-blue-600 to-cyan-600" },
  HEAD_TEACHER: { name: "Royal Blue", active: "bg-blue-600", badge: "border-blue-200 bg-blue-50 text-blue-800", button: "bg-blue-700 hover:bg-blue-800", gradient: "from-blue-800 via-blue-600 to-cyan-600" },
  VICE_PRINCIPAL_ACADEMICS: { name: "Blue", active: "bg-sky-600", badge: "border-sky-200 bg-sky-50 text-sky-800", button: "bg-sky-700 hover:bg-sky-800", gradient: "from-sky-800 via-blue-600 to-cyan-600" },
  VICE_PRINCIPAL_ADMINISTRATION: { name: "Blue", active: "bg-sky-600", badge: "border-sky-200 bg-sky-50 text-sky-800", button: "bg-sky-700 hover:bg-sky-800", gradient: "from-sky-800 via-blue-600 to-cyan-600" },
  VICE_PRINCIPAL_SPECIAL_DUTIES: { name: "Blue", active: "bg-sky-600", badge: "border-sky-200 bg-sky-50 text-sky-800", button: "bg-sky-700 hover:bg-sky-800", gradient: "from-sky-800 via-blue-600 to-cyan-600" },
  HEAD_OF_DEPARTMENT: { name: "Teal", active: "bg-teal-600", badge: "border-teal-200 bg-teal-50 text-teal-800", button: "bg-teal-700 hover:bg-teal-800", gradient: "from-teal-900 via-teal-700 to-emerald-600" },
  CLASS_TEACHER: { name: "Cyan", active: "bg-cyan-600", badge: "border-cyan-200 bg-cyan-50 text-cyan-800", button: "bg-cyan-700 hover:bg-cyan-800", gradient: "from-cyan-900 via-cyan-700 to-sky-500" },
  SUBJECT_TEACHER: { name: "Sky", active: "bg-sky-500", badge: "border-sky-200 bg-sky-50 text-sky-800", button: "bg-sky-600 hover:bg-sky-700", gradient: "from-sky-800 via-sky-600 to-blue-500" },
  TEACHER: { name: "Sky", active: "bg-sky-500", badge: "border-sky-200 bg-sky-50 text-sky-800", button: "bg-sky-600 hover:bg-sky-700", gradient: "from-sky-800 via-sky-600 to-blue-500" },
  ACCOUNTANT: { name: "Emerald", active: "bg-emerald-600", badge: "border-emerald-200 bg-emerald-50 text-emerald-800", button: "bg-emerald-700 hover:bg-emerald-800", gradient: "from-emerald-900 via-emerald-700 to-teal-600" },
  ADMISSIONS_OFFICER: { name: "Violet", active: "bg-violet-600", badge: "border-violet-200 bg-violet-50 text-violet-800", button: "bg-violet-700 hover:bg-violet-800", gradient: "from-violet-900 via-violet-700 to-fuchsia-600" },
  EXAM_OFFICER: { name: "Purple", active: "bg-purple-600", badge: "border-purple-200 bg-purple-50 text-purple-800", button: "bg-purple-700 hover:bg-purple-800", gradient: "from-purple-900 via-purple-700 to-indigo-600" },
  GUIDANCE_COUNSELLOR: { name: "Rose", active: "bg-rose-600", badge: "border-rose-200 bg-rose-50 text-rose-800", button: "bg-rose-700 hover:bg-rose-800", gradient: "from-rose-900 via-rose-700 to-pink-600" },
  LIBRARIAN: { name: "Amber", active: "bg-amber-600", badge: "border-amber-200 bg-amber-50 text-amber-800", button: "bg-amber-700 hover:bg-amber-800", gradient: "from-amber-900 via-amber-700 to-yellow-600" },
  TRANSPORT_MANAGER: { name: "Orange", active: "bg-orange-600", badge: "border-orange-200 bg-orange-50 text-orange-800", button: "bg-orange-700 hover:bg-orange-800", gradient: "from-orange-900 via-orange-700 to-amber-600" },
  HOSTEL_MANAGER: { name: "Brown", active: "bg-yellow-800", badge: "border-yellow-200 bg-yellow-50 text-yellow-900", button: "bg-yellow-800 hover:bg-yellow-900", gradient: "from-yellow-950 via-yellow-800 to-orange-700" },
  HOSTEL_MASTER: { name: "Brown", active: "bg-yellow-800", badge: "border-yellow-200 bg-yellow-50 text-yellow-900", button: "bg-yellow-800 hover:bg-yellow-900", gradient: "from-yellow-950 via-yellow-800 to-orange-700" },
  HOSTEL_MISTRESS: { name: "Brown", active: "bg-yellow-800", badge: "border-yellow-200 bg-yellow-50 text-yellow-900", button: "bg-yellow-800 hover:bg-yellow-900", gradient: "from-yellow-950 via-yellow-800 to-orange-700" },
  ICT_CBT_ADMIN: { name: "Gray", active: "bg-slate-600", badge: "border-slate-200 bg-slate-50 text-slate-800", button: "bg-slate-700 hover:bg-slate-800", gradient: "from-slate-900 via-slate-700 to-gray-600" },
  NURSE: { name: "Pink", active: "bg-pink-600", badge: "border-pink-200 bg-pink-50 text-pink-800", button: "bg-pink-700 hover:bg-pink-800", gradient: "from-pink-900 via-pink-700 to-rose-600" },
  RECEPTIONIST: { name: "Lime", active: "bg-lime-600", badge: "border-lime-200 bg-lime-50 text-lime-800", button: "bg-lime-700 hover:bg-lime-800", gradient: "from-lime-900 via-lime-700 to-green-600" },
  PARENT: { name: "Green", active: "bg-green-600", badge: "border-green-200 bg-green-50 text-green-800", button: "bg-green-700 hover:bg-green-800", gradient: "from-green-900 via-green-700 to-emerald-600" },
  STUDENT: { name: "Indigo", active: "bg-indigo-600", badge: "border-indigo-200 bg-indigo-50 text-indigo-800", button: "bg-indigo-700 hover:bg-indigo-800", gradient: "from-indigo-900 via-indigo-700 to-blue-600" },
};

export function getRoleAccent(role: Role) {
  return roleAccents[role] ?? defaultAccent;
}

const platformPermissionByRole: Record<Role, string[]> = {
  PLATFORM_OWNER: ["sa.*"],
  SUPER_ADMIN: ["sa.*"],
  PLATFORM_ADMIN: [
    "sa.dashboard.view",
    "sa.schools.view",
    "sa.schools.create",
    "sa.schools.edit",
    "sa.users.view",
    "sa.users.reset_password",
    "sa.billing.view",
    "sa.analytics.view",
    "sa.support.view",
    "sa.support.manage",
    "sa.communications.view",
    "sa.communications.create",
    "sa.feature_flags.view",
    "sa.feature_flags.manage",
    "sa.security.view",
    "sa.crm.view",
    "sa.crm.manage",
    "sa.settings.view",
    "sa.settings.edit",
    "sa.audit_logs.view",
  ],
  SUPPORT_AGENT: [
    "sa.dashboard.view",
    "sa.schools.view",
    "sa.users.view",
    "sa.users.reset_password",
    "sa.support.view",
    "sa.support.manage",
    "sa.security.view",
    "sa.crm.view",
    "sa.audit_logs.view",
  ],
  SALES_MANAGER: [
    "sa.dashboard.view",
    "sa.schools.view",
    "sa.schools.create",
    "sa.schools.edit",
    "sa.billing.view",
    "sa.billing.edit_plan",
    "sa.analytics.view",
    "sa.communications.view",
    "sa.communications.create",
    "sa.crm.view",
    "sa.crm.manage",
  ],
  FINANCE_MANAGER: [
    "sa.dashboard.view",
    "sa.billing.view",
    "sa.billing.manage",
    "sa.analytics.view",
    "sa.revenue_reports.view",
  ],
  DEVELOPER: [
    "sa.dashboard.view",
    "sa.schools.view",
    "sa.support.view",
    "sa.communications.view",
    "sa.feature_flags.view",
    "sa.feature_flags.manage",
    "sa.security.view",
    "sa.settings.view",
    "sa.audit_logs.view",
  ],
  SCHOOL_OWNER: [],
  PROPRIETOR: [],
  ADMINISTRATOR: [],
  PRINCIPAL: [],
  HEAD_TEACHER: [],
  VICE_PRINCIPAL_ACADEMICS: [],
  VICE_PRINCIPAL_ADMINISTRATION: [],
  VICE_PRINCIPAL_SPECIAL_DUTIES: [],
  ADMIN_OFFICER: [],
  TEACHER: [],
  EXAM_OFFICER: [],
  EXAMINATION_OFFICER: [],
  HEAD_OF_DEPARTMENT: [],
  CLASS_TEACHER: [],
  SUBJECT_TEACHER: [],
  BURSAR: [],
  ACCOUNTANT: [],
  ACCOUNT_OFFICER: [],
  HR_OFFICER: [],
  SECURITY_OFFICER: [],
  MAINTENANCE_OFFICER: [],
  PARENT: [],
  STUDENT: [],
  ADMISSIONS_OFFICER: [],
  GUIDANCE_COUNSELOR: [],
  GUIDANCE_COUNSELLOR: [],
  LIBRARIAN: [],
  LABORATORY_STAFF: [],
  LABORATORY_ASSISTANT: [],
  ICT_CBT_ADMIN: [],
  IT_ADMINISTRATOR: [],
  ATTENDANCE_OFFICER: [],
  SCHOOL_NURSE: [],
  NURSE: [],
  RECEPTIONIST: [],
  TRANSPORT_COORDINATOR: [],
  TRANSPORT_MANAGER: [],
  HOSTEL_MANAGER: [],
  HOSTEL_MASTER: [],
  HOSTEL_MATRON: [],
  HOSTEL_MISTRESS: [],
  STORE_OFFICER: [],
};

export const NAV_REGISTRY: NavigationRegistryItem[] = [
  { id: "sa_dashboard", label: "Dashboard", icon: "LayoutDashboard", path: "/super-admin", requiredPermissions: ["sa.dashboard.view"], portalType: "super_admin", group: "Platform", order: 1 },
  { id: "sa_schools", label: "Schools", icon: "Building2", path: "/super-admin/schools", requiredPermissions: ["sa.schools.view"], portalType: "super_admin", group: "Platform", order: 2 },
  { id: "sa_users", label: "Users", icon: "Users", path: "/super-admin/users", requiredPermissions: ["sa.users.view"], portalType: "super_admin", group: "Platform", order: 3 },
  { id: "sa_billing", label: "Billing & Revenue", icon: "CreditCard", path: "/super-admin/billing", requiredPermissions: ["sa.billing.view"], portalType: "super_admin", group: "Platform", order: 4 },
  { id: "sa_analytics", label: "Analytics", icon: "BarChart3", path: "/super-admin/analytics", requiredPermissions: ["sa.analytics.view"], portalType: "super_admin", group: "Platform", order: 5 },
  { id: "sa_support", label: "Support Tickets", icon: "Headphones", path: "/super-admin/support", requiredPermissions: ["sa.support.view"], portalType: "super_admin", group: "Platform", badge: "openTicketsCount", order: 6 },
  { id: "sa_communications", label: "Communications", icon: "Megaphone", path: "/super-admin/communications", requiredPermissions: ["sa.communications.view"], portalType: "super_admin", group: "Platform", order: 7 },
  { id: "sa_feature_flags", label: "Feature Flags", icon: "Flag", path: "/super-admin/feature-flags", requiredPermissions: ["sa.feature_flags.view"], portalType: "super_admin", group: "Platform", order: 8 },
  { id: "sa_security", label: "Security", icon: "ShieldCheck", path: "/super-admin/security", requiredPermissions: ["sa.security.view"], portalType: "super_admin", group: "Platform", order: 9 },
  { id: "sa_crm", label: "CRM & Sales", icon: "Target", path: "/super-admin/crm", requiredPermissions: ["sa.crm.view"], portalType: "super_admin", group: "Platform", order: 10 },
  { id: "sa_audit_logs", label: "Audit Logs", icon: "FileClock", path: "/super-admin/audit-logs", requiredPermissions: ["sa.audit_logs.view"], portalType: "super_admin", group: "Platform", order: 11 },
  { id: "sa_settings", label: "Settings", icon: "Settings2", path: "/super-admin/settings", requiredPermissions: ["sa.settings.view"], portalType: "super_admin", group: "Platform", order: 12 },

  { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard", path: "/dashboard", requiredPermissions: [], portalType: "school", group: null, order: 1 },
  { id: "students", label: "Students", icon: "GraduationCap", path: "/students", requiredPermissions: ["students.view"], portalType: "school", group: "Academic", order: 10 },
  { id: "classes", label: "Classes", icon: "BookOpen", path: "/classes", requiredPermissions: ["classes.view"], portalType: "school", group: "Academic", order: 10.5 },
  { id: "timetable", label: "Timetable", icon: "Calendar", path: "/timetable", requiredPermissions: ["timetable.view"], portalType: "school", group: "Academic", order: 10.8 },
  { id: "attendance", label: "Attendance", icon: "ClipboardCheck", path: "/attendance", requiredPermissions: ["attendance.view", "attendance.mark"], requireAny: true, portalType: "school", group: "Academic", hideFromSidebar: true, order: 11 },
  { id: "curriculum", label: "Scheme of Work", icon: "BookOpen", path: "/academics/curriculum", requiredPermissions: ["subjects.view", "lesson_plans.view"], requireAny: true, portalType: "school", group: "Academic", order: 12 },
  { id: "subjects", label: "Subjects", icon: "BookMarked", path: "/academics/subjects", requiredPermissions: ["subjects.view"], portalType: "school", group: "Academic", order: 13 },
  { id: "assessments", label: "Assessments & Exams", icon: "FileCheck", path: "/academics/results/assessments", requiredPermissions: ["results.view", "exams.view"], requireAny: true, portalType: "school", group: "Academic", order: 14 },
  { id: "results", label: "Results & Broadsheets", icon: "Award", path: "/academics/results", requiredPermissions: ["results.view"], portalType: "school", group: "Academic", order: 15 },
  { id: "result_settings", label: "Result Settings", icon: "Settings2", path: "/academics/results/settings", requiredPermissions: ["settings.grading"], portalType: "school", group: "Academic", hideFromSidebar: true, order: 15.1 },
  { id: "result_approvals", label: "Result Approvals", icon: "ClipboardCheck", path: "/academics/results/approvals", requiredPermissions: ["results.approve"], portalType: "school", group: "Academic", hideFromSidebar: true, order: 15.2 },
  { id: "result_publish", label: "Publish Results", icon: "FileCheck", path: "/academics/results/publish", requiredPermissions: ["results.publish"], portalType: "school", group: "Academic", hideFromSidebar: true, order: 15.3 },
  { id: "result_analytics", label: "Result Analytics", icon: "BarChart3", path: "/academics/results/analytics", requiredPermissions: ["reports.view"], portalType: "school", group: "Academic", hideFromSidebar: true, order: 15.4 },
  { id: "result_history", label: "Result History", icon: "FileClock", path: "/academics/results/history", requiredPermissions: ["results.view"], portalType: "school", group: "Academic", hideFromSidebar: true, order: 15.5 },
  { id: "result_report_cards", label: "Report Cards", icon: "FileText", path: "/academics/results/report-cards", requiredPermissions: ["results.export"], portalType: "school", group: "Academic", hideFromSidebar: true, order: 15.6 },
  { id: "result_broadsheets", label: "Broadsheets", icon: "Award", path: "/academics/results/broadsheets", requiredPermissions: ["results.view"], portalType: "school", group: "Academic", hideFromSidebar: true, order: 15.7 },
  { id: "staff", label: "Staff", icon: "UserRoundCog", path: "/school/staff", requiredPermissions: ["staff.view"], portalType: "school", group: "People", order: 19 },
  { id: "teachers", label: "Teachers", icon: "Users", path: "/teachers", requiredPermissions: ["teachers.view", "staff.view"], requireAny: true, portalType: "school", group: "People", hideFromSidebar: true, order: 20 },
  { id: "parents", label: "Parents", icon: "Users", path: "/parents", requiredPermissions: ["parents.view"], portalType: "school", group: "People", order: 20.2 },
  { id: "profiles", label: "Profiles", icon: "UserCircle", path: "/school/profile", requiredPermissions: ["profiles.view"], portalType: "school", group: "People", hideFromSidebar: true, order: 20.4 },
  { id: "staff_attendance_admin", label: "Staff Attendance", icon: "UserCheck", path: "/teachers/attendance", requiredPermissions: ["staff_attendance.view"], portalType: "school", group: "HR", order: 21 },
  { id: "staff_leave", label: "Staff Leave", icon: "ClipboardList", path: "/school/staff", requiredPermissions: ["staff_leave.view"], portalType: "school", group: "HR", order: 21.5 },
  { id: "teacher_training_admin", label: "Teacher Training", icon: "ClipboardList", path: "/teachers/training", requiredPermissions: ["staff.view"], portalType: "school", group: "HR", order: 22 },
  { id: "admissions", label: "Admissions", icon: "UserPlus", path: "/admissions", requiredPermissions: ["admissions.view"], portalType: "school", group: "People", order: 23 },
  { id: "finance", label: "Fees & Payments", icon: "CreditCard", path: "/finance", requiredPermissions: ["fees.view"], portalType: "school", group: "Finance", order: 30 },
  { id: "expenses", label: "Expenses", icon: "CreditCard", path: "/finance/reports", requiredPermissions: ["expenses.view"], portalType: "school", group: "Finance", order: 31 },
  { id: "salaries", label: "Salaries", icon: "CreditCard", path: "/finance/reports", requiredPermissions: ["salaries.view"], portalType: "school", group: "Finance", order: 32 },
  { id: "bank_reconciliation", label: "Bank Reconciliation", icon: "CreditCard", path: "/finance/reports", requiredPermissions: ["bank_reconciliation.view"], portalType: "school", group: "Finance", order: 33 },
  { id: "budgets", label: "Budgets", icon: "BarChart3", path: "/finance/reports", requiredPermissions: ["budgets.view"], portalType: "school", group: "Finance", order: 34 },
  { id: "finance_reports", label: "Finance Reports", icon: "BarChart3", path: "/finance/reports", requiredPermissions: ["fees.export", "expenses.export", "salaries.export", "bank_reconciliation.export", "budgets.export"], requireAny: true, portalType: "school", group: "Finance", order: 35 },
  { id: "communications", label: "Communication", icon: "Megaphone", path: "/communications", requiredPermissions: ["announcements.view", "messaging.view"], requireAny: true, portalType: "school", group: "Communication", order: 40 },
  { id: "announcements", label: "Announcements", icon: "Megaphone", path: "/communications", requiredPermissions: ["announcements.view"], portalType: "school", group: "Communication", order: 41 },
  { id: "messaging", label: "Messaging", icon: "Megaphone", path: "/communications", requiredPermissions: ["messaging.view", "messaging.send"], requireAny: true, portalType: "school", group: "Communication", order: 42 },
  { id: "analytics", label: "Reports", icon: "BarChart3", path: "/analytics", requiredPermissions: ["reports.view"], portalType: "school", group: "Management", order: 50 },
  { id: "class_reports", label: "Class Reports", icon: "FileText", path: "/academics/results/report-cards", requiredPermissions: ["class_reports.view"], portalType: "school", group: "Management", order: 51 },
  { id: "report_cards", label: "Report Cards", icon: "FileText", path: "/academics/results/report-cards", requiredPermissions: ["report_cards.view", "report_cards.generate", "report_cards.download"], requireAny: true, portalType: "school", group: "Management", order: 52 },
  { id: "audit_logs", label: "Audit Logs", icon: "FileClock", path: "/analytics", requiredPermissions: ["audit_logs.view"], portalType: "school", group: "Management", order: 53 },
  { id: "data_export", label: "Data Export", icon: "FileText", path: "/analytics", requiredPermissions: ["data_export.view", "data_export.create"], requireAny: true, portalType: "school", group: "Management", order: 54 },
  { id: "operations", label: "Operations Overview", icon: "LayoutDashboard", path: "/operations", requiredPermissions: ["reports.view", "discipline.view", "visitors.view", "inventory.view"], requireAny: true, portalType: "school", group: "Operations", order: 60 },
  { id: "welfare", label: "Welfare & Discipline", icon: "HeartPulse", path: "/operations/welfare", requiredPermissions: ["discipline.view", "health_records.view", "counseling_records.view"], requireAny: true, portalType: "school", group: "Welfare", order: 61 },
  { id: "discipline", label: "Discipline", icon: "HeartPulse", path: "/operations/welfare", requiredPermissions: ["discipline.view"], portalType: "school", group: "Welfare", order: 61.1 },
  { id: "conduct_records", label: "Conduct Records", icon: "ClipboardCheck", path: "/operations/welfare", requiredPermissions: ["conduct_records.view"], portalType: "school", group: "Welfare", order: 61.2 },
  { id: "counseling_records", label: "Counseling Records", icon: "HeartPulse", path: "/operations/welfare", requiredPermissions: ["counseling_records.view"], portalType: "school", group: "Welfare", order: 61.3 },
  { id: "health_records", label: "Health Records", icon: "HeartPulse", path: "/operations/welfare", requiredPermissions: ["health_records.view"], portalType: "school", group: "Welfare", order: 61.4 },
  { id: "hostel", label: "Hostel", icon: "Building2", path: "/operations/welfare", requiredPermissions: ["hostel.view"], portalType: "school", group: "Welfare", order: 61.5 },
  { id: "operations_academics", label: "Lesson Plans & Questions", icon: "ClipboardCheck", path: "/operations/academics", requiredPermissions: ["lesson_plans.view", "question_bank.view"], requireAny: true, portalType: "school", group: "Academic", order: 62 },
  { id: "assignments", label: "Assignments", icon: "FileText", path: "/operations/academics", requiredPermissions: ["assignments.view"], portalType: "school", group: "Academic", order: 62.1 },
  { id: "learning_materials", label: "Learning Materials", icon: "BookOpen", path: "/academics/curriculum", requiredPermissions: ["learning_materials.view"], portalType: "school", group: "Academic", order: 62.2 },
  { id: "academic_calendar", label: "Academic Calendar", icon: "Calendar", path: "/school/configuration/school-calendar", requiredPermissions: ["academic_calendar.view", "config.school_calendar.view"], requireAny: true, portalType: "school", group: "Academic", order: 62.3 },
  { id: "lesson_plans", label: "Lesson Plans", icon: "ClipboardCheck", path: "/operations/academics", requiredPermissions: ["lesson_plans.view"], portalType: "school", group: "Academic", order: 62.4 },
  { id: "question_bank", label: "Question Bank", icon: "BookMarked", path: "/operations/academics", requiredPermissions: ["question_bank.view"], portalType: "school", group: "Academic", order: 62.5 },
  { id: "quizzes", label: "Quizzes", icon: "FileCheck", path: "/operations/academics", requiredPermissions: ["quizzes.view"], portalType: "school", group: "Academic", order: 62.6 },
  { id: "operations_exams", label: "Exam Logistics", icon: "FileCheck", path: "/operations/exams", requiredPermissions: ["external_exams.view", "seating_plan.view", "invigilation.view"], requireAny: true, portalType: "school", group: "Academic", order: 63 },
  { id: "exams", label: "Exams", icon: "FileCheck", path: "/academics/results/assessments", requiredPermissions: ["exams.view"], portalType: "school", group: "Academic", order: 63.1 },
  { id: "exam_timetable", label: "Exam Timetable", icon: "Calendar", path: "/operations/exams", requiredPermissions: ["exam_timetable.view"], portalType: "school", group: "Academic", order: 63.2 },
  { id: "seating_plan", label: "Seating Plan", icon: "ClipboardList", path: "/operations/exams", requiredPermissions: ["seating_plan.view"], portalType: "school", group: "Academic", order: 63.3 },
  { id: "invigilation", label: "Invigilation", icon: "UserCheck", path: "/operations/exams", requiredPermissions: ["invigilation.view"], portalType: "school", group: "Academic", order: 63.4 },
  { id: "external_exams", label: "External Exams", icon: "FileCheck", path: "/operations/exams", requiredPermissions: ["external_exams.view"], portalType: "school", group: "Academic", order: 63.5 },
  { id: "front_desk", label: "Front Desk", icon: "UserCog", path: "/operations/front-desk", requiredPermissions: ["visitors.view", "parent_meetings.view"], requireAny: true, portalType: "school", group: "Operations", order: 64 },
  { id: "visitors", label: "Visitors", icon: "UserCog", path: "/operations/front-desk", requiredPermissions: ["visitors.view"], portalType: "school", group: "Operations", order: 64.1 },
  { id: "parent_meetings", label: "Parent Meetings", icon: "Users", path: "/operations/front-desk", requiredPermissions: ["parent_meetings.view"], portalType: "school", group: "Operations", order: 64.2 },
  { id: "events", label: "Events", icon: "Flag", path: "/operations/front-desk", requiredPermissions: ["events.view"], portalType: "school", group: "Operations", order: 64.3 },
  { id: "assets", label: "Assets & Facilities", icon: "Package", path: "/operations/assets", requiredPermissions: ["inventory.view", "facilities.view", "transport.view"], requireAny: true, portalType: "school", group: "Operations", order: 65 },
  { id: "library", label: "Library", icon: "BookOpen", path: "/operations/assets", requiredPermissions: ["library.view"], portalType: "school", group: "Operations", order: 65.1 },
  { id: "transport", label: "Transport", icon: "Package", path: "/operations/assets", requiredPermissions: ["transport.view"], portalType: "school", group: "Operations", order: 65.2 },
  { id: "inventory", label: "Inventory", icon: "Package", path: "/operations/assets", requiredPermissions: ["inventory.view"], portalType: "school", group: "Operations", order: 65.3 },
  { id: "facilities", label: "Facilities", icon: "Building2", path: "/operations/assets", requiredPermissions: ["facilities.view"], portalType: "school", group: "Operations", order: 65.4 },
  { id: "id_cards", label: "ID Cards", icon: "FileText", path: "/operations/assets", requiredPermissions: ["id_cards.view", "config.id_card.view"], requireAny: true, portalType: "school", group: "Operations", order: 65.5 },
  { id: "documents", label: "Documents", icon: "FileText", path: "/school/profile", requiredPermissions: ["documents.view", "profiles.view_documents"], requireAny: true, portalType: "school", group: "Operations", order: 65.6 },
  { id: "settings", label: "Settings", icon: "Settings2", path: "/settings", requiredPermissions: ["settings.view"], portalType: "school", group: "Management", order: 70 },
  { id: "configuration", label: "Configuration", icon: "Settings2", path: "/school/configuration", requiredPermissions: ["config.manage", "config.sessions_terms.view", "config.school_information.view", "config.class_levels.view", "config.class_arms.view", "config.school_calendar.view", "config.finance.view", "config.subjects.view"], requireAny: true, portalType: "school", group: "Management", order: 70.5 },
  { id: "integrations", label: "Integrations", icon: "Settings2", path: "/settings", requiredPermissions: ["integrations.view"], portalType: "school", group: "Management", order: 70.7 },
  { id: "roles_permissions", label: "Roles & Permissions", icon: "Lock", path: "/school/settings/roles", requiredPermissions: ["roles.view"], portalType: "school", group: "Management", order: 71 },
  { id: "profile", label: "My Profile", icon: "UserCircle", path: "/school/profile", requiredPermissions: ["profiles.view_self"], portalType: "school", group: "Account", hideFromSidebar: true, order: 72 },
  { id: "profile_edit_requests", label: "Profile Edit Requests", icon: "ClipboardCheck", path: "/school/profile/edit-requests", requiredPermissions: ["profiles.review_edit_requests"], portalType: "school", group: "Account", hideFromSidebar: true, order: 72.1 },
  { id: "my_permissions", label: "My Permissions", icon: "Key", path: "/school/my-permissions", requiredPermissions: [], portalType: "school", group: "Account", order: 73 },

  { id: "student_home", label: "Dashboard", icon: "LayoutDashboard", path: "/portals/student", requiredPermissions: [], portalType: "school", group: "Student Portal", order: 100 },
  { id: "student_profile", label: "My Profile", icon: "Users", path: "/portals/student/profile", requiredPermissions: [], portalType: "school", group: "Student Portal", order: 101 },
  { id: "student_attendance", label: "Attendance", icon: "ClipboardCheck", path: "/portals/student/attendance", requiredPermissions: ["attendance.view"], portalType: "school", group: "Student Portal", order: 102 },
  { id: "student_results", label: "Results", icon: "Award", path: "/portals/student/results", requiredPermissions: ["results.view"], portalType: "school", group: "Student Portal", order: 103 },
  { id: "student_curriculum", label: "Scheme of Work", icon: "BookOpen", path: "/portals/student/curriculum", requiredPermissions: ["learning_materials.view"], portalType: "school", group: "Student Portal", order: 104 },
  { id: "student_timetable", label: "Timetable", icon: "Calendar", path: "/portals/student/timetable", requiredPermissions: ["timetable.view"], portalType: "school", group: "Student Portal", order: 105 },
  { id: "student_assignments", label: "Assignments", icon: "FileText", path: "/portals/student/assignments", requiredPermissions: ["assignments.view"], portalType: "school", group: "Student Portal", order: 106 },
  { id: "student_fees", label: "Fees", icon: "CreditCard", path: "/portals/student/fees", requiredPermissions: ["fees.view"], portalType: "school", group: "Student Portal", order: 107 },
  { id: "student_services", label: "Services", icon: "Building2", path: "/portals/student/services", requiredPermissions: [], portalType: "school", group: "Student Portal", order: 108 },
  { id: "student_announcements", label: "Announcements", icon: "Megaphone", path: "/portals/student/announcements", requiredPermissions: ["announcements.view"], portalType: "school", group: "Student Portal", order: 109 },
  { id: "student_notifications", label: "Notifications", icon: "BellRing", path: "/portals/student/notifications", requiredPermissions: [], portalType: "school", group: "Student Portal", order: 110 },

  { id: "parent_home", label: "Dashboard", icon: "LayoutDashboard", path: "/portals/parent", requiredPermissions: [], portalType: "school", group: "Parent Portal", order: 120 },
  { id: "parent_children", label: "My Children", icon: "Users", path: "/portals/parent/children", requiredPermissions: [], portalType: "school", group: "Parent Portal", order: 121 },
  { id: "parent_announcements", label: "Announcements", icon: "Megaphone", path: "/portals/parent/announcements", requiredPermissions: ["announcements.view"], portalType: "school", group: "Parent Portal", order: 122 },
  { id: "parent_curriculum", label: "Scheme of Work", icon: "BookOpen", path: "/portals/parent/curriculum", requiredPermissions: [], portalType: "school", group: "Parent Portal", order: 123 },
  { id: "parent_notifications", label: "Notifications", icon: "BellRing", path: "/portals/parent/notifications", requiredPermissions: [], portalType: "school", group: "Parent Portal", order: 124 },
  { id: "parent_profile", label: "Profile", icon: "Users", path: "/portals/parent/profile", requiredPermissions: [], portalType: "school", group: "Parent Portal", order: 125 },

  { id: "teacher_home", label: "Dashboard", icon: "LayoutDashboard", path: "/portals/teacher", requiredPermissions: [], portalType: "school", group: "Teacher Portal", order: 140 },
  { id: "teacher_classes", label: "My Classes", icon: "Users", path: "/portals/teacher/classes", requiredPermissions: ["students.view"], portalType: "school", group: "Teacher Portal", order: 141 },
  { id: "teacher_attendance", label: "Mark Attendance", icon: "ClipboardCheck", path: "/portals/teacher/attendance", requiredPermissions: ["attendance.mark", "attendance.view"], requireAny: true, portalType: "school", group: "Teacher Portal", order: 142 },
  { id: "teacher_scores", label: "Enter Scores", icon: "Award", path: "/portals/teacher/scores", requiredPermissions: ["results.create", "results.edit"], requireAny: true, portalType: "school", group: "Teacher Portal", order: 143 },
  { id: "teacher_curriculum", label: "Scheme of Work", icon: "BookOpen", path: "/portals/teacher/curriculum", requiredPermissions: ["learning_materials.view"], portalType: "school", group: "Teacher Portal", order: 144 },
  { id: "teacher_clock", label: "Clock In / Out", icon: "UserCheck", path: "/portals/teacher/staff-attendance", requiredPermissions: [], portalType: "school", group: "Teacher Portal", order: 145 },
  { id: "teacher_training", label: "Training", icon: "ClipboardList", path: "/portals/teacher/training", requiredPermissions: [], portalType: "school", group: "Teacher Portal", order: 146 },
  { id: "teacher_assignments", label: "Assignments", icon: "FileText", path: "/portals/teacher/assignments", requiredPermissions: ["assignments.view", "assignments.create"], requireAny: true, portalType: "school", group: "Teacher Portal", order: 147 },
  { id: "teacher_timetable", label: "Timetable", icon: "Calendar", path: "/portals/teacher/timetable", requiredPermissions: ["timetable.view"], portalType: "school", group: "Teacher Portal", order: 148 },
];

const portalGroupsByRole: Partial<Record<Role, NavigationGroup>> = {
  STUDENT: "Student Portal",
  PARENT: "Parent Portal",
  TEACHER: "Teacher Portal",
  CLASS_TEACHER: "Teacher Portal",
  SUBJECT_TEACHER: "Teacher Portal",
};

const portalOnlyRoles = new Set<Role>(["STUDENT", "PARENT"]);
const personalPortalGroups = new Set<NavigationGroup>(["Student Portal", "Parent Portal", "Teacher Portal"]);

export const platformRoles: Role[] = [
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "SUPPORT_AGENT",
  "SALES_MANAGER",
  "FINANCE_MANAGER",
  "DEVELOPER",
  "SUPER_ADMIN",
];

export function isPlatformRole(role: Role) {
  return platformRoles.includes(role);
}

export function getDefaultPermissionsForRole(role: Role) {
  if (isPlatformRole(role)) return platformPermissionByRole[role] ?? [];
  return systemRolePermissionKeys[role] ?? [];
}

function permissionMatches(granted: Set<string>, required: string) {
  if (granted.has(required)) return true;
  const [namespace] = required.split(".");
  return granted.has(`${namespace}.*`) || granted.has("sa.*");
}

export function canAccessNavItem(item: NavigationRegistryItem, permissions: string[]) {
  if (item.requiredPermissions.length === 0) return true;
  const granted = new Set(permissions);
  if (item.requireAny) return item.requiredPermissions.some((permission) => permissionMatches(granted, permission));
  return item.requiredPermissions.every((permission) => permissionMatches(granted, permission));
}

function canUseNavigationItemForRole(role: Role, item: NavigationRegistryItem, permissions: string[]) {
  if (item.portalType === "super_admin") return isPlatformRole(role) && canAccessNavItem(item, permissions);
  if (item.portalType === "school" && isPlatformRole(role)) return false;

  const portalGroup = portalGroupsByRole[role];
  if (portalOnlyRoles.has(role)) return item.group === portalGroup && canAccessNavItem(item, permissions);
  if (item.group === "Student Portal" || item.group === "Parent Portal") return false;
  if (item.group === "Teacher Portal") return item.group === portalGroup && canAccessNavItem(item, permissions);

  return canAccessNavItem(item, permissions);
}

export function getNavigationItemForPath(path: string) {
  return NAV_REGISTRY
    .filter((item) => path === item.path || path.startsWith(`${item.path}/`))
    .sort((left, right) => right.path.length - left.path.length)[0];
}

function getNavigationItemsForPath(path: string) {
  const matches = NAV_REGISTRY
    .filter((item) => path === item.path || path.startsWith(`${item.path}/`))
    .sort((left, right) => right.path.length - left.path.length);
  const longestPathLength = matches[0]?.path.length;
  return longestPathLength ? matches.filter((item) => item.path.length === longestPathLength) : [];
}

export function canAccessPathWithPermissions(role: Role, path: string, permissions = getDefaultPermissionsForRole(role)) {
  const items = getNavigationItemsForPath(path);
  if (!items.length) return false;
  return items.some((item) => canUseNavigationItemForRole(role, item, permissions));
}

export function buildNavigation(portalType: PortalType, role: Role, permissions = getDefaultPermissionsForRole(role)) {
  const items = NAV_REGISTRY
    .filter((item) => item.portalType === portalType)
    .filter((item) => {
      if (portalType === "super_admin") return isPlatformRole(role);
      return !item.group || !personalPortalGroups.has(item.group) || Boolean(portalGroupsByRole[role]);
    })
    .filter((item) => !item.hideFromSidebar)
    .filter((item) => canUseNavigationItemForRole(role, item, permissions))
    .sort((left, right) => left.order - right.order);

  const groups = new Map<string, NavigationRegistryItem[]>();
  for (const item of items) {
    const group = item.group ?? "Start Here";
    groups.set(group, [...(groups.get(group) ?? []), item]);
  }

  return Array.from(groups.entries()).map(([title, groupItems]) => ({ title, items: groupItems }));
}
