import { Controller, Get, Headers, Param, Post, Query, Req, Res, UnauthorizedException, UseGuards, Body } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { WhatsAppService } from "./whatsapp.service";

/** Meta calls this one: no session, but every call is checked against the verify token and the app secret. */
@ApiTags("whatsapp-webhook")
@Controller("v1/webhooks/whatsapp")
export class WhatsAppWebhookController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Get()
  verify(@Query("hub.mode") mode: string, @Query("hub.verify_token") token: string, @Query("hub.challenge") challenge: string, @Res() response: Response) {
    response.type("text/plain").send(this.whatsapp.verify(mode, token, challenge));
  }

  @Post()
  async receive(@Req() req: Request & { rawBody?: Buffer }, @Headers("x-hub-signature-256") signature: string | undefined, @Body() body: Record<string, unknown>) {
    if (!this.whatsapp.signatureOk(req.rawBody ?? Buffer.from(JSON.stringify(body)), signature)) throw new UnauthorizedException("Invalid WhatsApp webhook signature.");
    return { ok: true, data: await this.whatsapp.handle(body as never) };
  }
}

@ApiTags("super-admin-whatsapp")
@Controller("super-admin/whatsapp")
@UseGuards(SessionGuard, RolesGuard)
@Roles("PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPER_ADMIN")
export class WhatsAppAdminController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Get("status")
  status() {
    return ok(Promise.resolve(this.whatsapp.status()));
  }

  @Post("templates/:id/submit")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("PLATFORM_OWNER", "SUPER_ADMIN")
  submit(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return ok(this.whatsapp.submitTemplate(session, id), "Template sent to Meta");
  }
}
