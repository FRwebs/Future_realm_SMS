import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { SupportController } from "./support.controller";
import { SupportService } from "./support.service";

@Module({
  imports: [RolesManagementModule],
  controllers: [SupportController],
  providers: [SupportService, PermissionsGuard],
  exports: [SupportService]
})
export class SupportModule {}
