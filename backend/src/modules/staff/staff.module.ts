import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { StaffController } from "./staff.controller";
import { StaffService } from "./staff.service";

@Module({
  imports: [RolesManagementModule],
  controllers: [StaffController],
  providers: [StaffService, PermissionsGuard],
})
export class StaffModule {}
