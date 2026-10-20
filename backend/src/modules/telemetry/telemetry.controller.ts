import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { SessionGuard } from "../../auth/session.guard";

const sampleSchema = z.object({ path: z.string().max(120), loadMs: z.number().int().min(1).max(120_000), connection: z.string().max(12).optional() });

/** Page load times reported by the browsers people actually use — the only honest way to say how the product feels on a slow connection. */
@ApiTags("telemetry")
@Controller("v1/telemetry")
export class TelemetryController {
  @Post("page-load")
  @HttpCode(204)
  @UseGuards(SessionGuard, CsrfGuard)
  async pageLoad(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    const parsed = sampleSchema.safeParse(body);
    if (!parsed.success) return;
    // Pages are named by their route, never by the ids inside them.
    const path = parsed.data.path.replace(/\/c[a-z0-9]{20,}/g, "/:id").replace(/\/\d+/g, "/:n");
    await prisma.pageLoadSample.create({ data: { schoolId: session.schoolId, path, loadMs: parsed.data.loadMs, connection: parsed.data.connection ?? null } });
  }
}
