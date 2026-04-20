# FutureRealm SMS Functional Requirements Document

Version: 1.0  
Date: 2026-04-20  
Product: FutureRealm School Management System  
Audience: Product, engineering, QA, school administrators, implementation partners

## 1. Purpose

FutureRealm SMS is a multi-tenant school management system for Nigerian schools. The system supports school administration, academic operations, finance, admissions, attendance, staff management, parent/student/teacher portals, timetable, reporting, and platform-level SaaS administration.

This Functional Requirements Document defines what the system must do, who can do it, the business rules that govern each workflow, and the minimum acceptance criteria for a production-ready MVP.

## 2. Scope

### 2.1 In Scope

- Multi-tenant school setup and school-scoped data isolation.
- Platform-level SaaS administration for internal FutureRealm users.
- School-level dashboard, admissions, students, staff, classes, subjects, timetable, attendance, results, finance, communications, configuration, profile, and operations modules.
- Parent, student, and teacher portal experiences.
- Nigerian school structures such as sessions, terms, class levels, class arms, form teachers, WAEC-style grading, Nigerian class naming, and Naira finance flows.
- Role-based access control and granular permissions.
- Audit logging for sensitive and operational actions.
- Swagger/OpenAPI documentation for backend APIs.

### 2.2 Out of Scope For This FRD

- Native mobile applications.
- Live payment gateway settlement guarantees beyond integration handoff and verification workflows.
- Biometric attendance hardware integration.
- Full accounting ledger replacement for external accounting tools.
- AI-driven timetable generation.
- Government regulatory submission integrations unless later specified.

## 3. Product Goals

- Provide one operational platform for Nigerian schools to manage academic, administrative, finance, and communication workflows.
- Support both academic and non-academic staff without forcing all staff into teacher-only assumptions.
- Keep tenant data strictly isolated by school.
- Give school owners final tenant authority while allowing principals and delegated staff to perform day-to-day administration.
- Provide secure self-service portals for parents, students, and teachers.
- Maintain auditability for finance, user management, profile, admissions, attendance, result, and permission actions.

## 4. User Roles And Authority Model

### 4.1 Platform Roles

Platform roles belong to the SaaS company and are not school tenant staff.

- PLATFORM_OWNER
- PLATFORM_ADMIN
- SUPPORT_AGENT
- SALES_MANAGER
- FINANCE_MANAGER
- DEVELOPER
- SUPER_ADMIN as a legacy compatibility role

### 4.2 School Leadership Roles

- SCHOOL_OWNER
- PROPRIETOR as a compatibility owner role
- ADMINISTRATOR
- PRINCIPAL
- HEAD_TEACHER
- VICE_PRINCIPAL_ACADEMICS
- VICE_PRINCIPAL_ADMINISTRATION
- VICE_PRINCIPAL_SPECIAL_DUTIES

### 4.3 Academic Staff Roles

- HEAD_OF_DEPARTMENT
- CLASS_TEACHER
- SUBJECT_TEACHER
- TEACHER
- EXAMINATION_OFFICER
- EXAM_OFFICER as a compatibility role
- GUIDANCE_COUNSELOR
- GUIDANCE_COUNSELLOR as a compatibility role
- LIBRARIAN
- LABORATORY_ASSISTANT
- LABORATORY_STAFF as a compatibility role

### 4.4 Non-Academic Staff Roles

- BURSAR
- ACCOUNTANT as a compatibility role
- ACCOUNT_OFFICER
- HR_OFFICER
- SECURITY_OFFICER
- MAINTENANCE_OFFICER
- ADMIN_OFFICER
- ADMISSIONS_OFFICER
- TRANSPORT_COORDINATOR
- TRANSPORT_MANAGER as a compatibility role
- HOSTEL_MANAGER
- HOSTEL_MASTER
- HOSTEL_MATRON
- HOSTEL_MISTRESS as a compatibility role
- IT_ADMINISTRATOR
- ICT_CBT_ADMIN as a compatibility role
- SCHOOL_NURSE
- NURSE as a compatibility role
- RECEPTIONIST
- ATTENDANCE_OFFICER
- STORE_OFFICER

### 4.5 External Portal Roles

- PARENT
- STUDENT

### 4.6 Authority Rules

