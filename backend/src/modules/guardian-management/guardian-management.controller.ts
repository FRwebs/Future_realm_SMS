import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { ConsentService } from "./consent.service";
import { FamiliesService } from "./families.service";
import { SubmissionsService } from "./submissions.service";

/**
 * Parents & Guardians: families, what they have sent in, and the consent the school holds for
 * them. Literal paths come before parameters so `:id` never swallows a word.
 */
@ApiTags("parents-guardians")
@Controller("v1/parents-guardians")
@UseGuards(SessionGuard, PermissionsGuard)
export class GuardianManagementController {
  constructor(
    private readonly families: FamiliesService,
    private readonly consent: ConsentService,
    private readonly submissions: SubmissionsService
  ) {}

  /* guardians */

  @Get("guardians")
  @RequirePermission("parents-guardians.guardians.view")
  overview(@CurrentSession() session: SessionPayload) {
    return ok(this.families.overview(session));
  }

  @Get("guardians/options")
  @RequirePermission("parents-guardians.guardians.view")
  options(@CurrentSession() session: SessionPayload) {
    return ok(this.families.options(session));
  }

  @Post("guardians")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("parents-guardians.guardians.create")
  add(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.families.add(session, body), "Guardian created.");
  }

  @Post("guardians/invite")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("parents-guardians.guardians.edit")
  invite(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.families.invite(session, body), "Invitations resent.");
  }

  @Post("guardians/merge")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("parents-guardians.guardians.edit")
  merge(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.families.merge(session, body), "Guardians merged.");
  }

  @Post("guardians/phone-only")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("parents-guardians.guardians.edit")
  phoneOnlyFamily(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    const family = Array.isArray(body.family) ? String(body.family[0] ?? "") : String(body.family ?? "");
    return ok(this.families.phoneOnly(session, family, body), "Marked phone-only.");
  }

  @Get("guardians/:id")
  @RequirePermission("parents-guardians.guardians.view")
  family(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return ok(this.families.family(session, id));
  }

  @Post("guardians/:id/contact")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("parents-guardians.guardians.edit")
  editContact(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.families.editContact(session, id, body), "Contact updated.");
  }

  @Post("guardians/:id/children")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("parents-guardians.guardians.edit")
  mapChild(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.families.mapChild(session, id, body), "Child mapped.");
  }

  @Post("guardians/:id/phone-only")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("parents-guardians.guardians.edit")
  phoneOnly(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.families.phoneOnly(session, id, body), "Marked phone-only.");
  }

  /* submissions */

  @Get("submissions")
  @RequirePermission("parents-guardians.submissions.view")
  submissionsOverview(@CurrentSession() session: SessionPayload) {
    return ok(this.submissions.overview(session));
  }

  @Get("submissions/options")
  @RequirePermission("parents-guardians.submissions.view")
  submissionOptions(@CurrentSession() session: SessionPayload) {
    return ok(this.submissions.options(session));
  }

  @Post("submissions")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("parents-guardians.submissions.create")
  logSubmission(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.submissions.log(session, body), "Submission logged.");
  }

  @Post("submissions/:id/resolve")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("parents-guardians.submissions.edit")
  resolve(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.submissions.resolve(session, id, body), "Submission closed.");
  }

  @Post("submissions/:id/assign")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("parents-guardians.submissions.edit")
  assign(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.submissions.assign(session, id, body), "Submission assigned.");
  }

  /* consent */

  @Get("consent")
  @RequirePermission("parents-guardians.consent.view")
  consentOverview(@CurrentSession() session: SessionPayload) {
    return ok(this.consent.overview(session));
  }

  @Post("consent/request")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("parents-guardians.consent.create")
  requestConsent(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.consent.request(session, body), "Consent requested.");
  }

  @Post("consent/types")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("parents-guardians.consent.create")
  addType(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return ok(this.consent.saveType(session, body), "Consent type defined.");
  }

  @Put("consent/types/:code")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("parents-guardians.consent.edit")
  editType(@CurrentSession() session: SessionPayload, @Param("code") code: string, @Body() body: Record<string, unknown>) {
    return ok(this.consent.saveType(session, body, code), "Consent type saved.");
  }

  @Delete("consent/types/:code")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("parents-guardians.consent.delete")
  removeType(@CurrentSession() session: SessionPayload, @Param("code") code: string) {
    return ok(this.consent.removeType(session, code), "Consent type removed.");
  }

  @Post("consent/families/:id")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("parents-guardians.consent.edit")
  recordFamily(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.consent.recordFamily(session, id, body), "Consent recorded.");
  }
}
