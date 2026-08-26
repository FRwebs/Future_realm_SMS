import { Module } from "@nestjs/common";

import { TeamExtrasController } from "./team-extras.controller";
import { TeamExtrasService } from "./team-extras.service";

@Module({
  controllers: [TeamExtrasController],
  providers: [TeamExtrasService]
})
export class TeamExtrasModule {}
