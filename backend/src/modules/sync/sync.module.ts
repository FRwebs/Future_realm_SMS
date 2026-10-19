import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { AttendanceManagementModule } from "../attendance-management/attendance-management.module";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { ScoreResultsModule } from "../score-results/score-results.module";
import { SyncController } from "./sync.controller";
import { SyncReplayService } from "./replay.service";
import { SyncService } from "./sync.service";

@Module({
  imports: [RolesManagementModule, AttendanceManagementModule, ScoreResultsModule],
  controllers: [SyncController],
  providers: [SyncService, SyncReplayService, PermissionsGuard],
  exports: [SyncService]
})
export class SyncModule {}
