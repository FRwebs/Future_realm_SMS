import type { Role } from "@/lib/domain/types";
import { isSchoolStaffRole, schoolPermissionsForRole } from "@/lib/modules/school-access";
import { getSchoolModule } from "@/lib/modules/school-modules";
import { systemRolePermissionKeys } from "@/lib/permissions/catalog";

export type PortalType = "school" | "super_admin";

/**
 * The school portal's seven sections come straight from the mockup's sidebar.
 * The remainder belong to the Super Admin portal and the two personal portals
 * the school shell publishes to.
 */
export type NavigationGroup =
  // School portal — the mockup's seven sidebar sections, in order.
  | "Overview"
  | "Academic Operations"
  | "People"
  | "Finance"
  | "Engagement & Control"
  | "Intelligence"
  | "System"
  // Personal portals the school shell publishes results and invitations to.
  | "Student Portal"
  | "Parent Portal"
  // Super Admin portal.
  | "Schools & Revenue"
  | "Operations"
  | "Trust & Control"
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
  /** Shows for portal-restricted roles (Principal, nurse, librarian, etc.) too, as long as they hold the required permissions — bypasses the portal-prefix lockdown that otherwise limits those roles to their own `/portals/*` nav items. */
  sharedAcrossPortals?: boolean;
  badge?: string;
  /** The mockup's amber "unresolved problem" dot, shown when not on the page. */
  dot?: boolean;
  order: number;
};

export type NavigationGroupView = {
  title: string;
  items: NavigationRegistryItem[];
};

