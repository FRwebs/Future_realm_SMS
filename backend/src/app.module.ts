import { Module } from "@nestjs/common";

import { AuthModule } from "./auth/auth.module";
import { AcademicsModule } from "./modules/academics/academics.module";
import { AdmissionsModule } from "./modules/admissions/admissions.module";
import { AttendanceModule } from "./modules/attendance/attendance.module";
import { AuthFeatureModule } from "./modules/auth/auth.module";
import { CommunicationsModule } from "./modules/communications/communications.module";
import { ConfigurationModule } from "./modules/configuration/configuration.module";
import { ClassesModule } from "./modules/classes/classes.module";
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
import { ProfileModule } from "./modules/profile/profile.module";
import { ReportsModule } from "./modules/reports/reports.module";
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
  imports: [
    AuthModule,
    AuthFeatureModule,
    DashboardModule,
    ExamOfficerModule,
    AdmissionsModule,
    StudentsModule,
    AttendanceModule,
    ClassesModule,
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
    RolesManagementModule,
    SchoolDirectoryExtrasModule,
    ProfileModule,
    StaffModule,
    SchemeOfWorkModule,
    OperationsModule,
    PartnersModule,
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
