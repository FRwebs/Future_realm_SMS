import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { OperationsController } from "./operations.controller";
import { OperationsService } from "./operations.service";

@Module({
  imports: [RolesManagementModule],
  controllers: [OperationsController],
  providers: [OperationsService, PermissionsGuard],
  exports: [OperationsService]
})
export class OperationsModule {}
