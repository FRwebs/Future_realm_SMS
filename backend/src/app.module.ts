import { Module } from "@nestjs/common";

import { AuthModule } from "./auth/auth.module";
import { HealthController } from "./common/health.controller";
import { AcademicsModule } from "./modules/academics/academics.module";
import { AdmissionsModule } from "./modules/admissions/admissions.module";
import { AttendanceModule } from "./modules/attendance/attendance.module";
import { AuthFeatureModule } from "./modules/auth/auth.module";
import { CommunicationsModule } from "./modules/communications/communications.module";
import { ConfigurationModule } from "./modules/configuration/configuration.module";
import { ClassesModule } from "./modules/classes/classes.module";
import { FeeManagementModule } from "./modules/fee-management/fee-management.module";
import { GuardianManagementModule } from "./modules/guardian-management/guardian-management.module";
import { ReportCardsModule } from "./modules/report-cards/report-cards.module";
import { ScoreResultsModule } from "./modules/score-results/score-results.module";
import { AttendanceManagementModule } from "./modules/attendance-management/attendance-management.module";
import { SubscriptionBillingModule } from "./modules/subscription-billing/subscription-billing.module";
import { StudentRecordsModule } from "./modules/student-records/student-records.module";
import { StaffAccessModule } from "./modules/staff-access/staff-access.module";
import { ClassStructureModule } from "./modules/class-structure/class-structure.module";
import { CurriculumExtrasModule } from "./modules/curriculum-extras/curriculum-extras.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { ExamOfficerModule } from "./modules/exam-officer/exam-officer.module";
import { FeatureFlagExtrasModule } from "./modules/feature-flag-extras/feature-flag-extras.module";
import { FinanceModule } from "./modules/finance/finance.module";
import { InfraExtrasModule } from "./modules/infra-extras/infra-extras.module";
import { KnowledgeBaseModule } from "./modules/knowledge-base/knowledge-base.module";
import { MigrationModule } from "./modules/migration/migration.module";
import { MyWorkModule } from "./modules/my-work/my-work.module";
import { NigeriaOperationsModule } from "./modules/nigeria-operations/nigeria-operations.module";
import { OnboardingModule } from "./modules/onboarding/onboarding.module";
import { OwnershipTransferModule } from "./modules/ownership-transfer/ownership-transfer.module";
import { ParentPortalModule } from "./modules/parent-portal/parent-portal.module";
import { ParentsModule } from "./modules/parents/parents.module";
import { OperationsModule } from "./modules/operations/operations.module";
import { PartnersModule } from "./modules/partners/partners.module";
import { ComplianceModule } from "./modules/security-compliance/compliance.module";
import { BillingExtrasModule } from "./modules/billing-extras/billing-extras.module";
import { PartnerPortalModule } from "./modules/partner-portal/partner-portal.module";
import { TriggerRulesModule } from "./modules/trigger-rules/trigger-rules.module";
import { SupportDeskModule } from "./modules/support-desk/support-desk.module";
import { MembershipsModule } from "./modules/memberships/memberships.module";
import { CurriculumCatalogueModule } from "./modules/curriculum-catalogue/curriculum-catalogue.module";
import { NotificationsModule } from "./modules/notifications/notifications.controller";
import { ApiAccessModule } from "./modules/api-access/api-access.module";
import { WhatsAppModule } from "./modules/whatsapp/whatsapp.module";
import { AdminViewsModule } from "./modules/admin-views/admin-views.module";
import { InvitationOpsModule } from "./modules/invitation-ops/invitation-ops.module";
import { UserInsightsModule } from "./modules/user-insights/user-insights.module";
import { SupportAccessModule } from "./modules/support-access/support-access.module";
import { TeamAccessModule } from "./modules/team-access/team-access.module";
import { AnalyticsModule } from "./modules/analytics-bi/analytics.module";
import { TemplatesModule } from "./modules/config-library/templates.module";
import { PlansFeaturesModule } from "./modules/plans-features/plans-features.module";
import { ProfileModule } from "./modules/profile/profile.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { AnalyticsReportsModule } from "./modules/analytics-reports/analytics-reports.module";
import { ApprovalsModule } from "./modules/approvals/approvals.module";
import { SupportModule } from "./modules/support/support.module";
import { TelemetryModule } from "./modules/telemetry/telemetry.module";
import { PlatformPolicyModule } from "./modules/platform-policy/platform-policy.module";
import { PlatformSyncModule } from "./modules/platform-sync/platform-sync.module";
import { TeacherWorkspaceModule } from "./modules/teacher-workspace/teacher-workspace.module";
import { NotificationDeliveryModule } from "./modules/notification-delivery/delivery.module";
import { SyncModule } from "./modules/sync/sync.module";
import { AuditModule } from "./modules/audit/audit.module";
import { CommandCenterModule } from "./modules/command-center/command-center.module";
import { RolesManagementModule } from "./modules/roles-management/roles-management.module";
import { SchoolDirectoryExtrasModule } from "./modules/school-directory-extras/school-directory-extras.module";
import { StaffModule } from "./modules/staff/staff.module";
import { StudentPortalModule } from "./modules/student-portal/student-portal.module";
import { SupportPortalsModule } from "./modules/support-portals/support-portals.module";
import { SuperAdminModule } from "./modules/super-admin/super-admin.module";
import { SchemeOfWorkModule } from "./modules/scheme-of-work/scheme-of-work.module";
import { TeacherPortalModule } from "./modules/teacher-portal/teacher-portal.module";
import { TeamExtrasModule } from "./modules/team-extras/team-extras.module";
import { StudentsModule } from "./modules/students/students.module";
import { TeachersModule } from "./modules/teachers/teachers.module";
import { TimetableModule } from "./modules/timetable/timetable.module";
import { UserCaseContextModule } from "./modules/user-case-context/user-case-context.module";
import { WebAddressRegistryModule } from "./modules/web-address-registry/web-address-registry.module";

