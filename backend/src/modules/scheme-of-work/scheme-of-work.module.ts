import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { SchemeOfWorkController } from "./scheme-of-work.controller";
import { SchemeOfWorkService } from "./scheme-of-work.service";

@Module({
  imports: [RolesManagementModule],
  controllers: [SchemeOfWorkController],
  providers: [SchemeOfWorkService, PermissionsGuard]
})
export class SchemeOfWorkModule {}
