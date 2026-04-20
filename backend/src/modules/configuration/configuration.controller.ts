import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { ConfigurationService } from "./configuration.service";

@ApiTags("configuration")
@Controller("v1/configuration")
@UseGuards(SessionGuard)
export class ConfigurationController {
  constructor(private readonly configurationService: ConfigurationService) {}

  @Get()
  overview(@CurrentSession() session: SessionPayload) {
    return this.configurationService.ok(this.configurationService.overview(session));
  }

  @Get(":resource")
  list(
    @CurrentSession() session: SessionPayload,
    @Param("resource") resource: string,
    @Query() query: Record<string, string | undefined>
  ) {
    return this.configurationService.ok(this.configurationService.listResource(session, resource, query));
  }

  @Post(":resource")
  @UseGuards(SessionGuard, CsrfGuard)
  create(
    @CurrentSession() session: SessionPayload,
    @Param("resource") resource: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.configurationService.ok(this.configurationService.createResource(session, resource, body));
  }

  @Patch(":resource/:id")
  @UseGuards(SessionGuard, CsrfGuard)
  update(
    @CurrentSession() session: SessionPayload,
    @Param("resource") resource: string,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.configurationService.ok(this.configurationService.updateResource(session, resource, id, body));
  }

  @Delete(":resource/:id")
  @UseGuards(SessionGuard, CsrfGuard)
  remove(@CurrentSession() session: SessionPayload, @Param("resource") resource: string, @Param("id") id: string) {
    return this.configurationService.ok(this.configurationService.deleteResource(session, resource, id));
  }
}
