import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { SupportAccessController } from "./support-access.controller";
import { SupportAccessService, supportAccess } from "./support-access.service";
import { SupportSessionInterceptor } from "./support-session.interceptor";

@Global()
@Module({
  controllers: [SupportAccessController],
  providers: [{ provide: SupportAccessService, useValue: supportAccess }, { provide: APP_INTERCEPTOR, useClass: SupportSessionInterceptor }],
  exports: [SupportAccessService]
})
export class SupportAccessModule {}
