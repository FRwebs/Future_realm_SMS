import { Module } from "@nestjs/common";

import { UserInsightsController } from "./user-insights.controller";
import { UserInsightsService } from "./user-insights.service";

@Module({ controllers: [UserInsightsController], providers: [UserInsightsService] })
export class UserInsightsModule {}
