import { Controller, Get, Param, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { prisma } from "../../../../src/lib/db/prisma";
import { ok } from "../student-records/records.shared";
import { DeliveryService } from "./delivery.service";

const LEADERS = ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL", "VICE_PRINCIPAL_ADMINISTRATION", "ADMIN_OFFICER", "ACCOUNTANT"] as const;

@ApiTags("notification-delivery")
@Controller("v1/delivery")
@UseGuards(SessionGuard, RolesGuard)
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get("status")
  @Roles(...LEADERS)
  status(@CurrentSession() session: SessionPayload) {
    return ok(this.delivery.status(session.schoolId));
  }

  @Post("run")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...LEADERS)
  run(@CurrentSession() session: SessionPayload) {
    return ok(this.delivery.run(session.schoolId));
  }
}

const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/** The one-pixel image an email asks for when it is opened. Public by design — it carries nothing but a message id. */
@ApiTags("notification-tracking")
@Controller("v1/track")
export class TrackController {
  @Get("open/:file")
  async open(@Param("file") file: string, @Res() response: Response) {
    const id = file.replace(/\.gif$/i, "");
    const row = await prisma.notificationLog.findUnique({ where: { id }, select: { id: true, channel: true, status: true, metadata: true } }).catch(() => null);
    if (row && row.channel === "EMAIL" && row.status === "SENT") {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      if (!meta.openedAt) await prisma.notificationLog.update({ where: { id }, data: { metadata: { ...meta, openedAt: new Date().toISOString() } as never } }).catch(() => undefined);
    }
    response.setHeader("Content-Type", "image/gif");
    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.send(PIXEL);
  }
}
