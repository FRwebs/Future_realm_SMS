import { Module } from "@nestjs/common";

import { AuthController } from "./auth.controller";
import { PlatformAuthController } from "./platform-auth.controller";
import { PlatformAuthService } from "./platform-auth.service";
import { AuthService } from "./auth.service";

@Module({
  controllers: [AuthController, PlatformAuthController],
  providers: [AuthService, PlatformAuthService],
  exports: [AuthService, PlatformAuthService]
})
export class AuthFeatureModule {}
