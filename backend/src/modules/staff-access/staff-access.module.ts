import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { ClassStructureModule } from "../class-structure/class-structure.module";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { AccessService } from "./access.service";
import { AppraisalService } from "./appraisal.service";
import { FlowsService } from "./flows.service";
import { LeaveService } from "./leave.service";
import { PayrollService } from "./payroll.service";
import { StaffAccessController } from "./staff-access.controller";
import { StaffAccessService } from "./staff-access.service";

@Module({
  imports: [RolesManagementModule, ClassStructureModule],
  controllers: [StaffAccessController],
  providers: [AccessService, StaffAccessService, PayrollService, LeaveService, AppraisalService, FlowsService, PermissionsGuard],
  exports: [AccessService, StaffAccessService]
})
export class StaffAccessModule {}