REQ-AUTH-001: The system shall separate platform, school, and external portal users by role scope.  
REQ-AUTH-002: SCHOOL_OWNER shall be the highest authority inside a school tenant.  
REQ-AUTH-003: PRINCIPAL shall be a delegated school administrator and shall not outrank SCHOOL_OWNER.  
REQ-AUTH-004: PRINCIPAL shall not modify, delete, demote, suspend, or revoke roles from SCHOOL_OWNER.  
REQ-AUTH-005: Ordinary school staff shall not delete, demote, or deactivate SCHOOL_OWNER.  
REQ-AUTH-006: Platform authority may override school owner accounts only through platform-level flows.  
REQ-AUTH-007: Parent and student roles shall not access school administrative routes.  
REQ-AUTH-008: Role assignment shall be blocked when the actor attempts to assign a role equal to or above their authority.  
REQ-AUTH-009: User, role, staff, profile, finance, and configuration mutations shall be permission-protected on both frontend and backend.  
REQ-AUTH-010: The system shall preserve existing legacy role names by mapping them to normalized equivalents where needed.

## 5. Multi-Tenancy Requirements

REQ-TEN-001: Every school-owned domain record shall be scoped by school ID unless explicitly platform-level.  
REQ-TEN-002: School users shall not read or mutate another school's records.  
REQ-TEN-003: Parent users shall only access records for linked children.  
REQ-TEN-004: Student users shall only access their own published or permitted records.  
REQ-TEN-005: Platform users shall access platform views without becoming automatic members of a school tenant.  
REQ-TEN-006: Audit logs shall record school ID, actor ID, entity type, entity ID, action, and metadata where applicable.

## 6. Core Functional Requirements

### 6.1 Authentication And Session Management

REQ-AUTHN-001: Users shall log in with email and password.  
REQ-AUTHN-002: The backend shall issue secure signed session cookies.  
REQ-AUTHN-003: Browser mutation flows shall use CSRF protection.  
REQ-AUTHN-004: The system shall expose the current session to frontend and backend guards.  
REQ-AUTHN-005: Account status shall support active, inactive, suspended, locked, and pending states where applicable.  
REQ-AUTHN-006: Login attempts and login history shall be available for authorized users.

### 6.2 Dashboard

REQ-DASH-001: The dashboard shall show role-aware metrics and actions.  
REQ-DASH-002: School staff shall see school operational summaries appropriate to their role and permissions.  
REQ-DASH-003: Platform users shall land on the platform console, not the school dashboard.  
REQ-DASH-004: Parents and students shall land on their own portals, not the school admin dashboard.  
REQ-DASH-005: Dashboard widgets shall be filtered by permissions.

### 6.3 Admissions

REQ-ADM-001: The system shall manage admission applications from intake to enrollment.  
REQ-ADM-002: Admissions workflow shall include document review, fee verification, screening, recommendation, principal decision, offer issuance, acceptance or decline, financial clearance, and enrollment.  
REQ-ADM-003: Admission settings shall support application windows, stages, fees, requirements, and workflows.  
REQ-ADM-004: Parents shall only access admission records linked to their guardian email or account.  
REQ-ADM-005: The system shall generate admission offer letters where applicable.  
REQ-ADM-006: Admissions actions shall be role-gated and audited.

### 6.4 Students

REQ-STU-001: Authorized staff shall create, view, search, update, and archive student records.  
REQ-STU-002: Student records shall include biodata, class assignment, guardian links, academic context, attendance, fees, and result summaries.  
REQ-STU-003: Student records shall be school-scoped.  
REQ-STU-004: Student profile views shall show parent/guardian, attendance, finance, academic, and operational context where available.  
REQ-STU-005: Student deletion shall use safe archive or soft-delete behavior where referenced records exist.

### 6.5 Parent And Guardian Portal

REQ-PAR-001: Parents shall view linked children only.  
REQ-PAR-002: Parents shall switch between linked children.  
REQ-PAR-003: Parents shall view child attendance, published results, timetable, fee balances, announcements, notifications, and profile summaries.  
REQ-PAR-004: Parents shall not access school administrative dashboards or staff-only workflows.  
REQ-PAR-005: Parent-visible academic data shall only include published or approved records.

### 6.6 Student Portal

REQ-SPORT-001: Students shall view their own dashboard, profile, attendance, timetable, fees, assignments, learning resources, announcements, and published results.  
REQ-SPORT-002: Students shall not view other student records.  
REQ-SPORT-003: Students shall not access administrative routes.  
REQ-SPORT-004: Student result and timetable visibility shall respect publication status.

### 6.7 Teacher Portal

REQ-TPORT-001: Teachers shall access a teacher portal for assigned classes, subjects, attendance, scores, timetable, and learning workflow summaries.  
REQ-TPORT-002: Subject teachers shall only manage assigned subject/class contexts unless granted broader permissions.  
REQ-TPORT-003: Class teachers shall manage class-level attendance and class-specific student context.  
REQ-TPORT-004: Teacher workflows shall remain separate from parent and student portals.

