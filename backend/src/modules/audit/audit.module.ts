import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";

@Module({
  imports: [RolesManagementModule],
  controllers: [AuditController],
  providers: [AuditService, PermissionsGuard],
  exports: [AuditService]
})
export class AuditModule {}
