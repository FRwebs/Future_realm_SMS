import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { ClassesController } from "./classes.controller";
import { ClassesService } from "./classes.service";

@Module({
  imports: [RolesManagementModule],
  controllers: [ClassesController],
  providers: [ClassesService, PermissionsGuard]
})
export class ClassesModule {}
