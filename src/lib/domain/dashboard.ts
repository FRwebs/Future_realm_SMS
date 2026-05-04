import { canAccessPath, hasRole } from "@/lib/auth/roles";
import type { DashboardQuickAction, Role } from "@/lib/domain/types";

const financeManagers: Role[] = ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "ADMIN_OFFICER", "BURSAR", "ACCOUNTANT", "ACCOUNT_OFFICER"];
const academicLeaders: Role[] = [
  "SUPER_ADMIN",
  "SCHOOL_OWNER",
  "PROPRIETOR",
  "ADMINISTRATOR",
  "PRINCIPAL",
  "HEAD_TEACHER",
  "VICE_PRINCIPAL_ACADEMICS",
  "EXAM_OFFICER",
  "EXAMINATION_OFFICER",
  "HEAD_OF_DEPARTMENT",
  "CLASS_TEACHER",
  "TEACHER",
  "SUBJECT_TEACHER"
];

const adminOperators: Role[] = [
  "SCHOOL_OWNER",
  "PROPRIETOR",
  "ADMINISTRATOR",
  "PRINCIPAL",
  "HEAD_TEACHER",
  "VICE_PRINCIPAL_ADMINISTRATION",
  "VICE_PRINCIPAL_SPECIAL_DUTIES",
  "ADMIN_OFFICER",
  "HR_OFFICER",
  "RECEPTIONIST",
  "ATTENDANCE_OFFICER"
];

const welfareOperators: Role[] = [
  "GUIDANCE_COUNSELOR",
  "GUIDANCE_COUNSELLOR",
  "SCHOOL_NURSE",
  "NURSE",
  "HOSTEL_MANAGER",
  "HOSTEL_MASTER",
  "HOSTEL_MATRON",
  "HOSTEL_MISTRESS",
  "TRANSPORT_COORDINATOR",
  "TRANSPORT_MANAGER",
  "LIBRARIAN",
  "ICT_CBT_ADMIN",
  "IT_ADMINISTRATOR",
  "STORE_OFFICER",
  "SECURITY_OFFICER",
  "MAINTENANCE_OFFICER"
];

type RoleDashboardProfile = {
  eyebrow: string;
  mission: string;
  focus: string[];
  commandTitle: string;
  commandDescription: string;
  insightTitle: string;
  insightDescription: string;
  spotlightTitle: string;
  spotlightDescription: string;
};

const executiveProfile: RoleDashboardProfile = {
  eyebrow: "Executive command center",
  mission: "Keep the whole school healthy across enrollment, finance, academics, staff, and risk.",
  focus: ["School health", "Revenue exposure", "Academic readiness", "Operational risk"],
  commandTitle: "Executive priorities",
  commandDescription: "High-impact decisions that affect parents, cashflow, compliance, and school reputation.",
  insightTitle: "School intelligence",
  insightDescription: "Attendance, fees, and admissions signals for leadership review.",
  spotlightTitle: "School health snapshot",
  spotlightDescription: "The most important operational signals visible to your leadership role."
};

