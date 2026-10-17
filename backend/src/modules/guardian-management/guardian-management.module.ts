import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { ConsentService } from "./consent.service";
import { FamiliesService } from "./families.service";
import { GuardianManagementController } from "./guardian-management.controller";
import { SubmissionsService } from "./submissions.service";

@Module({
  imports: [RolesManagementModule],
  controllers: [GuardianManagementController],
  providers: [FamiliesService, ConsentService, SubmissionsService, PermissionsGuard]
})
export class GuardianManagementModule {}
