import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { ClassStructureController } from "./class-structure.controller";
import { ClassStructureExtrasService } from "./class-structure-extras.service";
import { ClassStructureService } from "./class-structure.service";
import { TimetableVersionsService } from "./timetable-versions.service";

@Module({
  imports: [RolesManagementModule],
  controllers: [ClassStructureController],
  providers: [ClassStructureService, ClassStructureExtrasService, TimetableVersionsService, PermissionsGuard],
  exports: [ClassStructureService]
})
export class ClassStructureModule {}
