import { Module } from "@nestjs/common";

import { OnboardingController } from "./onboarding.controller";
import { ReportCardsModule } from "../report-cards/report-cards.module";
import { OnboardingService } from "./onboarding.service";
import { ProvisioningService } from "./provisioning.service";

@Module({
  imports: [ReportCardsModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, ProvisioningService],
  exports: [OnboardingService]
})
export class OnboardingModule {}