### 6.8 Staff Module

REQ-STAFF-001: The system shall manage academic and non-academic staff.  
REQ-STAFF-002: Staff records shall include identity, contact, employment, department, designation, staff type, staff category, next of kin, documents, status, and role assignment fields where available.  
REQ-STAFF-003: Staff type shall support ACADEMIC and NON_ACADEMIC.  
REQ-STAFF-004: Staff listing shall support search and filters by staff type, role, status, department, and teacher-only views.  
REQ-STAFF-005: Authorized users shall create, update, activate, suspend, archive, and assign roles to staff.  
REQ-STAFF-006: Staff mutations shall enforce role hierarchy.  
REQ-STAFF-007: SCHOOL_OWNER shall not be manageable by PRINCIPAL or lower roles.  
REQ-STAFF-008: Teachers shall appear as staff, not as a disconnected identity model.  
REQ-STAFF-009: Staff role assignment shall be audited.

### 6.9 Profile Module

REQ-PROF-001: Every authenticated user shall have a profile page.  
REQ-PROF-002: Users shall view their own profile.  
REQ-PROF-003: Users shall update safe self-service profile fields where permitted.  
REQ-PROF-004: Sensitive profile changes shall use edit requests where direct editing is not allowed.  
REQ-PROF-005: Authorized staff shall review, approve, or reject profile edit requests.  
REQ-PROF-006: Profile documents shall support title, type, status, notes, uploaded by, and upload date metadata.  
REQ-PROF-007: Authorized users shall view login history for permitted profiles.  
REQ-PROF-008: Profile actions shall be school-scoped and audited.

### 6.10 Classes

REQ-CLS-001: The system shall display all classes and arms for the school.  
REQ-CLS-002: Nigerian class categories shall include Early Years, Primary, Junior Secondary, and Senior Secondary.  
REQ-CLS-003: Classes shall support name, short name, level, section, category, arm, capacity, room, display order, and active status.  
REQ-CLS-004: Classes shall support form teacher and assistant form teacher assignment.  
REQ-CLS-005: Class lists shall not hide inactive classes unless explicitly filtered.  
REQ-CLS-006: Class views shall show students, subjects, attendance, timetable, results, and teacher context where available.

### 6.11 Subjects

REQ-SUB-001: Authorized users shall create, view, update, and archive subjects.  
REQ-SUB-002: Subjects shall support code, department, description, class levels, compulsory/elective status, WAEC/NECO metadata, subject combination, periods per week, lab requirement, and sort order.  
REQ-SUB-003: Subjects shall be assignable to classes and teachers per term/session context.  
REQ-SUB-004: Teacher assignment changes shall update related timetable entries where applicable.  
REQ-SUB-005: Subject teacher history shall track teacher changes over time.  
REQ-SUB-006: Subject records shall prevent duplicate names or codes per school where configured.

### 6.12 Timetable

REQ-TT-001: Every class and arm shall have an independent timetable.  
REQ-TT-002: Timetable overview shall show all classes, including classes with empty or draft timetables.  
REQ-TT-003: Timetable periods shall support school day definitions extending up to 9:00 PM where configured.  
REQ-TT-004: Period definitions shall support early years, primary, and secondary categories.  
REQ-TT-005: Timetable slots shall support day, period, start time, end time, subject, teacher, room, type, notes, publication status, and double-period flag.  
REQ-TT-006: The system shall prevent teacher conflicts where a teacher is assigned to two classes in the same period.  
REQ-TT-007: Students and parents shall only see published timetable data.  
REQ-TT-008: Authorized users shall publish or unpublish class timetables.  
REQ-TT-009: Timetable actions shall be audited.

### 6.13 Attendance

REQ-ATT-001: Authorized staff shall mark student attendance.  
REQ-ATT-002: Attendance shall support present, absent, late, excused, and related school-defined statuses where available.  
REQ-ATT-003: Class teachers and authorized staff shall access relevant class attendance workflows.  
REQ-ATT-004: Attendance shall support offline draft capability where implemented.  
REQ-ATT-005: Parent and student portals shall show attendance summaries and records scoped to the linked student.  
REQ-ATT-006: Attendance edits shall be permission-gated and audited.

### 6.14 Academics, Assessments, Results, And Reports

REQ-ACAD-001: The system shall support academic sessions, terms, class levels, subjects, assessments, grading, and result workflows.  
REQ-ACAD-002: The system shall support Nigerian grading bands including WAEC-style grades.  
REQ-ACAD-003: Result workflows shall support draft entry, compilation, approval, publishing, and report card generation where available.  
REQ-ACAD-004: Result approval shall follow role-based stages such as subject teacher, HOD, class teacher, exam officer, VP academics, and principal.  
REQ-ACAD-005: Students and parents shall only see published results.  
REQ-ACAD-006: Report cards shall be exportable or downloadable where implemented.  
REQ-ACAD-007: Academic actions shall be audited.

