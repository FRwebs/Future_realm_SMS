import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";

import { prisma } from "../../../src/lib/db/prisma";

/**
 * Two doors with no sign-in, for whatever watches the service.
 *
 * `/api/health` says the process is up and answering — cheap enough to be asked every few seconds, and the one a platform should use to decide
 * whether to restart it. `/api/health/db` also asks the database one trivial question, for a person or a monitor that wants to know the whole
 * chain works; a database blip should not make a platform restart a healthy API, which is why they are separate.
 */
@Controller("health")
export class HealthController {
  private readonly startedAt = Date.now();

  @Get()
  alive() {
    return { ok: true, uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000) };
  }

  @Get("db")
  async database() {
    const began = Date.now();
    try {
      await prisma.$queryRaw`select 1`;
    } catch {
      throw new ServiceUnavailableException("The API is up but cannot reach its database.");
    }
    return { ok: true, databaseMs: Date.now() - began };
  }
}
