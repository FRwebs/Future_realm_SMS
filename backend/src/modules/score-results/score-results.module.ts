import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { AttendanceManagementModule } from "../attendance-management/attendance-management.module";
import { ReportCardsModule } from "../report-cards/report-cards.module";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { ScoreCorrectionsService } from "./corrections.service";
import { ResultsService } from "./results.service";
import { ReviewService } from "./review.service";
import { ScoreResultsController } from "./score-results.controller";
import { SheetsService } from "./sheets.service";

@Module({
  imports: [RolesManagementModule, AttendanceManagementModule, ReportCardsModule],
  controllers: [ScoreResultsController],
  providers: [SheetsService, ReviewService, ResultsService, ScoreCorrectionsService, PermissionsGuard],
  exports: [ResultsService, ScoreCorrectionsService, ReviewService, SheetsService]
})
export class ScoreResultsModule {}