const platformPermissionByRole: Record<Role, string[]> = {
  PLATFORM_OWNER: ["sa.*"],
  SUPER_ADMIN: ["sa.*"],
  PLATFORM_ADMIN: [
    "sa.dashboard.view",
    "sa.my_work.view",
    "sa.schools.view",
    "sa.schools.create",
    "sa.schools.edit",
    "sa.migration.view",
    "sa.migration.manage",
    "sa.partners.view",
    "sa.partners.manage",
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
    "sa.my_work.view",
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
    "sa.my_work.view",
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
    "sa.partners.view",
    "sa.partners.manage",
  ],
  FINANCE_MANAGER: [
    "sa.dashboard.view",
    "sa.my_work.view",
    "sa.billing.view",
    "sa.billing.manage",
    "sa.analytics.view",
    "sa.revenue_reports.view",
    "sa.partners.view",
  ],
  DEVELOPER: [
    "sa.dashboard.view",
    "sa.my_work.view",
    "sa.schools.view",
    "sa.migration.view",
    "sa.migration.manage",
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
  {
    id: "student_curriculum",
    label: "My Subjects",
    icon: "BookOpen",
    path: "/my-subjects",
    requiredPermissions: [],
    portalType: "school",
    group: "Student Portal",
    order: 104,
  },
  {
    id: "parent_children_subjects",
    label: "Child Subjects",
    icon: "BookOpen",
    path: "/my-children",
    requiredPermissions: [],
    portalType: "school",
    group: "Parent Portal",
    hideFromSidebar: true,
    order: 123.1,
  },
  {
    id: "m1_command_center",
    badge: "3",
    label: "Command Center",
    icon: "Activity",
    path: "/command-center/today",
    requiredPermissions: ["command-center.today.view"],
    portalType: "school",
    group: "Overview",
    order: 1,
  },
  {
    id: "m2_school_configuration",
    label: "School Configuration",
    icon: "Settings2",
    path: "/school-configuration/profile",
    requiredPermissions: ["school-configuration.profile.view"],
    portalType: "school",
    group: "Academic Operations",
    order: 2,
  },
  {
    id: "m3_class_timetable",
    dot: true,
    label: "Class & Timetable",
    icon: "LayoutGrid",
    path: "/class-timetable/classes",
    requiredPermissions: ["class-timetable.classes.view"],
    portalType: "school",
    group: "Academic Operations",
    order: 3,
  },
  {
    id: "m4_attendance",
    badge: "2",
    label: "Attendance",
    icon: "ClipboardCheck",
    path: "/attendance/register",
    requiredPermissions: ["attendance.register.view"],
    portalType: "school",
    group: "Academic Operations",
    order: 4,
  },
  {
    id: "m5_score_entry_results",
    badge: "7",
    label: "Score Entry & Results",
    icon: "FileText",
    path: "/score-entry-results/review",
    requiredPermissions: ["score-entry-results.review.view"],
    portalType: "school",
    group: "Academic Operations",
    order: 5,
  },
  {
    id: "m6_report_cards",
    badge: "4",
    label: "Report Cards",
    icon: "Award",
    path: "/report-cards/remarks",
    requiredPermissions: ["report-cards.remarks.view"],
    portalType: "school",
    group: "Academic Operations",
    order: 6,
  },
  {
    id: "m7_staff_access",
    label: "Staff & Access",
    icon: "Users",
    path: "/staff-access/directory",
    requiredPermissions: ["staff-access.directory.view"],
    portalType: "school",
    group: "People",
    order: 7,
  },
  {
    id: "m8_student_records",
    label: "Student Records",
    icon: "GraduationCap",
    path: "/student-records/registry",
    requiredPermissions: ["student-records.registry.view"],
    portalType: "school",
    group: "People",
    order: 8,
  },
  {
    id: "m9_parents_guardians",
    badge: "5",
    label: "Parents & Guardians",
    icon: "Handshake",
    path: "/parents-guardians/guardians",
    requiredPermissions: ["parents-guardians.guardians.view"],
    portalType: "school",
    group: "People",
    order: 9,
  },
  {
    id: "m10_fee_management",
    label: "Fee Management",
    icon: "CreditCard",
    path: "/fee-management/collections",
    requiredPermissions: ["fee-management.collections.view"],
    portalType: "school",
    group: "Finance",
    order: 10,
  },
  {
    id: "m11_subscription_billing",
    label: "Subscription & Billing",
    icon: "Package",
    path: "/subscription-billing/plan",
    requiredPermissions: ["subscription-billing.plan.view"],
    portalType: "school",
    group: "Finance",
    order: 11,
  },
  {
    id: "m12_communication_center",
    label: "Communication Center",
    icon: "MessageSquareText",
    path: "/communication-center/compose",
    requiredPermissions: ["communication-center.compose.view"],
    portalType: "school",
    group: "Engagement & Control",
    order: 12,
  },
  {
    id: "m13_approvals_workflow",
    badge: "9",
    label: "Approvals & Workflow",
    icon: "ListChecks",
    path: "/approvals-workflow/queue",
    requiredPermissions: ["approvals-workflow.queue.view"],
    portalType: "school",
    group: "Engagement & Control",
    order: 13,
  },
  {
    id: "m14_analytics_reports",
    label: "Analytics & Reports",
    icon: "BarChart3",
    path: "/analytics-reports/insights",
    requiredPermissions: ["analytics-reports.insights.view"],
    portalType: "school",
    group: "Intelligence",
    order: 14,
  },
  {
    id: "m15_audit_security",
    dot: true,
    label: "Audit & Security",
    icon: "ShieldCheck",
    path: "/audit-security/audit-log",
    requiredPermissions: ["audit-security.audit-log.view"],
    portalType: "school",
    group: "Intelligence",
    order: 15,
  },
  {
    id: "m16_sync_support",
    label: "Sync & Support",
    icon: "LifeBuoy",
    path: "/sync-support/sync",
    requiredPermissions: ["sync-support.sync.view"],
    portalType: "school",
    group: "System",
    order: 16,
  },
  {
    id: "sa_dashboard",
    label: "Command Center",
    icon: "LayoutDashboard",
    path: "/super-admin",
    requiredPermissions: ["sa.dashboard.view"],
    portalType: "super_admin",
    group: "Overview",
    order: 1,
  },
  {
    id: "sa_my_work",
    label: "My Work",
    icon: "ListChecks",
    path: "/super-admin/my-work",
    requiredPermissions: ["sa.my_work.view"],
    portalType: "super_admin",
    group: "Overview",
    order: 2,
  },
  {
    id: "sa_analytics",
    label: "Analytics & BI",
    icon: "BarChart3",
    path: "/super-admin/analytics",
    requiredPermissions: ["sa.analytics.view"],
    portalType: "super_admin",
    group: "Overview",
    order: 3,
  },
  {
    id: "sa_schools",
    label: "School Accounts",
    icon: "School",
    path: "/super-admin/schools",
    requiredPermissions: ["sa.schools.view"],
    portalType: "super_admin",
    group: "Schools & Revenue",
    order: 4,
  },
  {
    id: "sa_migration",
    label: "Onboarding & Migration",
    icon: "FolderInput",
    path: "/super-admin/migration",
    requiredPermissions: ["sa.migration.view"],
    portalType: "super_admin",
    group: "Schools & Revenue",
    order: 5,
  },
  {
    id: "sa_billing",
    label: "Subscriptions & Billing",
    icon: "CreditCard",
    path: "/super-admin/billing",
    requiredPermissions: ["sa.billing.view"],
    portalType: "super_admin",
    group: "Schools & Revenue",
    order: 6,
  },
  {
    id: "sa_partners",
    label: "Partners & Commission",
    icon: "Handshake",
    path: "/super-admin/partners",
    requiredPermissions: ["sa.partners.view"],
    portalType: "super_admin",
    group: "Schools & Revenue",
    order: 7,
  },
  {
    id: "sa_users",
    label: "Users",
    icon: "Users",
    path: "/super-admin/users",
    requiredPermissions: ["sa.users.view"],
    portalType: "super_admin",
    group: "Operations",
    order: 8,
  },
  {
    id: "sa_communications",
    label: "Communications",
    icon: "MessageSquareText",
    path: "/super-admin/communications",
    requiredPermissions: ["sa.communications.view"],
    portalType: "super_admin",
    group: "Operations",
    order: 9,
  },
  {
    id: "sa_support",
    label: "Support",
    icon: "LifeBuoy",
    path: "/super-admin/support",
    requiredPermissions: ["sa.support.view"],
    portalType: "super_admin",
    group: "Operations",
    badge: "openTicketsCount",
    order: 10,
  },
  {
    id: "sa_config_library",
    label: "Curriculum & Academics",
    icon: "Book",
    path: "/super-admin/config-library",
    requiredPermissions: ["sa.settings.view"],
    portalType: "super_admin",
    group: "Platform",
    order: 11,
  },
  {
    id: "sa_feature_flags",
    label: "Plans & Features",
    icon: "SlidersHorizontal",
    path: "/super-admin/feature-flags",
    requiredPermissions: ["sa.feature_flags.view"],
    portalType: "super_admin",
    group: "Platform",
    order: 12,
  },
  {
    id: "sa_system_health",
    label: "Infrastructure",
    icon: "Server",
    path: "/super-admin/system",
    requiredPermissions: ["sa.security.view"],
    portalType: "super_admin",
    group: "Platform",
    order: 13,
  },
  {
    id: "sa_security",
    label: "Security & Compliance",
    icon: "ShieldCheck",
    path: "/super-admin/security",
    requiredPermissions: ["sa.security.view"],
    portalType: "super_admin",
    group: "Trust & Control",
    order: 14,
  },
  {
    id: "sa_internal_team",
    label: "Team & Access",
    icon: "IdCard",
    path: "/super-admin/internal-team",
    requiredPermissions: ["sa.settings.view"],
    portalType: "super_admin",
    group: "Trust & Control",
    order: 15,
  },
  {
    id: "sa_audit_logs",
    label: "Audit Logs",
    icon: "FileClock",
    path: "/super-admin/audit-logs",
    requiredPermissions: ["sa.audit_logs.view"],
    portalType: "super_admin",
    group: "Trust & Control",
    hideFromSidebar: true,
    order: 15.5,
  },
  {
    id: "sa_crm",
    label: "CRM & Sales",
    icon: "Target",
    path: "/super-admin/crm",
    requiredPermissions: ["sa.crm.view"],
    portalType: "super_admin",
    group: "Schools & Revenue",
    hideFromSidebar: true,
    order: 7.5,
  },
  {
    id: "sa_settings",
    label: "Settings",
    icon: "Settings2",
    path: "/super-admin/settings",
    requiredPermissions: ["sa.settings.view"],
    portalType: "super_admin",
    group: "Platform",
    hideFromSidebar: true,
    order: 15.9,
  },
  {
    id: "sa_help",
    label: "Help",
    icon: "HelpCircle",
    path: "/super-admin/help",
    requiredPermissions: ["sa.help.view"],
    portalType: "super_admin",
    group: "Platform",
    hideFromSidebar: true,
    order: 15.95,
  },
  {
    id: "sa_standards",
    label: "Standards",
    icon: "BookOpen",
    path: "/super-admin/standards",
    requiredPermissions: ["sa.standards.view"],
    portalType: "super_admin",
    group: "Platform",
    hideFromSidebar: true,
    order: 15.96,
  },
  {
    id: "student_home",
    label: "Dashboard",
    icon: "LayoutDashboard",
    path: "/portals/student",
    requiredPermissions: [],
    portalType: "school",
    group: "Student Portal",
    order: 100,
  },
  {
    id: "student_profile",
    label: "My Profile",
    icon: "Users",
    path: "/portals/student/profile",
    requiredPermissions: [],
    portalType: "school",
    group: "Student Portal",
    order: 101,
  },
  {
    id: "student_attendance",
    label: "Attendance",
    icon: "ClipboardCheck",
    path: "/portals/student/attendance",
    requiredPermissions: ["attendance.view"],
    portalType: "school",
    group: "Student Portal",
    order: 102,
  },
  {
    id: "student_results",
    label: "Results",
    icon: "Award",
    path: "/portals/student/results",
    requiredPermissions: ["results.view"],
    portalType: "school",
    group: "Student Portal",
    order: 103,
  },
  {
    id: "student_curriculum_legacy",
    label: "Scheme of Work",
    icon: "BookOpen",
    path: "/portals/student/curriculum",
    requiredPermissions: [],
    portalType: "school",
    group: "Student Portal",
    hideFromSidebar: true,
    order: 104.1,
  },
  {
    id: "student_timetable",
    label: "Timetable",
    icon: "Calendar",
    path: "/portals/student/timetable",
    requiredPermissions: ["timetable.view"],
    portalType: "school",
    group: "Student Portal",
    order: 105,
  },
  {
    id: "student_assignments",
    label: "Assignments",
    icon: "FileText",
    path: "/portals/student/assignments",
    requiredPermissions: ["assignments.view"],
    portalType: "school",
    group: "Student Portal",
    order: 106,
  },
  {
    id: "student_fees",
    label: "Fees",
    icon: "CreditCard",
    path: "/portals/student/fees",
    requiredPermissions: ["fees.view"],
    portalType: "school",
    group: "Student Portal",
    order: 107,
  },
  {
    id: "student_services",
    label: "Services",
    icon: "Building2",
    path: "/portals/student/services",
    requiredPermissions: [],
    portalType: "school",
    group: "Student Portal",
    order: 108,
  },
  {
    id: "student_announcements",
    label: "Announcements",
    icon: "Megaphone",
    path: "/portals/student/announcements",
    requiredPermissions: ["announcements.view"],
    portalType: "school",
    group: "Student Portal",
    order: 109,
  },
  {
    id: "student_notifications",
    label: "Notifications",
    icon: "BellRing",
    path: "/portals/student/notifications",
    requiredPermissions: [],
    portalType: "school",
    group: "Student Portal",
    order: 110,
  },
  {
    id: "parent_home",
    label: "Dashboard",
    icon: "LayoutDashboard",
    path: "/portals/parent",
    requiredPermissions: [],
    portalType: "school",
    group: "Parent Portal",
    order: 120,
  },
  {
    id: "parent_children",
    label: "My Children",
    icon: "Users",
    path: "/portals/parent/children",
    requiredPermissions: [],
    portalType: "school",
    group: "Parent Portal",
    order: 121,
  },
  {
    id: "parent_announcements",
    label: "Announcements",
    icon: "Megaphone",
    path: "/portals/parent/announcements",
    requiredPermissions: ["announcements.view"],
    portalType: "school",
    group: "Parent Portal",
    order: 122,
  },
  {
    id: "parent_curriculum",
    label: "Scheme of Work",
    icon: "BookOpen",
    path: "/portals/parent/curriculum",
    requiredPermissions: [],
    portalType: "school",
    group: "Parent Portal",
    hideFromSidebar: true,
    order: 123,
  },
  {
    id: "parent_notifications",
    label: "Notifications",
    icon: "BellRing",
    path: "/portals/parent/notifications",
    requiredPermissions: [],
    portalType: "school",
    group: "Parent Portal",
    order: 124,
  },
  {
    id: "parent_profile",
    label: "Profile",
    icon: "Users",
    path: "/portals/parent/profile",
    requiredPermissions: [],
    portalType: "school",
    group: "Parent Portal",
    order: 125,
  },
];

/**
 * Staff no longer have portals of their own.
 *
 * The mockup puts every member of staff — proprietor, principal, exam officer,
 * bursar, form master, subject teacher alike — in one sixteen-module shell,
 * filtered by what their role template grants. Only students and guardians keep
 * a separate portal, because the shell publishes to those rather than replacing
 * them.
 */
const portalGroupsByRole: Partial<Record<Role, NavigationGroup>> = {
  STUDENT: "Student Portal",
  PARENT: "Parent Portal",
};

const portalOnlyRoles = new Set<Role>(["STUDENT", "PARENT"]);
const personalPortalGroups = new Set<NavigationGroup>(["Student Portal", "Parent Portal"]);

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

/**
 * A role's permissions: the sixteen-module grid the mockup defines, plus the
 * legacy domain keys the API and backend still check against.
 */
export function getDefaultPermissionsForRole(role: Role) {
  if (isPlatformRole(role)) return platformPermissionByRole[role] ?? [];
  return [...(systemRolePermissionKeys[role] ?? []), ...schoolPermissionsForRole(role)];
}

function permissionMatches(granted: Set<string>, required: string) {
  if (granted.has(required)) return true;
  const [namespace] = required.split(".");
  return granted.has(`${namespace}.*`) || granted.has("sa.*");
}

export function canAccessNavItem(
  item: NavigationRegistryItem,
  permissions: string[],
) {
  if (item.requiredPermissions.length === 0) return true;
  const granted = new Set(permissions);
  if (item.requireAny)
    return item.requiredPermissions.some((permission) =>
      permissionMatches(granted, permission),
    );
  return item.requiredPermissions.every((permission) =>
    permissionMatches(granted, permission),
  );
}

function canUseNavigationItemForRole(
  role: Role,
  item: NavigationRegistryItem,
  permissions: string[],
) {
  if (item.portalType === "super_admin")
    return isPlatformRole(role) && canAccessNavItem(item, permissions);
  if (item.portalType === "school" && isPlatformRole(role)) return false;

  if (item.path.startsWith("/portals/student")) {
    return role === "STUDENT" && canAccessNavItem(item, permissions);
  }
  if (item.path.startsWith("/portals/parent")) {
    return role === "PARENT" && canAccessNavItem(item, permissions);
  }

  // Students and guardians see their own portal and nothing else.
  const portalGroup = portalGroupsByRole[role];
  if (portalOnlyRoles.has(role))
    return item.group === portalGroup && canAccessNavItem(item, permissions);

  // Staff never see the personal portals.
  if (item.group === "Student Portal" || item.group === "Parent Portal") return false;

  return canAccessNavItem(item, permissions);
}

export function getNavigationItemForPath(path: string) {
  return (
    NAV_REGISTRY.filter(
      (item) => path === item.path || path.startsWith(`${item.path}/`),
    ).sort((left, right) => right.path.length - left.path.length)[0] ??
    schoolModuleItemForPath(path)
  );
}

/**
 * The nav item for a module tab.
 *
 * Only a module's first tab appears in the registry, because only the module
 * appears in the sidebar. Any other tab of it — `/attendance/compliance` —
 * resolves to that same item, since the mockup scopes access by module and by
 * action within it, never by tab.
 */
function schoolModuleItemForPath(path: string) {
  const moduleSlug = path.split("/")[1];
  if (!moduleSlug) return undefined;

  const module = getSchoolModule(moduleSlug);
  if (!module) return undefined;

  const tabSlug = path.split("/")[2];
  if (tabSlug && !module.tabs.some((tab) => tab.slug === tabSlug)) return undefined;

  return NAV_REGISTRY.find((item) => item.path.startsWith(`/${module.slug}/`));
}

function getNavigationItemsForPath(path: string) {
  const matches = NAV_REGISTRY.filter(
    (item) => path === item.path || path.startsWith(`${item.path}/`),
  ).sort((left, right) => right.path.length - left.path.length);
  const longestPathLength = matches[0]?.path.length;
  if (longestPathLength) {
    return matches.filter((item) => item.path.length === longestPathLength);
  }

  const moduleItem = schoolModuleItemForPath(path);
  return moduleItem ? [moduleItem] : [];
}

/**
 * "My account" is reached from the account menu, not the sidebar, so it has no
 * navigation entry to be checked against. It is not permission-gated either: it
 * is the page that tells someone what the school holds about *them*, and every
 * member of staff may open their own.
 */
function isOwnAccountPath(path: string) {
  return path === "/account" || path.startsWith("/account/");
}

export function canAccessPathWithPermissions(
  role: Role,
  path: string,
  permissions = getDefaultPermissionsForRole(role),
) {
  if (isOwnAccountPath(path)) return isSchoolStaffRole(role);

  const items = getNavigationItemsForPath(path);
  if (!items.length) return false;
  return items.some((item) =>
    canUseNavigationItemForRole(role, item, permissions),
  );
}

export function buildNavigation(
  portalType: PortalType,
  role: Role,
  permissions = getDefaultPermissionsForRole(role),
) {
  const items = NAV_REGISTRY.filter((item) => item.portalType === portalType)
    .filter((item) => {
      if (portalType === "super_admin") return isPlatformRole(role);
      return (
        !item.group ||
        !personalPortalGroups.has(item.group) ||
        Boolean(portalGroupsByRole[role])
      );
    })
    .filter((item) => !item.hideFromSidebar)
    .filter((item) => canUseNavigationItemForRole(role, item, permissions))
    .sort((left, right) => left.order - right.order);

  const groups = new Map<string, NavigationRegistryItem[]>();
  for (const item of items) {
    const group = item.group ?? "Start Here";
    groups.set(group, [...(groups.get(group) ?? []), item]);
  }

  return Array.from(groups.entries()).map(([title, groupItems]) => ({
    title,
    items: groupItems,
  }));
}
