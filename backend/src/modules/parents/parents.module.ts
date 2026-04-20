import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { ParentsController } from "./parents.controller";
import { ParentsService } from "./parents.service";

@Module({
  imports: [RolesManagementModule],
  controllers: [ParentsController],
  providers: [ParentsService, PermissionsGuard],
})
export class ParentsModule {}
