import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { SyncController } from "./sync.controller";
import { SyncService } from "./sync.service";

@Module({
  imports: [RolesManagementModule],
  controllers: [SyncController],
  providers: [SyncService, PermissionsGuard],
  exports: [SyncService]
})
export class SyncModule {}
