import type { Role } from "@/lib/domain/types";

export interface PermissionDefinition {
  key: string;
  module: string;
  label: string;
  description: string;
}

type PermissionModule = {
  module: string;
  permissions: Array<Omit<PermissionDefinition, "module">>;
};

function labelFromKey(key: string) {
  return key
    .split(".")[1]
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function permission(key: string, description: string): Omit<PermissionDefinition, "module"> {
  return { key, label: labelFromKey(key), description };
}

export const permissionModules: PermissionModule[] = [
  {
    module: "Students",
    permissions: [
      permission("students.view", "View student records and profiles."),
      permission("students.create", "Create new student records."),
      permission("students.edit", "Edit student biodata and academic records."),
      permission("students.delete", "Soft-delete or deactivate student records."),
      permission("students.export", "Export student data."),
      permission("students.promote", "Run student promotion workflows."),
      permission("students.transfer", "Transfer students between classes or schools."),
      permission("students.reset_password", "Reset student portal passwords.")
    ]
  },
  {
    module: "Teachers",
    permissions: [
      permission("teachers.view", "View teacher records and activity."),
      permission("teachers.create", "Create teacher accounts."),
      permission("teachers.edit", "Edit teacher profiles and assignments."),
      permission("teachers.delete", "Soft-delete teacher records."),
      permission("teachers.export", "Export teacher data.")
    ]
  },
  {
    module: "Parents",
    permissions: [
      permission("parents.view", "View parent and guardian records."),
      permission("parents.create", "Create parent and guardian accounts."),
      permission("parents.edit", "Edit parent and guardian records."),
      permission("parents.delete", "Soft-delete parent and guardian records.")
    ]
  },
  {
    module: "Profiles",
    permissions: [
      permission("profiles.view_self", "View your own profile."),
      permission("profiles.update_self", "Update safe self-service profile fields."),
      permission("profiles.request_edit_self", "Submit profile correction requests for sensitive fields."),
      permission("profiles.change_password_self", "Change your own password."),
      permission("profiles.change_email_self", "Request or change your own login email."),
      permission("profiles.view", "View other user profiles within the school."),
      permission("profiles.create", "Create profile records."),
      permission("profiles.update", "Update other user profiles."),
      permission("profiles.delete", "Archive profile records."),
      permission("profiles.manage_status", "Activate, deactivate, suspend, or reinstate profiles."),
      permission("profiles.review_edit_requests", "Approve or reject profile edit requests."),
      permission("profiles.view_documents", "View profile documents."),
      permission("profiles.upload_documents", "Upload profile documents."),
      permission("profiles.delete_documents", "Delete or archive profile documents."),
      permission("profiles.view_login_history", "View profile login history.")
    ]
  },
  {
    module: "Fees",
    permissions: [
      permission("fees.view", "View invoices, balances, and payments."),
      permission("fees.create", "Create fee structures and invoices."),
      permission("fees.edit", "Edit fee structures and invoice metadata."),
      permission("fees.delete", "Cancel or soft-delete finance records."),
      permission("fees.collect", "Record fee payments."),
      permission("fees.pay_online", "Start authorized online payment handoff."),
      permission("fees.create_receipt", "Generate official receipts."),
      permission("fees.edit_payment", "Edit payment metadata through controlled audit flow."),
      permission("fees.approve", "Approve financial actions."),
      permission("fees.export", "Export finance reports."),
      permission("fees.waive", "Apply approved waivers."),
      permission("fees.apply_waiver", "Apply approved student waivers and scholarships."),
      permission("fees.send_reminder", "Send fee reminders to parents and guardians."),
      permission("fees.refund", "Record refunds and reversals.")
    ]
  },
  {
    module: "Results & Grades",
    permissions: [
      permission("results.view", "View results and grades."),
      permission("results.create", "Create score sheets and result records."),
      permission("results.edit", "Edit draft scores and results."),
      permission("results.delete", "Soft-delete draft result records."),
      permission("results.compile", "Compile class, subject, or department results."),
      permission("results.approve", "Approve moderated results."),
      permission("results.publish", "Publish results to portals."),
      permission("results.export", "Export result sheets, broadsheets, and reports.")
    ]
  },
  {
    module: "Timetable",
    permissions: [
      permission("timetable.view", "View class, teacher, and exam timetables."),
      permission("timetable.view_all", "View all class timetable setup status and conflict checks."),
      permission("timetable.create", "Create timetable entries."),
      permission("timetable.edit", "Edit timetable entries."),
      permission("timetable.delete", "Delete timetable entries."),
      permission("timetable.publish", "Publish timetables.")
    ]
  },
  {
    module: "Configuration",
    permissions: [
      permission("config.manage", "Manage all school configuration areas."),
      permission("config.sessions_terms.view", "View academic sessions and terms."),
      permission("config.sessions_terms.create", "Create academic sessions and terms."),
      permission("config.sessions_terms.update", "Update academic sessions and terms."),
      permission("config.sessions_terms.delete", "Delete unused academic sessions and terms."),
      permission("config.sessions_terms.manage", "Set active academic sessions and terms."),
      permission("config.school_information.view", "View school profile configuration."),
      permission("config.school_information.update", "Update school profile configuration."),
      permission("config.class_levels.view", "View class level configuration."),
      permission("config.class_levels.create", "Create class levels."),
      permission("config.class_levels.update", "Update class levels."),
      permission("config.class_levels.delete", "Delete unused class levels."),
      permission("config.class_arms.view", "View class arm configuration."),
      permission("config.class_arms.create", "Create class arms."),
      permission("config.class_arms.update", "Update class arms."),
      permission("config.class_arms.delete", "Delete class arms."),
      permission("config.class_arms.manage", "Activate, deactivate, or reorder class arms."),
      permission("config.school_calendar.view", "View school calendar configuration."),
      permission("config.school_calendar.create", "Create school calendar events."),
      permission("config.school_calendar.update", "Update school calendar events."),
      permission("config.school_calendar.delete", "Delete school calendar events."),
      permission("config.admissions.view", "View admissions configuration."),
      permission("config.admissions.update", "Update admissions configuration."),
      permission("config.admissions.manage", "Manage admissions workflow configuration."),
      permission("config.finance.view", "View finance configuration."),
      permission("config.finance.update", "Update finance configuration."),
      permission("config.payment_settings.view", "View payment settings."),
      permission("config.payment_settings.update", "Update payment settings."),
      permission("config.payment_settings.manage", "Manage payment settings."),
      permission("config.fees.view", "View fees configuration."),
      permission("config.fees.create", "Create fees configuration."),
      permission("config.fees.update", "Update fees configuration."),
      permission("config.fees.delete", "Archive fees configuration."),
      permission("config.chart_of_accounts.view", "View chart of accounts."),
      permission("config.chart_of_accounts.create", "Create chart of accounts entries."),
      permission("config.chart_of_accounts.update", "Update chart of accounts entries."),
      permission("config.chart_of_accounts.delete", "Archive chart of accounts entries."),
      permission("config.expense_items.view", "View expense items."),
      permission("config.expense_items.create", "Create expense items."),
      permission("config.expense_items.update", "Update expense items."),
      permission("config.expense_items.delete", "Archive expense items."),
      permission("config.inventory_settings.view", "View inventory settings."),
      permission("config.inventory_settings.update", "Update inventory settings."),
      permission("config.payroll_settings.view", "View payroll settings."),
      permission("config.payroll_settings.update", "Update payroll settings."),
      permission("config.subjects.view", "View subject configuration."),
      permission("config.subjects.create", "Create subjects."),
      permission("config.subjects.update", "Update subjects."),
      permission("config.subjects.delete", "Delete unused subjects."),
      permission("config.performance_configuration.view", "View performance configuration."),
      permission("config.performance_configuration.update", "Update performance configuration."),
      permission("config.performance_configuration.manage", "Manage performance configuration."),
      permission("config.report_templates.view", "View report templates."),
      permission("config.report_templates.create", "Create report templates."),
      permission("config.report_templates.update", "Update report templates."),
      permission("config.report_templates.delete", "Archive report templates."),
      permission("config.report_templates.manage", "Set default report templates."),
      permission("config.promotions.view", "View promotion settings."),
      permission("config.promotions.update", "Update promotion settings."),
      permission("config.promotions.manage", "Manage promotion settings."),
      permission("config.exam.view", "View exam settings."),
      permission("config.exam.update", "Update exam settings."),
      permission("config.exam.manage", "Manage exam settings."),
      permission("config.attendance.view", "View attendance settings."),
      permission("config.attendance.update", "Update attendance settings."),
      permission("config.attendance.manage", "Manage attendance settings."),
      permission("config.id_card.view", "View ID card settings."),
      permission("config.id_card.update", "Update ID card settings."),
      permission("config.id_card.manage", "Manage ID card settings."),
      permission("config.messaging.view", "View messaging settings."),
      permission("config.messaging.update", "Update messaging settings."),
      permission("config.messaging.manage", "Manage messaging settings."),
      permission("config.login_history.view", "View login history."),
      permission("config.login_history.export", "Export login history.")
    ]
  },
  {
    module: "Attendance",
    permissions: [
      permission("attendance.view", "View attendance records and summaries."),
      permission("attendance.mark", "Mark attendance."),
      permission("attendance.log_late_arrival", "Log late arrivals at the front desk."),
      permission("attendance.log_early_departure", "Log early departures at the front desk."),
      permission("attendance.edit", "Edit attendance records."),
      permission("attendance.export", "Export attendance reports."),
      permission("attendance.approve", "Approve attendance corrections.")
    ]
  },
  {
    module: "Classes",
    permissions: [
      permission("classes.view", "View classes and arms."),
      permission("classes.create", "Create classes and arms."),
      permission("classes.edit", "Edit classes and arms."),
      permission("classes.delete", "Delete or archive classes."),
      permission("classes.assign_teacher", "Assign class/form teachers.")
    ]
  },
  {
    module: "Subjects",
    permissions: [
      permission("subjects.view", "View subjects and class mappings."),
      permission("subjects.create", "Create subjects."),
      permission("subjects.edit", "Edit subjects."),
      permission("subjects.delete", "Delete or archive subjects."),
      permission("subjects.assign", "Assign subjects to teachers/classes.")
    ]
  },
  {
    module: "Scheme of Work",
    permissions: [
      permission("sow.view", "View a specific scheme of work record and its weekly topics."),
      permission("sow.view_all", "View scheme of work coverage across all classes and subjects."),
      permission("sow.view_own", "View your own assigned schemes of work."),
      permission("sow.create", "Create or initialize scheme of work records."),
      permission("sow.edit", "Edit weekly scheme of work topics and instructional notes."),
      permission("sow.mark_covered", "Mark weekly topics as taught/covered."),
      permission("sow.submit", "Submit a scheme of work for academic review."),
      permission("sow.approve", "Approve or return submitted schemes of work."),
      permission("sow.delete", "Archive or delete a scheme of work.")
    ]
  },
  {
    module: "Library",
    permissions: [
      permission("library.view", "View library books and loans."),
      permission("library.add_book", "Add books to the library."),
      permission("library.edit_book", "Edit library book records."),
      permission("library.delete_book", "Delete library book records."),
      permission("library.issue", "Issue books."),
      permission("library.return", "Record book returns.")
    ]
  },
  {
    module: "Transport",
    permissions: [
      permission("transport.view", "View transport routes and assignments."),
      permission("transport.create", "Create transport routes and vehicles."),
      permission("transport.edit", "Edit transport routes and vehicles."),
      permission("transport.delete", "Delete transport records."),
      permission("transport.assign_student", "Assign students to routes.")
    ]
  },
  {
    module: "Hostel",
    permissions: [
      permission("hostel.view", "View hostel records and allocations."),
      permission("hostel.create", "Create hostel buildings, rooms, and beds."),
      permission("hostel.edit", "Edit hostel records."),
      permission("hostel.delete", "Delete hostel records."),
      permission("hostel.assign_student", "Assign students to hostel rooms.")
    ]
  },
  {
    module: "Events",
    permissions: [
      permission("events.view", "View school events."),
      permission("events.create", "Create events."),
      permission("events.edit", "Edit events."),
      permission("events.delete", "Delete events."),
      permission("events.publish", "Publish events."),
      permission("events.rsvp", "Respond to event invitations.")
    ]
  },
  {
    module: "Announcements",
    permissions: [
      permission("announcements.view", "View announcements."),
      permission("announcements.create", "Create announcements."),
      permission("announcements.edit", "Edit announcements."),
      permission("announcements.delete", "Delete announcements."),
      permission("announcements.publish", "Publish announcements.")
    ]
  },
  {
    module: "Messaging",
    permissions: [
      permission("messaging.view", "View messages."),
      permission("messaging.send", "Send messages."),
      permission("messaging.broadcast", "Broadcast messages."),
      permission("messaging.delete", "Delete messages.")
    ]
  },
  {
    module: "Reports",
    permissions: [
      permission("reports.view", "View reports."),
      permission("reports.generate", "Generate reports."),
      permission("reports.export", "Export reports."),
      permission("reports.schedule", "Schedule reports.")
    ]
  },
  {
    module: "Staff",
    permissions: [
      permission("staff.view", "View staff records."),
      permission("staff.create", "Create staff records."),
      permission("staff.update", "Update staff HR profiles and employment records."),
      permission("staff.edit", "Edit staff records."),
      permission("staff.delete", "Delete staff records."),
      permission("staff.assign_roles", "Assign system roles or custom roles to staff."),
      permission("staff.manage_status", "Activate, deactivate, suspend, or reinstate staff."),
      permission("staff.upload_documents", "Upload staff employment documents."),
      permission("staff.view_sensitive_fields", "View sensitive HR fields."),
      permission("staff.export", "Export staff data."),
      permission("staff.reset_password", "Reset staff passwords.")
    ]
  },
  {
    module: "Admissions",
    permissions: [
      permission("admissions.view", "View admission applications and pipeline."),
      permission("admissions.create", "Create manual or online admission applications."),
      permission("admissions.edit", "Update admission applications and review notes."),
      permission("admissions.delete", "Soft-delete admission records."),
      permission("admissions.approve", "Approve admission decisions."),
      permission("admissions.reject", "Reject or waitlist applicants."),
      permission("admissions.enroll", "Convert admitted applicants into students."),
      permission("admissions.export", "Export admission reports.")
    ]
  },
  {
    module: "Assignments",
    permissions: [
      permission("assignments.view", "View assignments."),
      permission("assignments.create", "Create assignments."),
      permission("assignments.edit", "Edit assignments."),
      permission("assignments.delete", "Delete or archive assignments."),
      permission("assignments.submit", "Submit student assignment work."),
      permission("assignments.grade", "Grade assignment submissions.")
    ]
  },
  {
    module: "Learning Materials",
    permissions: [
      permission("learning_materials.view", "View learning resources."),
      permission("learning_materials.create", "Upload learning materials."),
      permission("learning_materials.edit", "Edit learning materials."),
      permission("learning_materials.delete", "Archive or delete learning materials."),
      permission("learning_materials.publish", "Publish learning materials to students.")
    ]
  },
  {
    module: "Academic Calendar",
    permissions: [
      permission("academic_calendar.view", "View academic calendar."),
      permission("academic_calendar.create", "Create academic calendar items."),
      permission("academic_calendar.edit", "Edit academic calendar items."),
      permission("academic_calendar.delete", "Delete academic calendar items."),
      permission("academic_calendar.publish", "Publish academic calendar.")
    ]
  },
  {
    module: "Lesson Plans",
    permissions: [
      permission("lesson_plans.view", "View lesson plans."),
      permission("lesson_plans.create", "Create lesson plans."),
      permission("lesson_plans.edit", "Edit lesson plans."),
      permission("lesson_plans.delete", "Archive lesson plans."),
      permission("lesson_plans.approve", "Approve lesson plans.")
    ]
  },
  {
    module: "Question Bank",
    permissions: [
      permission("question_bank.view", "View question bank items."),
      permission("question_bank.create", "Create question bank items."),
      permission("question_bank.edit", "Edit question bank items."),
      permission("question_bank.delete", "Delete question bank items."),
      permission("question_bank.approve", "Approve exam or test questions.")
    ]
  },
  {
    module: "Exams",
    permissions: [
      permission("exams.view", "View exam operations."),
      permission("exams.create", "Create exams."),
      permission("exams.edit", "Edit exams."),
      permission("exams.delete", "Delete exams."),
      permission("exams.publish", "Publish exams.")
    ]
  },
  {
    module: "Exam Timetable",
    permissions: [
      permission("exam_timetable.view", "View exam timetables."),
      permission("exam_timetable.create", "Create exam timetables."),
      permission("exam_timetable.edit", "Edit exam timetables."),
      permission("exam_timetable.delete", "Delete exam timetables."),
      permission("exam_timetable.publish", "Publish exam timetables.")
    ]
  },
  {
    module: "Seating Plan",
    permissions: [
      permission("seating_plan.view", "View exam seating plans."),
      permission("seating_plan.create", "Create exam seating plans."),
      permission("seating_plan.edit", "Edit exam seating plans."),
      permission("seating_plan.delete", "Delete seating plans."),
      permission("seating_plan.export", "Export seating plans.")
    ]
  },
  {
    module: "Invigilation",
    permissions: [
      permission("invigilation.view", "View invigilation rosters."),
      permission("invigilation.create", "Create invigilation assignments."),
      permission("invigilation.edit", "Edit invigilation assignments."),
      permission("invigilation.delete", "Delete invigilation assignments."),
      permission("invigilation.export", "Export invigilation rosters.")
    ]
  },
  {
    module: "External Exams",
    permissions: [
      permission("external_exams.view", "View external exam registrations."),
      permission("external_exams.create", "Create external exam records."),
      permission("external_exams.edit", "Edit external exam records."),
      permission("external_exams.delete", "Delete external exam records."),
      permission("external_exams.export", "Export external exam data.")
    ]
  },
  {
    module: "Discipline",
    permissions: [
      permission("discipline.view", "View discipline incidents."),
      permission("discipline.create", "Record discipline incidents."),
      permission("discipline.edit", "Update discipline incidents."),
      permission("discipline.delete", "Archive discipline incidents."),
      permission("discipline.approve", "Approve discipline sanctions.")
    ]
  },
  {
    module: "Conduct Records",
    permissions: [
      permission("conduct_records.view", "View student conduct notes."),
      permission("conduct_records.create", "Create conduct notes."),
      permission("conduct_records.edit", "Edit conduct notes."),
      permission("conduct_records.delete", "Archive conduct notes.")
    ]
  },
  {
    module: "Counseling Records",
    permissions: [
      permission("counseling_records.view", "View counseling records within allowed scope."),
      permission("counseling_records.create", "Create counseling session notes."),
      permission("counseling_records.edit", "Edit counseling records."),
      permission("counseling_records.delete", "Archive counseling records.")
    ]
  },
  {
    module: "Health Records",
    permissions: [
      permission("health_records.view", "View student health records."),
      permission("health_records.create", "Create health visit records."),
      permission("health_records.edit", "Edit health records."),
      permission("health_records.delete", "Archive health records.")
    ]
  },
  {
    module: "Class Reports",
    permissions: [
      permission("class_reports.view", "View class summary reports."),
      permission("class_reports.create", "Create class summary reports."),
      permission("class_reports.edit", "Edit class summary reports."),
      permission("class_reports.delete", "Archive class summary reports.")
    ]
  },
  {
    module: "Staff Attendance",
    permissions: [
      permission("staff_attendance.view", "View staff attendance."),
      permission("staff_attendance.create", "Create staff attendance records."),
      permission("staff_attendance.edit", "Edit staff attendance records."),
      permission("staff_attendance.delete", "Archive staff attendance records."),
      permission("staff_attendance.export", "Export staff attendance.")
    ]
  },
  {
    module: "Staff Leave",
    permissions: [
      permission("staff_leave.view", "View staff leave requests."),
      permission("staff_leave.create", "Create leave requests."),
      permission("staff_leave.edit", "Edit leave requests."),
      permission("staff_leave.approve", "Approve leave requests."),
      permission("staff_leave.reject", "Reject leave requests."),
      permission("staff_leave.export", "Export leave reports.")
    ]
  },
  {
    module: "Visitors",
    permissions: [
      permission("visitors.view", "View visitor logs."),
      permission("visitors.create", "Sign visitors in."),
      permission("visitors.edit", "Update visitor logs."),
      permission("visitors.delete", "Archive visitor logs."),
      permission("visitors.export", "Export visitor logs.")
    ]
  },
  {
    module: "Inventory",
    permissions: [
      permission("inventory.view", "View inventory."),
      permission("inventory.create", "Create inventory items."),
      permission("inventory.edit", "Edit inventory items."),
      permission("inventory.delete", "Archive inventory items."),
      permission("inventory.export", "Export inventory reports.")
    ]
  },
  {
    module: "Facilities",
    permissions: [
      permission("facilities.view", "View facilities and maintenance logs."),
      permission("facilities.create", "Create maintenance logs."),
      permission("facilities.edit", "Edit maintenance logs."),
      permission("facilities.delete", "Archive maintenance logs."),
      permission("facilities.export", "Export facilities reports.")
    ]
  },
  {
    module: "ID Cards",
    permissions: [
      permission("id_cards.view", "View ID cards."),
      permission("id_cards.create", "Generate ID cards."),
      permission("id_cards.edit", "Edit ID cards."),
      permission("id_cards.delete", "Archive ID cards."),
      permission("id_cards.print", "Print ID cards.")
    ]
  },
  {
    module: "Parent Meetings",
    permissions: [
      permission("parent_meetings.view", "View parent meetings."),
      permission("parent_meetings.create", "Schedule parent meetings."),
      permission("parent_meetings.edit", "Edit parent meetings."),
      permission("parent_meetings.delete", "Archive parent meetings."),
      permission("parent_meetings.export", "Export parent meeting schedules.")
    ]
  },
  {
    module: "Expenses",
    permissions: [
      permission("expenses.view", "View expenses."),
      permission("expenses.create", "Create expense records."),
      permission("expenses.edit", "Edit expense records."),
      permission("expenses.delete", "Archive expense records."),
      permission("expenses.export", "Export expense reports.")
    ]
  },
  {
    module: "Salaries",
    permissions: [
      permission("salaries.view", "View salary records."),
      permission("salaries.process", "Process payroll data."),
      permission("salaries.generate_payslip", "Generate staff payslips."),
      permission("salaries.export", "Export salary reports.")
    ]
  },
  {
    module: "Bank Reconciliation",
    permissions: [
      permission("bank_reconciliation.view", "View bank reconciliation records."),
      permission("bank_reconciliation.create", "Create reconciliation records."),
      permission("bank_reconciliation.edit", "Edit reconciliation records."),
      permission("bank_reconciliation.export", "Export reconciliation reports.")
    ]
  },
  {
    module: "Budgets",
    permissions: [
      permission("budgets.view", "View school budgets."),
      permission("budgets.create", "Create annual budgets."),
      permission("budgets.edit", "Edit budgets."),
      permission("budgets.approve", "Approve budgets."),
      permission("budgets.export", "Export budget reports.")
    ]
  },
  {
    module: "Documents",
    permissions: [
      permission("documents.upload", "Upload school or student documents."),
      permission("documents.view", "View documents."),
      permission("documents.delete", "Archive documents.")
    ]
  },
  {
    module: "Report Cards",
    permissions: [
      permission("report_cards.view", "View report cards."),
      permission("report_cards.generate", "Generate report cards."),
      permission("report_cards.download", "Download report cards."),
      permission("report_cards.publish", "Publish report cards.")
    ]
  },
  {
    module: "Audit Logs",
    permissions: [
      permission("audit_logs.view", "View audit logs."),
      permission("audit_logs.export", "Export audit logs.")
    ]
  },
  {
    module: "Integrations",
    permissions: [
      permission("integrations.view", "View integrations."),
      permission("integrations.configure", "Configure integrations.")
    ]
  },
  {
    module: "Data Export",
    permissions: [
      permission("data_export.view", "View data export jobs."),
      permission("data_export.create", "Create data exports."),
      permission("data_export.download", "Download exported data.")
    ]
  },
  {
    module: "Quizzes",
    permissions: [
      permission("quizzes.view", "View quizzes."),
      permission("quizzes.create", "Create quizzes."),
      permission("quizzes.edit", "Edit quizzes."),
      permission("quizzes.delete", "Delete quizzes."),
      permission("quizzes.attempt", "Attempt quizzes.")
    ]
  },
  {
    module: "Roles & Permissions",
    permissions: [
      permission("roles.view", "View school roles and permissions."),
      permission("roles.create", "Create custom roles."),
      permission("roles.edit", "Edit custom roles and permission assignments."),
      permission("roles.delete", "Delete custom roles."),
      permission("roles.assign", "Assign roles and permission overrides to staff.")
    ]
  },
  {
    module: "Settings",
    permissions: [
      permission("settings.view", "View school settings."),
      permission("settings.edit", "Edit general school settings."),
      permission("settings.school_profile", "Edit registered school profile details."),
      permission("settings.academic_year", "Manage sessions and terms."),
      permission("settings.grading", "Manage grading configuration.")
    ]
  }
];

export const permissionCatalog: PermissionDefinition[] = permissionModules.flatMap((group) =>
  group.permissions.map((item) => ({ ...item, module: group.module }))
);

export const allPermissionKeys = permissionCatalog.map((permissionItem) => permissionItem.key);

const keysFor = (...prefixes: string[]) =>
  allPermissionKeys.filter((key) => prefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}.`)));

const mergePermissions = (...groups: string[][]) => Array.from(new Set(groups.flat()));

const principalDenied = new Set(["settings.school_profile"]);
const selfProfilePermissions = [
  "profiles.view_self",
  "profiles.update_self",
  "profiles.request_edit_self",
  "profiles.change_password_self",
  "profiles.change_email_self"
];

export const systemRolePermissionKeys: Partial<Record<Role, string[]>> = {
  SUPER_ADMIN: allPermissionKeys,
  PLATFORM_OWNER: allPermissionKeys,
  PLATFORM_ADMIN: allPermissionKeys,
  DEVELOPER: allPermissionKeys,
  SUPPORT_AGENT: mergePermissions(selfProfilePermissions, ["schools.view", "users.view", "support_tickets.view", "support_tickets.respond", "audit_logs.view", "reports.view"]),
  SALES_MANAGER: mergePermissions(selfProfilePermissions, ["schools.view", "subscriptions.view", "admissions.view", "reports.view", "reports.generate"]),
  FINANCE_MANAGER: mergePermissions(selfProfilePermissions, keysFor("fees", "expenses", "bank_reconciliation"), ["schools.view", "subscriptions.view", "reports.view", "reports.generate", "reports.export"]),
  SCHOOL_OWNER: allPermissionKeys,
  PROPRIETOR: allPermissionKeys,
  PRINCIPAL: allPermissionKeys.filter((key) => !principalDenied.has(key)),
  HEAD_TEACHER: allPermissionKeys.filter((key) => !principalDenied.has(key)),
  VICE_PRINCIPAL_ACADEMICS: mergePermissions(
    selfProfilePermissions,
    keysFor("timetable", "subjects", "academic_calendar", "lesson_plans", "sow"),
    ["profiles.view", "profiles.view_documents", "profiles.view_login_history", "staff.view", "results.view", "results.create", "results.edit", "results.compile", "results.approve", "students.view", "students.transfer", "attendance.view", "attendance.export", "classes.view", "classes.edit", "classes.assign_teacher", "reports.view", "reports.generate", "reports.export"]
  ),
  VICE_PRINCIPAL_ADMINISTRATION: mergePermissions(
    selfProfilePermissions,
    keysFor("staff_attendance", "staff_leave", "discipline", "inventory", "events", "transport", "hostel", "id_cards", "facilities", "parent_meetings"),
    ["profiles.view", "profiles.update", "profiles.review_edit_requests", "profiles.view_documents", "profiles.upload_documents", "profiles.view_login_history", "staff.view", "staff.update", "staff.edit", "staff.create", "staff.manage_status", "staff.upload_documents", "students.view", "parents.view", "reports.view", "reports.generate"]
  ),
  VICE_PRINCIPAL_SPECIAL_DUTIES: mergePermissions(selfProfilePermissions, keysFor("events", "discipline", "facilities", "visitors"), ["profiles.view", "staff.view", "students.view", "parents.view", "reports.view"]),
  ADMINISTRATOR: allPermissionKeys.filter((key) => !principalDenied.has(key)),
  ADMIN_OFFICER: mergePermissions(selfProfilePermissions, keysFor("students", "parents", "classes", "subjects", "admissions", "documents", "settings", "config", "reports"), ["profiles.view", "profiles.update", "profiles.review_edit_requests", "profiles.view_documents", "profiles.upload_documents", "profiles.delete_documents", "profiles.view_login_history", "roles.view", "staff.view", "staff.create", "staff.update", "staff.edit", "staff.manage_status", "staff.upload_documents", "staff_attendance.view"]),
  ADMISSIONS_OFFICER: mergePermissions(selfProfilePermissions, keysFor("admissions", "documents"), ["students.view", "students.create", "parents.view", "parents.create", "parents.edit", "messaging.send", "reports.view", "reports.generate", "reports.export"]),
  EXAM_OFFICER: mergePermissions(
    selfProfilePermissions,
    keysFor("exams", "exam_timetable", "seating_plan", "invigilation", "external_exams", "question_bank"),
    [
      "classes.view",
      "subjects.view",
      "students.view",
      "teachers.view",
      "timetable.view",
      "results.view",
      "results.create",
      "results.edit",
      "results.compile",
      "results.approve",
      "results.publish",
      "results.export",
      "reports.view",
      "reports.generate",
      "reports.export",
      "discipline.view",
      "discipline.create",
      "config.exam.view",
      "config.report_templates.view",
    ],
  ),
  EXAMINATION_OFFICER: mergePermissions(
    selfProfilePermissions,
    keysFor("exams", "exam_timetable", "seating_plan", "invigilation", "external_exams", "question_bank"),
    [
      "classes.view",
      "subjects.view",
      "students.view",
      "teachers.view",
      "timetable.view",
      "results.view",
      "results.create",
      "results.edit",
      "results.compile",
      "results.approve",
      "results.publish",
      "results.export",
      "reports.view",
      "reports.generate",
      "reports.export",
      "discipline.view",
      "discipline.create",
      "config.exam.view",
      "config.report_templates.view",
    ],
  ),
  HEAD_OF_DEPARTMENT: mergePermissions(
    selfProfilePermissions,
    keysFor("question_bank", "lesson_plans"),
    [
      "students.view",
      "teachers.view",
      "staff.view",
      "profiles.view",
      "profiles.view_documents",
      "classes.view",
      "subjects.view",
      "subjects.create",
      "subjects.edit",
      "subjects.assign",
      "results.view",
      "results.create",
      "results.edit",
      "results.compile",
      "results.approve",
      "timetable.view",
      "timetable.view_all",
      "timetable.create",
      "timetable.edit",
      "attendance.view",
      "reports.view",
      "reports.generate",
      "sow.view",
      "sow.view_all",
      "sow.view_own",
      "sow.create",
      "sow.edit",
      "sow.mark_covered",
      "sow.submit",
      "sow.approve"
    ]
  ),
  CLASS_TEACHER: mergePermissions(
    selfProfilePermissions,
    keysFor("assignments", "learning_materials"),
    [
      "students.view",
      "students.edit",
      "attendance.view",
      "attendance.mark",
      "attendance.edit",
      "conduct_records.view",
      "conduct_records.create",
      "conduct_records.edit",
      "discipline.view",
      "results.view",
      "results.create",
      "results.edit",
      "results.approve",
      "messaging.view",
      "messaging.send",
      "class_reports.view",
      "class_reports.create",
      "class_reports.edit",
      "timetable.view",
      "announcements.view",
      "events.view",
      "sow.view",
      "sow.view_own",
      "sow.create",
      "sow.edit",
      "sow.mark_covered",
      "sow.submit",
      "question_bank.create",
      "question_bank.edit"
    ]
  ),
  TEACHER: mergePermissions(
    selfProfilePermissions,
    keysFor("assignments", "learning_materials"),
    [
      "students.view",
      "attendance.view",
      "attendance.mark",
      "results.view",
      "results.create",
      "results.edit",
      "timetable.view",
      "announcements.view",
      "question_bank.create",
      "question_bank.edit",
      "messaging.send",
      "sow.view",
      "sow.view_own",
      "sow.create",
      "sow.edit",
      "sow.mark_covered",
      "sow.submit"
    ]
  ),
  SUBJECT_TEACHER: mergePermissions(
    selfProfilePermissions,
    keysFor("assignments", "learning_materials"),
    [
      "students.view",
      "attendance.view",
      "attendance.mark",
      "results.view",
      "results.create",
      "results.edit",
      "timetable.view",
      "announcements.view",
      "question_bank.create",
      "question_bank.edit",
      "messaging.send",
      "sow.view",
      "sow.view_own",
      "sow.create",
      "sow.edit",
      "sow.mark_covered",
      "sow.submit"
    ]
  ),
  BURSAR: mergePermissions(selfProfilePermissions, keysFor("fees", "expenses", "salaries", "bank_reconciliation"), ["reports.view", "reports.generate", "reports.export", "audit_logs.view"]),
  ACCOUNTANT: mergePermissions(selfProfilePermissions, keysFor("fees", "expenses", "salaries", "bank_reconciliation"), ["reports.view", "reports.generate", "reports.export", "audit_logs.view"]),
  ACCOUNT_OFFICER: mergePermissions(selfProfilePermissions, keysFor("fees", "expenses"), ["reports.view", "reports.generate"]),
  HR_OFFICER: mergePermissions(selfProfilePermissions, keysFor("staff", "staff_attendance", "staff_leave", "documents"), ["profiles.view", "profiles.update", "profiles.view_documents", "profiles.upload_documents", "reports.view"]),
  SECURITY_OFFICER: mergePermissions(selfProfilePermissions, keysFor("visitors", "discipline"), ["students.view", "staff.view", "reports.view"]),
  MAINTENANCE_OFFICER: mergePermissions(selfProfilePermissions, keysFor("facilities", "inventory"), ["reports.view"]),
  GUIDANCE_COUNSELOR: mergePermissions(selfProfilePermissions, keysFor("counseling_records"), ["students.view", "parents.view", "messaging.send", "discipline.view", "discipline.create", "reports.view", "reports.generate"]),
  GUIDANCE_COUNSELLOR: mergePermissions(selfProfilePermissions, keysFor("counseling_records"), ["students.view", "parents.view", "messaging.send", "discipline.view", "discipline.create", "reports.view", "reports.generate"]),
  LIBRARIAN: mergePermissions(selfProfilePermissions, keysFor("library"), ["students.view", "staff.view", "reports.view", "reports.generate", "reports.export"]),
  TRANSPORT_MANAGER: mergePermissions(selfProfilePermissions, keysFor("transport"), ["students.view", "parents.view", "reports.view", "reports.generate"]),
  HOSTEL_MANAGER: mergePermissions(selfProfilePermissions, keysFor("hostel"), ["students.view", "parents.view", "messaging.send", "health_records.view", "health_records.create", "health_records.edit", "discipline.view", "discipline.create", "discipline.edit", "inventory.view", "inventory.create", "inventory.edit"]),
  HOSTEL_MASTER: mergePermissions(selfProfilePermissions, keysFor("hostel"), ["students.view", "parents.view", "messaging.send", "health_records.view", "discipline.view", "discipline.create", "inventory.view"]),
  HOSTEL_MATRON: mergePermissions(selfProfilePermissions, keysFor("hostel"), ["students.view", "parents.view", "messaging.send", "health_records.view", "discipline.view", "discipline.create", "inventory.view"]),
  HOSTEL_MISTRESS: mergePermissions(selfProfilePermissions, keysFor("hostel"), ["students.view", "parents.view", "messaging.send", "health_records.view", "discipline.view", "discipline.create", "inventory.view"]),
  IT_ADMINISTRATOR: mergePermissions(selfProfilePermissions, keysFor("settings", "config", "integrations", "data_export"), ["profiles.view", "profiles.update", "profiles.review_edit_requests", "profiles.view_documents", "profiles.upload_documents", "profiles.view_login_history", "staff.view", "staff.create", "staff.update", "staff.edit", "staff.assign_roles", "staff.manage_status", "staff.upload_documents", "students.view", "students.create", "students.edit", "roles.view", "roles.assign", "audit_logs.view"]),
  ICT_CBT_ADMIN: mergePermissions(selfProfilePermissions, keysFor("settings", "config", "integrations", "data_export"), ["profiles.view", "profiles.update", "profiles.review_edit_requests", "profiles.view_documents", "profiles.upload_documents", "profiles.view_login_history", "staff.view", "staff.create", "staff.update", "staff.edit", "staff.assign_roles", "staff.manage_status", "staff.upload_documents", "students.view", "students.create", "students.edit", "roles.view", "roles.assign", "audit_logs.view"]),
  LABORATORY_ASSISTANT: mergePermissions(selfProfilePermissions, ["students.view", "subjects.view", "inventory.view", "inventory.create", "inventory.edit", "health_records.view", "reports.view"]),
  LABORATORY_STAFF: mergePermissions(selfProfilePermissions, ["students.view", "subjects.view", "inventory.view", "inventory.create", "inventory.edit", "health_records.view", "reports.view"]),
  ATTENDANCE_OFFICER: mergePermissions(selfProfilePermissions, keysFor("attendance"), ["students.view", "reports.view", "reports.generate", "reports.export"]),
  SCHOOL_NURSE: mergePermissions(selfProfilePermissions, keysFor("health_records"), ["students.view", "parents.view", "messaging.send", "inventory.view", "inventory.create", "inventory.edit", "reports.view", "reports.generate"]),
  NURSE: mergePermissions(selfProfilePermissions, keysFor("health_records"), ["students.view", "parents.view", "messaging.send", "inventory.view", "inventory.create", "inventory.edit", "reports.view", "reports.generate"]),
  RECEPTIONIST: mergePermissions(selfProfilePermissions, keysFor("visitors"), ["students.view", "parents.view", "messaging.send", "attendance.log_late_arrival", "attendance.log_early_departure", "announcements.view"]),
  TRANSPORT_COORDINATOR: mergePermissions(selfProfilePermissions, keysFor("transport"), ["students.view", "parents.view", "reports.view", "reports.generate"]),
  STORE_OFFICER: mergePermissions(selfProfilePermissions, keysFor("inventory"), ["reports.view", "reports.generate"]),
  PARENT: mergePermissions(selfProfilePermissions, ["attendance.view", "results.view", "fees.view", "fees.pay_online", "announcements.view", "events.view", "events.rsvp", "messaging.send", "timetable.view", "report_cards.download"]),
  STUDENT: mergePermissions(selfProfilePermissions, ["timetable.view", "results.view", "assignments.view", "assignments.submit", "learning_materials.view", "announcements.view", "attendance.view", "fees.view", "report_cards.download", "quizzes.view", "quizzes.attempt"])
};

export const systemRoleLabels: Partial<Record<Role, { name: string; description: string }>> = {
  SUPER_ADMIN: { name: "Super Admin", description: "Legacy platform super-admin role with unrestricted platform access." },
  PLATFORM_OWNER: { name: "Platform Owner", description: "SaaS owner with unrestricted platform-level authority." },
  PLATFORM_ADMIN: { name: "Platform Admin", description: "Platform administrator with full operational access across tenants." },
  SUPPORT_AGENT: { name: "Support Agent", description: "Platform support access for tenant support, troubleshooting, and service follow-up." },
  SALES_MANAGER: { name: "Sales Manager", description: "Platform sales and onboarding visibility for tenant lifecycle management." },
  FINANCE_MANAGER: { name: "Finance Manager", description: "Platform finance and subscription oversight." },
  DEVELOPER: { name: "Developer", description: "Internal platform developer access for diagnostics and maintenance." },
  SCHOOL_OWNER: { name: "School Owner", description: "Full control across school operations, users, settings, and permissions." },
  PROPRIETOR: { name: "School Owner", description: "Full control across school operations, users, settings, and permissions." },
  PRINCIPAL: { name: "Principal", description: "Academic and administrative oversight without owner-only destructive controls." },
  HEAD_TEACHER: { name: "Head Teacher", description: "Primary-school leadership oversight without owner-only destructive controls." },
  ADMINISTRATOR: { name: "Administrator", description: "School-level administrator with broad operational access." },
  ADMIN_OFFICER: { name: "Admin Officer", description: "School records, enrollment, class setup, and administrative reporting access." },
  VICE_PRINCIPAL_ACADEMICS: { name: "Vice Principal Academics", description: "Timetable, curriculum, subject, result, and academic calendar oversight." },
  VICE_PRINCIPAL_ADMINISTRATION: { name: "Vice Principal Administration", description: "Staff attendance, welfare, discipline, events, facilities, transport, and hostel oversight." },
  VICE_PRINCIPAL_SPECIAL_DUTIES: { name: "Vice Principal Special Duties", description: "Events, discipline, facilities, and assigned operational duties." },
  ADMISSIONS_OFFICER: { name: "Admissions Officer", description: "Application intake, review, offer, enrollment, and admissions reporting." },
  EXAM_OFFICER: { name: "Examination Officer", description: "Exam setup, seating plans, invigilation, external exams, and broadsheet compilation." },
  EXAMINATION_OFFICER: { name: "Examination Officer", description: "Normalized examination officer role for exam setup, invigilation, and results compilation." },
  TEACHER: { name: "Teacher", description: "Default teaching workspace access for classwork, attendance, and results." },
  CLASS_TEACHER: { name: "Class Teacher", description: "Class-level student, attendance, result, and communication access." },
  SUBJECT_TEACHER: { name: "Subject Teacher", description: "Subject-level student, score-entry, and timetable access." },
  BURSAR: { name: "Bursar", description: "School finance officer for fees, expenses, salaries, and finance reports." },
  ACCOUNTANT: { name: "Bursar / Accountant", description: "Fee collection, finance reports, waivers, and student balance visibility." },
  ACCOUNT_OFFICER: { name: "Account Officer", description: "Finance support role for fees, expenses, and basic finance reporting." },
  HR_OFFICER: { name: "HR Officer", description: "Staff records, staff documents, leave, and HR reporting access." },
  SECURITY_OFFICER: { name: "Security Officer", description: "Visitor, safety, and basic student/staff lookup access for security operations." },
  MAINTENANCE_OFFICER: { name: "Maintenance Officer", description: "Facilities, maintenance, and inventory support access." },
  HEAD_OF_DEPARTMENT: { name: "HOD", description: "Department subject, teacher, result approval, and report oversight." },
  LIBRARIAN: { name: "Librarian", description: "Library book, issue, return, and student lookup access." },
  TRANSPORT_COORDINATOR: { name: "Transport Coordinator", description: "Normalized transport role for routes, vehicles, and student transport assignment access." },
  TRANSPORT_MANAGER: { name: "Transport Coordinator", description: "Transport route and student assignment access." },
  HOSTEL_MANAGER: { name: "Hostel Manager", description: "Boarding house, room allocation, hostel welfare, and hostel inventory access." },
  HOSTEL_MASTER: { name: "Hostel Master", description: "Male hostel welfare, attendance, conduct, and exeat operations." },
  HOSTEL_MATRON: { name: "Hostel Matron", description: "Normalized hostel matron role for hostel welfare, conduct, and student support operations." },
  HOSTEL_MISTRESS: { name: "Hostel Mistress / Matron", description: "Female hostel welfare, attendance, conduct, and exeat operations." },
  GUIDANCE_COUNSELOR: { name: "Guidance Counselor", description: "Normalized guidance role for counseling, welfare records, and parent welfare communication." },
  GUIDANCE_COUNSELLOR: { name: "Guidance Counsellor", description: "Student counseling, welfare records, and parent welfare communication." },
  LABORATORY_ASSISTANT: { name: "Laboratory Assistant", description: "Laboratory resources, practical readiness, and science support records." },
  LABORATORY_STAFF: { name: "Laboratory Staff", description: "Laboratory resources, practical readiness, and science support records." },
  IT_ADMINISTRATOR: { name: "IT Administrator", description: "Normalized school IT role for SMS accounts, integrations, backups, and system support." },
  ICT_CBT_ADMIN: { name: "IT Administrator", description: "School SMS account, integrations, backup, and system configuration support." },
  ATTENDANCE_OFFICER: { name: "Attendance Officer", description: "Student attendance follow-up, late arrival, early departure, and attendance reports." },
  SCHOOL_NURSE: { name: "School Nurse", description: "Normalized health officer role for student health visits, medication notes, and emergency communication." },
  NURSE: { name: "School Nurse / Health Officer", description: "Student health visits, medication notes, and health emergency communication." },
  RECEPTIONIST: { name: "Receptionist / Front Desk", description: "Visitor logs, front desk messages, late arrivals, and basic parent inquiries." },
  STORE_OFFICER: { name: "Store Officer", description: "Inventory records, stock levels, and store reporting." },
  PARENT: { name: "Parent", description: "Read-only family portal access." },
  STUDENT: { name: "Student", description: "Read-only student portal access." }
};

export function groupPermissions(keys: string[]) {
  const keySet = new Set(keys);
  return permissionModules.map((group) => ({
    module: group.module,
    permissions: group.permissions
      .filter((permissionItem) => keySet.has(permissionItem.key))
      .map((permissionItem) => ({ ...permissionItem, module: group.module }))
  }));
}
