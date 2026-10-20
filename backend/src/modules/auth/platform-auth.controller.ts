import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { PlatformAuthService } from "./platform-auth.service";

@ApiTags("platform-auth")
@Controller("v1/platform-auth")
export class PlatformAuthController {
  constructor(private readonly service: PlatformAuthService) {}

  /**
   * Unauthenticated on purpose: this is the page you have not signed in to yet.
   * It returns the four access levels and whether the allow list is enforced —
   * nothing that names a person or an address.
   */
  @Get("access-control")
  accessControl() {
    return this.service.ok(this.service.accessControl());
  }
}
