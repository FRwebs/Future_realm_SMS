import { Module } from "@nestjs/common";

import { PartnerEngineService } from "./partner-engine.service";
import { PartnersController } from "./partners.controller";
import { PartnersService } from "./partners.service";

@Module({
  controllers: [PartnersController],
  providers: [PartnersService, PartnerEngineService],
  exports: [PartnerEngineService]
})
export class PartnersModule {}
