import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { AcademicsController } from "./academics.controller";
import { AcademicsService } from "./academics.service";

@Module({
  imports: [RolesManagementModule],
  controllers: [AcademicsController],
  providers: [AcademicsService, PermissionsGuard]
})
export class AcademicsModule {}