### 6.15 Finance

REQ-FIN-001: The system shall manage fee structures, invoices, payments, receipts, discounts, waivers, installment plans, and finance reports.  
REQ-FIN-002: Finance records shall use Nigerian Naira formatting.  
REQ-FIN-003: Authorized finance users such as BURSAR and ACCOUNTANT shall manage finance mutations.  
REQ-FIN-004: Principals may view finance dashboards where permitted but shall not automatically receive all finance mutation rights.  
REQ-FIN-005: Online payment initialization and verification shall support configured payment providers.  
REQ-FIN-006: Manual payments shall be auditable.  
REQ-FIN-007: Fee structures used by invoices shall not be destructively deleted without safe archive behavior.  
REQ-FIN-008: Finance exports shall be permission-gated.

### 6.16 Communications

REQ-COM-001: Authorized users shall create and send announcements.  
REQ-COM-002: Announcements shall support audience targeting where available.  
REQ-COM-003: Parent, student, and staff portals shall display relevant announcements and notifications.  
REQ-COM-004: Communication actions shall be audited where applicable.

### 6.17 Configuration

REQ-CONF-001: The system shall provide a configuration area for school setup and operational settings.  
REQ-CONF-002: Configuration shall cover general, finance, academics, and other settings where implemented.  
REQ-CONF-003: Configuration resources shall use CRUD, edit-only, archive, activate/deactivate, or reorder behavior based on domain rules.  
REQ-CONF-004: Sessions and terms shall prevent invalid multiple-current states unless business rules allow.  
REQ-CONF-005: Class levels and class arms shall prevent duplicate names per school.  
REQ-CONF-006: Configuration changes shall be permission-gated and audited.

### 6.18 Operations

REQ-OPS-001: The system shall support operational workflows for welfare, discipline, front desk, hostel, transport, assets, facilities, and exam logistics where implemented.  
REQ-OPS-002: Non-academic staff shall access operational workflows appropriate to their role.  
REQ-OPS-003: Parent and student users shall not access internal operations workspaces.  
REQ-OPS-004: Operational records shall be school-scoped.

### 6.19 Super Admin Platform Console

REQ-SA-001: Platform users shall access a separate platform console.  
REQ-SA-002: Platform console shall support schools, users, billing, analytics, support, CRM, feature flags, security, audit logs, settings, and communications where implemented.  
REQ-SA-003: Platform users shall not automatically act as school users unless a platform workflow explicitly performs a tenant action.  
REQ-SA-004: Platform actions shall be audited.

### 6.20 Roles, Permissions, And My Permissions

REQ-RBAC-001: The system shall expose a role and permission management area for authorized school users.  
REQ-RBAC-002: System roles shall not be deleted.  
REQ-RBAC-003: Custom roles shall be school-scoped.  
REQ-RBAC-004: Users shall only assign permissions they are authorized to grant.  
REQ-RBAC-005: The system shall display a user's resolved permissions.  
REQ-RBAC-006: Permission overrides shall be grant/revoke based and audited.  
REQ-RBAC-007: Role and permission management shall enforce hierarchy and tenant scope.

## 7. Data Requirements

REQ-DATA-001: The database shall use PostgreSQL with Prisma ORM.  
REQ-DATA-002: Core models shall include School, User, StaffProfile, Student, Guardian, Role, Permission, UserRoleAssignment, UserPermissionOverride, AuditLog, AcademicSession, Term, ClassLevel, ClassRoom, Subject, ClassSubject, Attendance, Timetable, Fee, Invoice, Payment, ProfileDocument, and ProfileEditRequest where implemented.  
REQ-DATA-003: Records with dependency risk shall use soft-delete, archive, or active/inactive status where appropriate.  
REQ-DATA-004: Created and updated timestamps shall be stored for domain records where applicable.  
REQ-DATA-005: School-scoped records shall include school ID.  
REQ-DATA-006: Unique constraints shall prevent duplicate critical configuration records per school.

## 8. API Requirements

REQ-API-001: Backend APIs shall be implemented with NestJS under `/api/v1`.  
REQ-API-002: APIs shall use session guards, role guards, permission guards, and CSRF guards where appropriate.  
REQ-API-003: APIs shall return consistent response envelopes where implemented.  
REQ-API-004: APIs shall validate request bodies before mutation.  
REQ-API-005: APIs shall document endpoints in Swagger/OpenAPI.  
REQ-API-006: List endpoints shall document and support relevant search, pagination, filter, and sorting behavior where implemented.  
REQ-API-007: Upload endpoints shall document multipart fields, accepted file types, and response structure where implemented.

