import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { AttendanceManagementModule } from "../attendance-management/attendance-management.module";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { ArchiveService } from "./archive.service";
import { CardService } from "./card.service";
import { CompletionService } from "./completion.service";
import { RemarksService } from "./remarks.service";
import { ReportCardsController } from "./report-cards.controller";

@Module({
  imports: [RolesManagementModule, AttendanceManagementModule],
  controllers: [ReportCardsController],
  providers: [RemarksService, CompletionService, ArchiveService, CardService, PermissionsGuard],
  exports: [CardService]
})
export class ReportCardsModule {}
