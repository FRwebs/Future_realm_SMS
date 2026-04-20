import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { TimetableController } from "./timetable.controller";
import { TimetableService } from "./timetable.service";

@Module({
  imports: [RolesManagementModule],
  controllers: [TimetableController],
  providers: [TimetableService, PermissionsGuard]
})
export class TimetableModule {}