## 9. Frontend Requirements

REQ-FE-001: Frontend shall use Next.js App Router, TypeScript, and Tailwind CSS.  
REQ-FE-002: Protected pages shall enforce route access and show access denied states where appropriate.  
REQ-FE-003: Navigation shall be generated from role and permission-aware registries.  
REQ-FE-004: Action buttons shall be hidden or disabled when users lack permission.  
REQ-FE-005: Forms shall show validation, loading, success, and error states.  
REQ-FE-006: Destructive actions shall require confirmation.  
REQ-FE-007: Tables and lists shall include empty and loading states.  
REQ-FE-008: UI shall remain responsive for desktop and mobile use.

## 10. Non-Functional Requirements

REQ-NFR-001: The system shall preserve tenant isolation across all school-level data.  
REQ-NFR-002: Sensitive actions shall be audited.  
REQ-NFR-003: Passwords shall be stored as hashes.  
REQ-NFR-004: The system shall avoid exposing payment secrets or sensitive internal configuration in the UI.  
REQ-NFR-005: The system shall support local development with seeded demo data.  
REQ-NFR-006: The system shall support production deployment with Docker.  
REQ-NFR-007: The system shall include unit and end-to-end tests for major workflows.  
REQ-NFR-008: The system shall preserve backward compatibility for existing MVP data and routes wherever possible.  
REQ-NFR-009: The system shall be maintainable through modular backend services and reusable frontend components.

## 11. Integrations

REQ-INT-001: Payment integration shall support Paystack and Flutterwave adapter architecture.  
REQ-INT-002: File/document storage shall support S3-compatible storage with local fallback where configured.  
REQ-INT-003: PDF generation shall support report cards and admission offer letters where implemented.  
REQ-INT-004: Swagger/OpenAPI shall be available at `/api/docs` and `/api/docs-json`.

## 12. Reporting And Export

REQ-REP-001: The system shall provide operational dashboards and summaries.  
REQ-REP-002: Finance reports shall support export where implemented.  
REQ-REP-003: Academic reports shall support report card and broadsheet workflows where implemented.  
REQ-REP-004: Admissions reports shall support application and workflow visibility.  
REQ-REP-005: Audit logs shall be viewable by authorized users.

## 13. Acceptance Criteria

AC-001: A platform admin can access the platform console and cannot be treated as ordinary school staff by default.  
AC-002: A school owner can manage school users, roles, permissions, staff, configuration, finance, academics, and operations according to granted permissions.  
AC-003: A principal can administer day-to-day school workflows but cannot demote, delete, suspend, or modify the school owner.  
AC-004: A bursar/accountant can access finance workflows without needing to be treated as an academic staff member.  
AC-005: A receptionist, nurse, hostel staff, transport staff, and IT administrator can be represented as non-academic staff.  
AC-006: A parent can only view linked children.  
AC-007: A student can only view their own portal data.  
AC-008: A class teacher can manage relevant class workflows.  
AC-009: A subject teacher can access assigned teaching workflows.  
AC-010: All classes and arms appear in class and timetable overview pages.  
AC-011: Every class and arm can have a timetable structure.  
AC-012: Timetable display supports configured periods up to 9:00 PM.  
AC-013: Subject teacher assignment updates class subject mappings and related timetable teacher fields where applicable.  
AC-014: Finance mutation actions are blocked for oversight-only users without manage rights.  
AC-015: APIs are documented in Swagger with auth, query, body, and response details.  
AC-016: Unit tests, type-check, and API build pass before release.

## 14. Open Questions

- Should schools support active role switching for users with multiple roles in the same tenant?
- Should platform users impersonate school users through a controlled support flow?
- Should every module support CSV/PDF export in MVP, or only finance, admissions, results, and audit logs?
- Should parent/student portal routes remain completely separate from `/dashboard` long term?
- Should schools define custom staff categories beyond academic and non-academic?

## 15. Future Enhancements

- Active role switcher for multi-role users.
- Background jobs for notifications, fee reminders, result publishing, and report generation.
- Live payment webhooks with provider signature verification.
- Dedicated document upload UI for admissions and profiles.
- Full inventory, hostel, transport, library, and HR CRUD expansion.
- Advanced timetable generation and conflict resolution.
- Data export jobs and retention policy tools.
- Mobile app or PWA offline expansion.

