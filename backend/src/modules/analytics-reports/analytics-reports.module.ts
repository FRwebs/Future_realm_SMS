import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { AuditModule } from "../audit/audit.module";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { AnalyticsReportsController } from "./analytics-reports.controller";
import { InsightsService } from "./insights.service";
import { ReportsService } from "./reports.service";
import { ReportSchedulerService } from "./scheduler.service";

@Module({
  imports: [RolesManagementModule, AuditModule],
  controllers: [AnalyticsReportsController],
  providers: [InsightsService, ReportsService, ReportSchedulerService, PermissionsGuard],
})
export class AnalyticsReportsModule {}
