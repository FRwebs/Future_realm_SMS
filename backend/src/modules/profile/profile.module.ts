import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";

@Module({
  imports: [RolesManagementModule],
  controllers: [ProfileController],
  providers: [ProfileService, PermissionsGuard],
  exports: [ProfileService],
})
export class ProfileModule {}
