import { Module } from "@nestjs/common";

import { AuthModule } from "./auth/auth.module";
import { AcademicsModule } from "./modules/academics/academics.module";
import { AdmissionsModule } from "./modules/admissions/admissions.module";
import { AttendanceModule } from "./modules/attendance/attendance.module";
import { AuthFeatureModule } from "./modules/auth/auth.module";
import { CommunicationsModule } from "./modules/communications/communications.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { FinanceModule } from "./modules/finance/finance.module";
import { NigeriaOperationsModule } from "./modules/nigeria-operations/nigeria-operations.module";
import { ParentPortalModule } from "./modules/parent-portal/parent-portal.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { StudentPortalModule } from "./modules/student-portal/student-portal.module";
import { TeacherPortalModule } from "./modules/teacher-portal/teacher-portal.module";
import { StudentsModule } from "./modules/students/students.module";
import { TeachersModule } from "./modules/teachers/teachers.module";

@Module({
  imports: [
    AuthModule,
    AuthFeatureModule,
    DashboardModule,
    AdmissionsModule,
    StudentsModule,
    AttendanceModule,
    AcademicsModule,
    FinanceModule,
    NigeriaOperationsModule,
    CommunicationsModule,
    ReportsModule,
    ParentPortalModule,
    StudentPortalModule,
    TeacherPortalModule,
    TeachersModule
  ]
})
export class AppModule {}
