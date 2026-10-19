import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { AuditController } from "./audit.controller";
import { GovernanceController } from "./governance.controller";
import { GovernanceService } from "./governance.service";
import { AuditService } from "./audit.service";

@Module({
  imports: [RolesManagementModule],
  controllers: [AuditController, GovernanceController],
  providers: [AuditService, GovernanceService, PermissionsGuard],
  exports: [AuditService, GovernanceService]
})
export class AuditModule {}
