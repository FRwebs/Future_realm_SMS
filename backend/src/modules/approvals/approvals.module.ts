import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { ApprovalsController } from "./approvals.controller";
import { ApprovalsService } from "./approvals.service";

@Module({
  imports: [RolesManagementModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService, PermissionsGuard],
  exports: [ApprovalsService]
})
export class ApprovalsModule {}
