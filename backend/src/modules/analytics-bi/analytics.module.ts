import { Module } from "@nestjs/common";

import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService, analytics } from "./analytics.service";

@Module({ controllers: [AnalyticsController], providers: [{ provide: AnalyticsService, useValue: analytics }], exports: [AnalyticsService] })
export class AnalyticsModule {}