const dashboardProfiles: Partial<Record<Role, RoleDashboardProfile>> = {
  SCHOOL_OWNER: executiveProfile,
  PROPRIETOR: executiveProfile,
  PRINCIPAL: {
    eyebrow: "Principal operations cockpit",
    mission: "Keep today’s school operations moving: attendance, approvals, welfare, results, and parent communication.",
    focus: ["Daily attendance", "Pending approvals", "Result publishing", "Welfare alerts"],
    commandTitle: "Principal decisions",
    commandDescription: "Items that need school leadership attention before they become operational risk.",
    insightTitle: "Daily school pulse",
    insightDescription: "Attendance, admissions, and academic readiness at a glance.",
    spotlightTitle: "Leadership snapshot",
    spotlightDescription: "A concise view of what is healthy, pending, or drifting today."
  },
  HEAD_TEACHER: {
    eyebrow: "Head teacher command center",
    mission: "Coordinate teachers, pupils, attendance, parent communication, and class-level academic routines.",
    focus: ["Class health", "Teacher readiness", "Parent communication", "Learner support"],
    commandTitle: "Primary school priorities",
    commandDescription: "The routines that keep classroom operations consistent and parent-facing work clear.",
    insightTitle: "School-day pulse",
    insightDescription: "Attendance, admissions, and academic trend signals for the current term.",
    spotlightTitle: "Teaching readiness",
    spotlightDescription: "Staff, classes, subjects, and academic readiness indicators."
  },
  VICE_PRINCIPAL_ACADEMICS: {
    eyebrow: "Academic command center",
    mission: "Monitor scheme coverage, timetable readiness, score entry, broadsheets, assessments, and result publication.",
    focus: ["Scheme coverage", "Broadsheet workflow", "Timetable coverage", "Subject performance"],
    commandTitle: "Academic actions",
    commandDescription: "Academic workflows that need review before results and lesson delivery are affected.",
    insightTitle: "Academic intelligence",
    insightDescription: "Teaching coverage, assessment readiness, and class performance signals.",
    spotlightTitle: "Academic readiness",
    spotlightDescription: "Classes, subjects, schemes of work, and result status for the active term."
  },
  EXAM_OFFICER: {
    eyebrow: "Exams and results cockpit",
    mission: "Drive score-entry completeness, broadsheet review, exam readiness, approvals, and publishing discipline.",
    focus: ["Missing scores", "Broadsheet progress", "Exam timetable", "Publishing readiness"],
    commandTitle: "Exam office queue",
    commandDescription: "Result and exam workflow items that must be resolved before publication.",
    insightTitle: "Assessment intelligence",
    insightDescription: "Completion, publication, and upcoming exam signals for the academic office.",
    spotlightTitle: "Result lifecycle",
    spotlightDescription: "Draft, review, approval, and publishing indicators that determine readiness."
  },
  EXAMINATION_OFFICER: {
    eyebrow: "Exams and results cockpit",
    mission: "Drive score-entry completeness, broadsheet review, exam readiness, approvals, and publishing discipline.",
    focus: ["Missing scores", "Broadsheet progress", "Exam timetable", "Publishing readiness"],
    commandTitle: "Exam office queue",
    commandDescription: "Result and exam workflow items that must be resolved before publication.",
    insightTitle: "Assessment intelligence",
    insightDescription: "Completion, publication, and upcoming exam signals for the academic office.",
    spotlightTitle: "Result lifecycle",
    spotlightDescription: "Draft, review, approval, and publishing indicators that determine readiness."
  },
  HEAD_OF_DEPARTMENT: {
    eyebrow: "Department cockpit",
    mission: "Track department subjects, teachers, scheme coverage, class performance, and pending academic actions.",
    focus: ["Department coverage", "Teacher ownership", "Subject readiness", "Class performance"],
    commandTitle: "Department priorities",
    commandDescription: "Academic follow-ups that keep the department aligned with the current term plan.",
    insightTitle: "Department intelligence",
    insightDescription: "Coverage, result readiness, and subject activity trends.",
    spotlightTitle: "Department readiness",
    spotlightDescription: "Class, subject, result, and SOW signals filtered for academic oversight."
  },
  CLASS_TEACHER: {
    eyebrow: "Class teacher workspace",
    mission: "Run your class day: attendance, timetable, learner welfare, parent follow-up, and class result readiness.",
    focus: ["Class attendance", "Learner welfare", "Parent follow-up", "Class records"],
    commandTitle: "Class teacher queue",
    commandDescription: "The daily actions that keep your class records and parent communication up to date.",
    insightTitle: "Class operating pulse",
    insightDescription: "Attendance, academic readiness, and student support signals.",
    spotlightTitle: "Class readiness",
    spotlightDescription: "A compact summary of learners, assigned subjects, and pending class actions."
  },
  SUBJECT_TEACHER: {
    eyebrow: "Teacher teaching cockpit",
    mission: "Focus on today’s classes, assigned subjects, SOW progress, attendance, assignments, and score entry.",
    focus: ["Today’s timetable", "SOW progress", "Score entry", "Assignments"],
    commandTitle: "Teaching queue",
    commandDescription: "The tasks most likely to block lesson delivery or score submission.",
    insightTitle: "Teaching intelligence",
    insightDescription: "Timetable, coverage, and result-entry signals for your assigned classes.",
    spotlightTitle: "Teaching scope",
    spotlightDescription: "Your assigned classes, subjects, learners, and score sheets."
  },
  TEACHER: {
    eyebrow: "Teacher teaching cockpit",
    mission: "Focus on today’s classes, assigned subjects, SOW progress, attendance, assignments, and score entry.",
    focus: ["Today’s timetable", "SOW progress", "Score entry", "Assignments"],
    commandTitle: "Teaching queue",
    commandDescription: "The tasks most likely to block lesson delivery or score submission.",
    insightTitle: "Teaching intelligence",
    insightDescription: "Timetable, coverage, and result-entry signals for your assigned classes.",
    spotlightTitle: "Teaching scope",
    spotlightDescription: "Your assigned classes, subjects, learners, and score sheets."
  },
  BURSAR: {
    eyebrow: "Bursar finance cockpit",
    mission: "Control collections, outstanding balances, overdue invoices, receipts, and fee follow-up.",
    focus: ["Collections", "Outstanding fees", "Receipts", "Overdue balances"],
    commandTitle: "Finance queue",
    commandDescription: "Fee and payment work that affects cashflow, parent follow-up, and clearance.",
    insightTitle: "Finance intelligence",
    insightDescription: "Collection trend, outstanding exposure, and recent payment movement.",
    spotlightTitle: "Cashflow snapshot",
    spotlightDescription: "Outstanding fees, recent payments, invoices, and finance exceptions."
  },
  ACCOUNTANT: {
    eyebrow: "Accounts cockpit",
    mission: "Track collections, balances, reconciliation signals, receipts, and finance reporting.",
    focus: ["Collections", "Receipts", "Reconciliation", "Reports"],
    commandTitle: "Accounts queue",
    commandDescription: "Finance operations that need accounting review or follow-up.",
    insightTitle: "Finance intelligence",
    insightDescription: "Collection trend, outstanding exposure, and recent payment movement.",
    spotlightTitle: "Accounts snapshot",
    spotlightDescription: "Cashflow, recent payments, and outstanding balance indicators."
  },
  ACCOUNT_OFFICER: {
    eyebrow: "Accounts support cockpit",
    mission: "Support fee collection, receipts, parent follow-up, and invoice accuracy.",
    focus: ["Invoices", "Receipts", "Parent follow-up", "Balances"],
    commandTitle: "Finance support queue",
    commandDescription: "Payment and invoice tasks that need action today.",
    insightTitle: "Collections intelligence",
    insightDescription: "Collection and balance movement visible to accounts support.",
    spotlightTitle: "Payment support snapshot",
    spotlightDescription: "Recent collections, outstanding balances, and payment activity."
  },
  ADMISSIONS_OFFICER: {
    eyebrow: "Admissions pipeline cockpit",
    mission: "Move applicants from inquiry to screening, approval, offer, clearance, and enrollment.",
    focus: ["Pipeline stages", "Pending reviews", "Offers", "Enrollment conversion"],
    commandTitle: "Admissions queue",
    commandDescription: "Applicant records that need document checks, screening, approval, or enrollment action.",
    insightTitle: "Admissions intelligence",
    insightDescription: "Pipeline stages and conversion pressure for the current intake.",
    spotlightTitle: "Pipeline snapshot",
    spotlightDescription: "Applications in progress, approvals, and recent admissions activity."
  },
  VICE_PRINCIPAL_ADMINISTRATION: {
    eyebrow: "Administration operations cockpit",
    mission: "Coordinate staff operations, attendance, compliance, events, welfare, facilities, and daily admin routines.",
    focus: ["Staff operations", "Attendance", "Compliance", "Front-office load"],
    commandTitle: "Admin operations queue",
    commandDescription: "Administrative tasks that keep the school day orderly and compliant.",
    insightTitle: "Operations intelligence",
    insightDescription: "Staff, attendance, admissions, and operational trend signals.",
    spotlightTitle: "Operations snapshot",
    spotlightDescription: "Staff readiness, attendance, and admin workload indicators."
  },
  ADMINISTRATOR: {
    eyebrow: "School administration cockpit",
    mission: "Coordinate students, staff, admissions, records, permissions, communication, and daily admin workflows.",
    focus: ["Records", "Admissions", "Staff", "Communication"],
    commandTitle: "Admin queue",
    commandDescription: "School administration work that needs attention across records and workflows.",
    insightTitle: "Operations intelligence",
    insightDescription: "Enrollment, attendance, admissions, and staff signals.",
    spotlightTitle: "Admin snapshot",
    spotlightDescription: "Student, staff, class, and operational metrics for the active term."
  },
  ADMIN_OFFICER: {
    eyebrow: "Admin officer cockpit",
    mission: "Process student records, admissions, parents, documents, and daily school-office workflows.",
    focus: ["Student records", "Admissions", "Parent records", "Documents"],
    commandTitle: "Admin officer queue",
    commandDescription: "Records and workflow items that keep the school office current.",
    insightTitle: "Office intelligence",
    insightDescription: "Enrollment, attendance, admissions, and communication signals.",
    spotlightTitle: "Office snapshot",
    spotlightDescription: "Student, class, parent, and admission workload indicators."
  },
  GUIDANCE_COUNSELOR: {
    eyebrow: "Welfare and counselling cockpit",
    mission: "Monitor welfare flags, counselling follow-ups, parent touchpoints, discipline referrals, and learner wellbeing.",
    focus: ["Flagged students", "Counselling follow-up", "Parent meetings", "Welfare referrals"],
    commandTitle: "Welfare queue",
    commandDescription: "Student-support actions that need timely follow-up and parent communication.",
    insightTitle: "Wellbeing intelligence",
    insightDescription: "Attendance, welfare, and student-support signals for counselling work.",
    spotlightTitle: "Wellbeing snapshot",
    spotlightDescription: "Students, attendance patterns, and support activity visible to your role."
  },
  GUIDANCE_COUNSELLOR: {
    eyebrow: "Welfare and counselling cockpit",
    mission: "Monitor welfare flags, counselling follow-ups, parent touchpoints, discipline referrals, and learner wellbeing.",
    focus: ["Flagged students", "Counselling follow-up", "Parent meetings", "Welfare referrals"],
    commandTitle: "Welfare queue",
    commandDescription: "Student-support actions that need timely follow-up and parent communication.",
    insightTitle: "Wellbeing intelligence",
    insightDescription: "Attendance, welfare, and student-support signals for counselling work.",
    spotlightTitle: "Wellbeing snapshot",
    spotlightDescription: "Students, attendance patterns, and support activity visible to your role."
  },
  LIBRARIAN: {
    eyebrow: "Library operations cockpit",
    mission: "Track library users, reading activity, overdue follow-ups, resources, and student borrowing behaviour.",
    focus: ["Loans", "Overdue books", "Reading activity", "Inventory"],
    commandTitle: "Library queue",
    commandDescription: "Resource and borrower follow-ups that keep the library useful and accountable.",
    insightTitle: "Learning-resource intelligence",
    insightDescription: "Student activity, communication, and support signals around library operations.",
    spotlightTitle: "Library snapshot",
    spotlightDescription: "Learner and staff context for library support operations."
  },
  RECEPTIONIST: {
    eyebrow: "Front desk cockpit",
    mission: "Handle visitors, parent inquiries, student pickup context, announcements, and quick contact lookup.",
    focus: ["Visitors", "Parent contacts", "Appointments", "Announcements"],
    commandTitle: "Front desk queue",
    commandDescription: "The practical front-office actions needed to support families and visitors.",
    insightTitle: "Front-office intelligence",
    insightDescription: "Attendance, contacts, admissions, and communication signals for reception.",
    spotlightTitle: "Front desk snapshot",
    spotlightDescription: "Student, parent, and communication context for daily reception work."
  },
  TRANSPORT_COORDINATOR: {
    eyebrow: "Transport cockpit",
    mission: "Track routes, assigned students, route incidents, transport attendance, and parent follow-ups.",
    focus: ["Routes", "Assigned riders", "Vehicle issues", "Parent alerts"],
    commandTitle: "Transport queue",
    commandDescription: "Route and student movement issues that need follow-up today.",
    insightTitle: "Transport intelligence",
    insightDescription: "Student movement, attendance, and operations signals for transport management.",
    spotlightTitle: "Transport snapshot",
    spotlightDescription: "Learner, attendance, and operational context for route oversight."
  },
  TRANSPORT_MANAGER: {
    eyebrow: "Transport cockpit",
    mission: "Track routes, assigned students, route incidents, transport attendance, and parent follow-ups.",
    focus: ["Routes", "Assigned riders", "Vehicle issues", "Parent alerts"],
    commandTitle: "Transport queue",
    commandDescription: "Route and student movement issues that need follow-up today.",
    insightTitle: "Transport intelligence",
    insightDescription: "Student movement, attendance, and operations signals for transport management.",
    spotlightTitle: "Transport snapshot",
    spotlightDescription: "Learner, attendance, and operational context for route oversight."
  },
  HOSTEL_MANAGER: {
    eyebrow: "Hostel operations cockpit",
    mission: "Monitor occupancy, boarding welfare, room allocation, incidents, and parent follow-up.",
    focus: ["Occupancy", "Boarding welfare", "Room allocation", "Incidents"],
    commandTitle: "Hostel queue",
    commandDescription: "Boarding-life issues that need action before they affect welfare or safety.",
    insightTitle: "Hostel intelligence",
    insightDescription: "Student, attendance, and welfare signals for boarding operations.",
    spotlightTitle: "Hostel snapshot",
    spotlightDescription: "Learner and welfare indicators for hostel oversight."
  },
  HOSTEL_MASTER: {
    eyebrow: "Hostel operations cockpit",
    mission: "Monitor occupancy, boarding welfare, room allocation, incidents, and parent follow-up.",
    focus: ["Occupancy", "Boarding welfare", "Room allocation", "Incidents"],
    commandTitle: "Hostel queue",
    commandDescription: "Boarding-life issues that need action before they affect welfare or safety.",
    insightTitle: "Hostel intelligence",
    insightDescription: "Student, attendance, and welfare signals for boarding operations.",
    spotlightTitle: "Hostel snapshot",
    spotlightDescription: "Learner and welfare indicators for hostel oversight."
  },
  HOSTEL_MATRON: {
    eyebrow: "Hostel matron cockpit",
    mission: "Monitor boarding welfare, room routines, incidents, health flags, and parent follow-up.",
    focus: ["Boarding welfare", "Room routines", "Health flags", "Incidents"],
    commandTitle: "Hostel welfare queue",
    commandDescription: "Boarding student issues that need action before they affect wellbeing.",
    insightTitle: "Hostel welfare intelligence",
    insightDescription: "Student, attendance, and welfare signals for boarding operations.",
    spotlightTitle: "Hostel welfare snapshot",
    spotlightDescription: "Learner and welfare indicators for hostel oversight."
  },
  HOSTEL_MISTRESS: {
    eyebrow: "Hostel welfare cockpit",
    mission: "Monitor boarding welfare, room routines, incidents, health flags, and parent follow-up.",
    focus: ["Boarding welfare", "Room routines", "Health flags", "Incidents"],
    commandTitle: "Hostel welfare queue",
    commandDescription: "Boarding student issues that need action before they affect wellbeing.",
    insightTitle: "Hostel welfare intelligence",
    insightDescription: "Student, attendance, and welfare signals for boarding operations.",
    spotlightTitle: "Hostel welfare snapshot",
    spotlightDescription: "Learner and welfare indicators for hostel oversight."
  },
  SCHOOL_NURSE: {
    eyebrow: "Health office cockpit",
    mission: "Monitor clinic visits, medical follow-ups, attendance-linked health flags, and emergency readiness.",
    focus: ["Clinic cases", "Medication follow-up", "Health flags", "Emergency readiness"],
    commandTitle: "Health queue",
    commandDescription: "Student health and clinic follow-ups that need attention today.",
    insightTitle: "Health intelligence",
    insightDescription: "Attendance, student, and welfare signals for the health office.",
    spotlightTitle: "Sick bay snapshot",
    spotlightDescription: "Health, attendance, and learner indicators visible to your role."
  },
  NURSE: {
    eyebrow: "Health office cockpit",
    mission: "Monitor clinic visits, medical follow-ups, attendance-linked health flags, and emergency readiness.",
    focus: ["Clinic cases", "Medication follow-up", "Health flags", "Emergency readiness"],
    commandTitle: "Health queue",
    commandDescription: "Student health and clinic follow-ups that need attention today.",
    insightTitle: "Health intelligence",
    insightDescription: "Attendance, student, and welfare signals for the health office.",
    spotlightTitle: "Sick bay snapshot",
    spotlightDescription: "Health, attendance, and learner indicators visible to your role."
  },
  IT_ADMINISTRATOR: {
    eyebrow: "ICT administration cockpit",
    mission: "Manage accounts, permissions, integrations, data access, and technical support readiness.",
    focus: ["User accounts", "Permissions", "Integrations", "Data safety"],
    commandTitle: "ICT support queue",
    commandDescription: "Technical and access-management items that keep the SMS operational.",
    insightTitle: "System intelligence",
    insightDescription: "Usage, records, permissions, and operational support signals.",
    spotlightTitle: "Systems snapshot",
    spotlightDescription: "User, staff, and configuration indicators for technical administration."
  },
  ICT_CBT_ADMIN: {
    eyebrow: "ICT and CBT cockpit",
    mission: "Manage accounts, CBT readiness, permissions, integrations, and technical support tasks.",
    focus: ["CBT readiness", "User accounts", "Permissions", "Technical flags"],
    commandTitle: "ICT/CBT queue",
    commandDescription: "Technical and assessment-platform tasks that keep digital learning stable.",
    insightTitle: "System intelligence",
    insightDescription: "Usage, records, permissions, and operational support signals.",
    spotlightTitle: "ICT snapshot",
    spotlightDescription: "User, staff, and configuration indicators for ICT administration."
  }
};

