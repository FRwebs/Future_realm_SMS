import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { RolesManagementController } from "./roles-management.controller";
import { RolesManagementService } from "./roles-management.service";

@Module({
  controllers: [RolesManagementController],
  providers: [RolesManagementService, PermissionsGuard],
  exports: [RolesManagementService]
})
export class RolesManagementModule {}
