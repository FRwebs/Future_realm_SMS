import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { ConfigurationService } from "./configuration.service";
import { LibraryAdoptionService } from "./library-adoption.service";

@ApiTags("configuration")
@Controller("v1/configuration")
@UseGuards(SessionGuard)
export class ConfigurationController {
  constructor(private readonly configurationService: ConfigurationService, private readonly libraryAdoption: LibraryAdoptionService) {}

  @Get()
  overview(@CurrentSession() session: SessionPayload) {
    return this.configurationService.ok(this.configurationService.overview(session));
  }


  /** Declared before `:resource` so it is not read as a resource key. */
  @Get("branding-versions")
  brandingVersions(@CurrentSession() session: SessionPayload) {
    return this.configurationService.ok(this.configurationService.brandingVersions(session));
  }

  /** What this school can adopt from the platform library, for its own country. Declared before `:resource`. */
  @Get("library")
  library(@CurrentSession() session: SessionPayload) {
    return this.configurationService.ok(this.libraryAdoption.available(session));
  }

  /** Takes a library curriculum — and the grading scale, assessment framework and report card layout the school picks with it. */
  @Post("library/adopt")
  @UseGuards(SessionGuard, CsrfGuard)
  adopt(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.configurationService.ok(this.libraryAdoption.adopt(session, body), "Adopted from the library.");
  }

  @Get(":resource")
  list(
    @CurrentSession() session: SessionPayload,
    @Param("resource") resource: string,
    @Query() query: Record<string, string | undefined>
  ) {
    return this.configurationService.ok(this.configurationService.listResource(session, resource, query));
  }

  // Declared before @Post(":resource") — a literal route registered after a
  // parameterised one at the same depth is never reached.
  @Post("curricula/:id/apply")
  @UseGuards(SessionGuard, CsrfGuard)
  applyCurriculum(
    @CurrentSession() session: SessionPayload,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.configurationService.ok(
      this.configurationService.applyCurriculum(session, id, body),
      "Curriculum put in force."
    );
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
