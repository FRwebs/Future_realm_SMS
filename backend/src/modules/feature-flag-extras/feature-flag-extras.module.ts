import { Module } from "@nestjs/common";

import { FeatureFlagExtrasController } from "./feature-flag-extras.controller";
import { FeatureFlagExtrasService } from "./feature-flag-extras.service";

@Module({
  controllers: [FeatureFlagExtrasController],
  providers: [FeatureFlagExtrasService]
})
export class FeatureFlagExtrasModule {}
