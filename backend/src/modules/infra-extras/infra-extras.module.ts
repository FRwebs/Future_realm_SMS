import { Module } from "@nestjs/common";

import { InfraExtrasController } from "./infra-extras.controller";
import { InfraExtrasService } from "./infra-extras.service";

@Module({
  controllers: [InfraExtrasController],
  providers: [InfraExtrasService]
})
export class InfraExtrasModule {}
