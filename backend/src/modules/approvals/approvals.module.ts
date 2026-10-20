import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { AttendanceManagementModule } from "../attendance-management/attendance-management.module";
import { FeeManagementModule } from "../fee-management/fee-management.module";
import { OnboardingModule } from "../onboarding/onboarding.module";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { ScoreResultsModule } from "../score-results/score-results.module";
import { StaffAccessModule } from "../staff-access/staff-access.module";
import { StudentRecordsModule } from "../student-records/student-records.module";
import { ApprovalsController } from "./approvals.controller";
import { HubController } from "./hub.controller";
import { ApprovalsService } from "./approvals.service";
import { HubService } from "./hub.service";

@Module({
  imports: [RolesManagementModule, OnboardingModule, ScoreResultsModule, AttendanceManagementModule, FeeManagementModule, StudentRecordsModule, StaffAccessModule],
  controllers: [ApprovalsController, HubController],
  providers: [ApprovalsService, HubService, PermissionsGuard],
  exports: [ApprovalsService]
})
export class ApprovalsModule {}
