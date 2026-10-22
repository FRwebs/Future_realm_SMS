import { Body, Controller, Delete, Get, Param, Post, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { CurriculumCatalogueService } from "./curriculum-catalogue.service";

const sendTemplate = (response: Response, file: { fileName: string; bytes: Buffer }) => {
  response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  response.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
  response.setHeader("Cache-Control", "no-store");
  response.send(file.bytes);
};

/** A school's own curriculum outlines, beside the platform's. Loaded by its leadership or a head of department. */
@ApiTags("curriculum-catalogue")
@Controller("v1/curriculum-catalogue")
@UseGuards(SessionGuard)
export class CurriculumCatalogueController {
  constructor(private readonly service: CurriculumCatalogueService) {}

  @Get()
  list(@CurrentSession() session: SessionPayload) {
    return ok(this.service.list(session.schoolId));
  }

  @Get("template")
  template(@Res() response: Response) {
    sendTemplate(response, this.service.template());
  }

  @Post("import/preview")
  @UseGuards(CsrfGuard)
  preview(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.service.preview(session, "school", body));
  }

  @Post("import/apply")
  @UseGuards(CsrfGuard)
  apply(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.service.apply(session, "school", body), "Curriculum loaded.");
  }

  @Delete(":id")
  @UseGuards(CsrfGuard)
  remove(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return ok(this.service.remove(session, "school", id));
  }
}

/** The catalogue every school sees — loaded from the Back Office. */
@ApiTags("super-admin-curriculum-catalogue")
@Controller("super-admin/curriculum-catalogue")
@UseGuards(SessionGuard, RolesGuard)
@Roles("PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPER_ADMIN")
export class CurriculumCataloguePlatformController {
  constructor(private readonly service: CurriculumCatalogueService) {}

  @Get()
  list() {
    return ok(this.service.list(null, "platform"));
  }

  @Get("template")
  template(@Res() response: Response) {
    sendTemplate(response, this.service.template());
  }

  @Post("import/preview")
  @UseGuards(CsrfGuard)
  preview(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.service.preview(session, "platform", body));
  }

  @Post("import/apply")
  @UseGuards(CsrfGuard)
  apply(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.service.apply(session, "platform", body), "Catalogue loaded.");
  }

  @Delete(":id")
  @UseGuards(CsrfGuard)
  remove(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return ok(this.service.remove(session, "platform", id));
  }
}
