import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { PlatformPolicyController } from "./platform-policy.controller";
import { LifecycleService } from "./lifecycle.service";
import { PolicyService } from "./policy.service";
import { ReadOnlyInterceptor } from "./read-only.interceptor";

@Global()
@Module({
  controllers: [PlatformPolicyController],
  providers: [PolicyService, LifecycleService, { provide: APP_INTERCEPTOR, useClass: ReadOnlyInterceptor }],
  exports: [PolicyService, LifecycleService],
})
export class PlatformPolicyModule {}