export function getRoleDashboardProfile(role: Role): RoleDashboardProfile {
  return dashboardProfiles[role] ?? {
    eyebrow: hasRole(role, welfareOperators) ? "Operations cockpit" : "School operations cockpit",
    mission: "Stay focused on the workflows, records, alerts, and follow-ups attached to your school role.",
    focus: ["Today’s work", "Pending actions", "Records", "Communication"],
    commandTitle: "Priority queue",
    commandDescription: "Role-filtered work items and alerts that need attention.",
    insightTitle: "Operational intelligence",
    insightDescription: "School signals available to your role and permissions.",
    spotlightTitle: "Role snapshot",
    spotlightDescription: "The most relevant metrics available for your current access level."
  };
}

export function canSeeDashboardWidget(role: Role, widget: "finance" | "admissions" | "academics" | "attendance" | "staff" | "system") {
  if (widget === "finance") return hasRole(role, financeManagers) || role === "PRINCIPAL";
  if (widget === "admissions") return hasRole(role, ["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "ADMISSIONS_OFFICER"]);
  if (widget === "academics") return hasRole(role, academicLeaders) || role === "ADMIN_OFFICER";
  if (widget === "attendance") return hasRole(role, academicLeaders) || hasRole(role, adminOperators) || hasRole(role, welfareOperators);
  if (widget === "staff") return hasRole(role, ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "VICE_PRINCIPAL_ADMINISTRATION", "ADMIN_OFFICER", "HR_OFFICER", "IT_ADMINISTRATOR", "ICT_CBT_ADMIN"]);
  return hasRole(role, ["SUPER_ADMIN", "SCHOOL_OWNER"]);
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
      roleScope: ["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER", "ATTENDANCE_OFFICER"]
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
    },
    {
      label: "Open broadsheets",
      href: "/academics/results/broadsheets",
      description: "Review class-wide results, missing scores, approvals, and publication readiness.",
      roleScope: ["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "EXAM_OFFICER", "EXAMINATION_OFFICER", "HEAD_OF_DEPARTMENT"]
    },
    {
      label: "Manage subjects",
      href: "/subjects",
      description: "Inspect subjects, teacher coverage, and scheme-of-work readiness.",
      roleScope: ["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ACADEMICS", "HEAD_OF_DEPARTMENT", "ADMIN_OFFICER"]
    },
    {
      label: "Lesson notes",
      href: "/portals/teacher/content/lesson-notes/planning",
      description: "Open teaching lanes, planning notes, and curriculum-linked lesson flow.",
      roleScope: ["TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER"]
    },
    {
      label: "Staff workspace",
      href: "/school/staff",
      description: "Review staff records, assignments, and operational staff context.",
      roleScope: ["SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "VICE_PRINCIPAL_ADMINISTRATION", "ADMIN_OFFICER", "HR_OFFICER", "IT_ADMINISTRATOR", "ICT_CBT_ADMIN", "LIBRARIAN"]
    },
    {
      label: "Operations hub",
      href: "/operations",
      description: "Open front desk, welfare, assets, exams, and school operations workspaces.",
      roleScope: [...adminOperators, ...welfareOperators]
    },
    {
      label: "Parents directory",
      href: "/parents",
      description: "Find parent/guardian contacts and family context for follow-up.",
      roleScope: ["SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "ADMIN_OFFICER", "CLASS_TEACHER", "GUIDANCE_COUNSELOR", "GUIDANCE_COUNSELLOR", "BURSAR", "ACCOUNTANT", "ACCOUNT_OFFICER", "ADMISSIONS_OFFICER", "RECEPTIONIST"]
    },
    {
      label: "System settings",
      href: "/school/configuration",
      description: "Open school configuration, role-sensitive settings, and operational setup.",
      roleScope: ["SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "ADMIN_OFFICER", "IT_ADMINISTRATOR", "ICT_CBT_ADMIN"]
    }
  ];

  return actions.filter((action) => action.roleScope && hasRole(role, action.roleScope) && canAccessPath(role, action.href));
}
