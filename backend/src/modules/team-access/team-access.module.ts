import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { AccessInterceptor } from "./access.interceptor";
import { TeamAccessController } from "./team-access.controller";
import { TeamAccessService, teamAccess } from "./team-access.service";

@Global()
@Module({
  controllers: [TeamAccessController],
  providers: [{ provide: TeamAccessService, useValue: teamAccess }, { provide: APP_INTERCEPTOR, useClass: AccessInterceptor }],
  exports: [TeamAccessService]
})
export class TeamAccessModule {}
