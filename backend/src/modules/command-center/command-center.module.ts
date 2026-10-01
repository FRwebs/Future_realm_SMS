import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { CommandCenterController } from "./command-center.controller";
import { CommandCenterService } from "./command-center.service";

@Module({
  imports: [RolesManagementModule],
  controllers: [CommandCenterController],
  providers: [CommandCenterService, PermissionsGuard],
  exports: [CommandCenterService]
})
export class CommandCenterModule {}
