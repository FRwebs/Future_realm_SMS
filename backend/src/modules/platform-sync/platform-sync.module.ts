import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { AvailabilityInterceptor } from "./availability.interceptor";
import { PlatformSyncController } from "./platform-sync.controller";
import { PlatformSyncService } from "./platform-sync.service";

@Global()
@Module({
  controllers: [PlatformSyncController],
  providers: [PlatformSyncService, { provide: APP_INTERCEPTOR, useClass: AvailabilityInterceptor }],
  exports: [PlatformSyncService]
})
export class PlatformSyncModule {}