@Module({
  controllers: [HealthController],
  imports: [
    AuthModule,
    AuthFeatureModule,
    DashboardModule,
    ExamOfficerModule,
    AdmissionsModule,
    StudentsModule,
    AttendanceModule,
    ClassesModule,
    ClassStructureModule,
    StaffAccessModule,
    FeeManagementModule,
    StudentRecordsModule,
    GuardianManagementModule,
    SubscriptionBillingModule,
    AttendanceManagementModule,
    ScoreResultsModule,
    ReportCardsModule,
    CurriculumExtrasModule,
    AcademicsModule,
    FeatureFlagExtrasModule,
    FinanceModule,
    InfraExtrasModule,
    KnowledgeBaseModule,
    MigrationModule,
    MyWorkModule,
    NigeriaOperationsModule,
    OnboardingModule,
    OwnershipTransferModule,
    CommunicationsModule,
    ConfigurationModule,
    ReportsModule,
    ApprovalsModule,
    AnalyticsReportsModule,
    CommandCenterModule,
    AuditModule,
    SyncModule,
    NotificationDeliveryModule,
    PlatformPolicyModule,
    PlatformSyncModule,
    TeacherWorkspaceModule,
    TelemetryModule,
    SupportModule,
    RolesManagementModule,
    SchoolDirectoryExtrasModule,
    ProfileModule,
    StaffModule,
    SchemeOfWorkModule,
    OperationsModule,
    PartnersModule,
    ComplianceModule,
    PlansFeaturesModule,
    TemplatesModule,
    AnalyticsModule,
    TeamAccessModule,
    SupportAccessModule,
    UserInsightsModule,
    BillingExtrasModule,
    TriggerRulesModule,
    PartnerPortalModule,
    SupportDeskModule,
    InvitationOpsModule,
    AdminViewsModule,
    WhatsAppModule,
    ApiAccessModule,
    NotificationsModule,
    CurriculumCatalogueModule,
    MembershipsModule,
    ParentPortalModule,
    ParentsModule,
    StudentPortalModule,
    SupportPortalsModule,
    SuperAdminModule,
    TeacherPortalModule,
    TeachersModule,
    TeamExtrasModule,
    TimetableModule,
    UserCaseContextModule,
    WebAddressRegistryModule
  ]
})
export class AppModule {}
