import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { AttendanceManagementController } from "./attendance-management.controller";
import { Access } from "./attendance.shared";
import { CasesService } from "./cases.service";
import { ComplianceService } from "./compliance.service";
import { CorrectionsService } from "./corrections.service";
import { OutputsService } from "./outputs.service";
import { RegisterService } from "./register.service";

@Module({
  imports: [RolesManagementModule],
  controllers: [AttendanceManagementController],
  providers: [Access, RegisterService, CasesService, CorrectionsService, ComplianceService, OutputsService, PermissionsGuard],
  exports: [Access, OutputsService]
})
export class AttendanceManagementModule {}
