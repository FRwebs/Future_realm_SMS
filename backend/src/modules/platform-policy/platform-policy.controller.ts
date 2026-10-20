import { Body, Controller, Get, Post, Put, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { CARRIERS } from "../notification-delivery/providers";
import { LifecycleService } from "./lifecycle.service";
import { PolicyService } from "./policy.service";

@ApiTags("platform-policy")
@Controller("super-admin")
@UseGuards(SessionGuard, RolesGuard)
@Roles("PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPER_ADMIN")
export class PlatformPolicyController {
  constructor(private readonly policy: PolicyService, private readonly lifecycle: LifecycleService) {}

  @Get("platform-policy")
  get() {
    return ok(this.policy.get());
  }

  @Put("platform-policy")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  update(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.policy.update(session, body), "Platform policy saved.");
  }

  /** Which carriers have keys on this deployment — what the Settings page says is sending, and what is not. */
  @Get("delivery-carriers")
  carriers() {
    return ok(Promise.resolve({ enabled: process.env.DELIVERY_ENABLED === "true", carriers: Object.values(CARRIERS).map((carrier) => ({ channel: carrier.channel, provider: carrier.provider, configured: carrier.configured() })), emailMfa: process.env.AUTH_EMAIL_MFA === "on" || (process.env.AUTH_EMAIL_MFA !== "off" && Boolean(process.env.SMTP_HOST)), scheduler: process.env.LIFECYCLE_SCHEDULER !== "off" }));
  }

  @Get("lifecycle/preview")
  preview() {
    return ok(this.lifecycle.preview());
  }

  @Post("lifecycle/run")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  run() {
    return ok(this.lifecycle.run());
  }
}
