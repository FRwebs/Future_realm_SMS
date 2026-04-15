import { Body, Controller, ForbiddenException, Get, Param, Post, Put, Query, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import type { AdmissionApplicationView } from "../../../../src/lib/domain/types";
import { buildAdmissionOfferPdf } from "../../../../src/lib/pdf/admission-offer";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { Roles } from "../../auth/roles.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { AdmissionsService } from "./admissions.service";

type AdmissionWorkflowRole =
  | "ADMISSIONS_OFFICER"
  | "PRINCIPAL"
  | "ADMIN_OFFICER"
  | "ACCOUNTANT"
  | "TEACHER"
  | "PARENT";

function assertAdmissionWorkflowRole(session: SessionPayload, allowed: AdmissionWorkflowRole[]) {
  if (session.role === "SUPER_ADMIN" || session.role === "SCHOOL_OWNER" || allowed.includes(session.role as AdmissionWorkflowRole)) {
    return;
  }

  throw new ForbiddenException("This admissions step belongs to another role.");
}

function assertParentOwnsAdmission(session: SessionPayload, application: AdmissionApplicationView) {
  if (session.role !== "PARENT") return;
  if (application.guardianEmail?.toLowerCase() === session.email.toLowerCase()) return;

  throw new ForbiddenException("You can only access admission records linked to your guardian account.");
}

@ApiTags("admissions")
@Controller("v1/admissions")
@UseGuards(SessionGuard, RolesGuard)
export class AdmissionsController {
  constructor(private readonly admissionsService: AdmissionsService) {}

  @Get()
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "ADMISSIONS_OFFICER", "ACCOUNTANT", "TEACHER")
  async list(@CurrentSession() session: SessionPayload) {
    return {
      ok: true,
      data: await this.admissionsService.listAdmissions(session.schoolId)
    };
  }

  @Get("metrics")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "ADMISSIONS_OFFICER", "ACCOUNTANT")
  async metrics(@CurrentSession() session: SessionPayload) {
    return {
      ok: true,
      data: await this.admissionsService.getAdmissionMetrics(session.schoolId)
    };
  }

  @Get("settings")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "ADMISSIONS_OFFICER")
  async settings(@CurrentSession() session: SessionPayload) {
    return {
      ok: true,
      data: await this.admissionsService.getAdmissionSettings(session.schoolId)
    };
  }

  @Put("settings")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "ADMIN_OFFICER", "ADMISSIONS_OFFICER")
  async updateSettings(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    assertAdmissionWorkflowRole(session, ["ADMIN_OFFICER", "ADMISSIONS_OFFICER"]);
    return {
      ok: true,
      data: await this.admissionsService.updateAdmissionSettings(session.schoolId, body)
    };
  }

  @Get(":applicationId")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "ADMISSIONS_OFFICER", "ACCOUNTANT", "TEACHER", "PARENT")
  async get(@CurrentSession() session: SessionPayload, @Param("applicationId") applicationId: string) {
    const application = await this.admissionsService.getAdmission(session.schoolId, applicationId);
    assertParentOwnsAdmission(session, application);
    return {
      ok: true,
      data: application
    };
  }

  @Post()
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "ADMISSIONS_OFFICER", "PARENT")
  async create(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    assertAdmissionWorkflowRole(session, ["ADMISSIONS_OFFICER", "PARENT"]);
    return {
      ok: true,
      data: await this.admissionsService.createApplication(session.schoolId, session.userId, body)
    };
  }

  @Post(":applicationId/submit")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "ADMISSIONS_OFFICER", "PARENT")
  async submit(@CurrentSession() session: SessionPayload, @Param("applicationId") applicationId: string) {
    assertAdmissionWorkflowRole(session, ["ADMISSIONS_OFFICER", "PARENT"]);
    return {
      ok: true,
      data: await this.admissionsService.submitApplication(session.schoolId, session.userId, applicationId)
    };
  }

  @Post(":applicationId/review")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "ADMISSIONS_OFFICER")
  async review(
    @CurrentSession() session: SessionPayload,
    @Param("applicationId") applicationId: string,
    @Body() body: Record<string, unknown>
  ) {
    assertAdmissionWorkflowRole(session, ["ADMISSIONS_OFFICER"]);
    return {
      ok: true,
      data: await this.admissionsService.reviewAdmission(
        session.schoolId,
        session.userId,
        session.name,
        applicationId,
        body
      )
    };
  }

  @Post(":applicationId/request-documents")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "ADMISSIONS_OFFICER")
  async requestDocuments(
    @CurrentSession() session: SessionPayload,
    @Param("applicationId") applicationId: string,
    @Body() body: Record<string, unknown>
  ) {
    assertAdmissionWorkflowRole(session, ["ADMISSIONS_OFFICER"]);
    return {
      ok: true,
      data: await this.admissionsService.requestDocuments(session.schoolId, session.userId, applicationId, body)
    };
  }

  @Post(":applicationId/verify-fee")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "ACCOUNTANT", "ADMIN_OFFICER")
  async verifyFee(
    @CurrentSession() session: SessionPayload,
    @Param("applicationId") applicationId: string,
    @Body() body: Record<string, unknown>
  ) {
    assertAdmissionWorkflowRole(session, ["ACCOUNTANT", "ADMIN_OFFICER"]);
    return {
      ok: true,
      data: await this.admissionsService.verifyApplicationFee(session.schoolId, session.userId, applicationId, body)
    };
  }

  @Post(":applicationId/schedule-screening")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "ADMISSIONS_OFFICER")
  async scheduleScreening(
    @CurrentSession() session: SessionPayload,
    @Param("applicationId") applicationId: string,
    @Body() body: Record<string, unknown>
  ) {
    assertAdmissionWorkflowRole(session, ["ADMISSIONS_OFFICER"]);
    return {
      ok: true,
      data: await this.admissionsService.scheduleScreening(session.schoolId, session.userId, applicationId, body)
    };
  }

  @Post(":applicationId/screening-result")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "TEACHER", "ADMISSIONS_OFFICER")
  async screeningResult(
    @CurrentSession() session: SessionPayload,
    @Param("applicationId") applicationId: string,
    @Body() body: Record<string, unknown>
  ) {
    assertAdmissionWorkflowRole(session, ["TEACHER", "ADMISSIONS_OFFICER"]);
    return {
      ok: true,
      data: await this.admissionsService.recordScreeningResult(session.schoolId, session.userId, applicationId, body)
    };
  }

  @Post(":applicationId/recommend")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "ADMISSIONS_OFFICER")
  async recommend(
    @CurrentSession() session: SessionPayload,
    @Param("applicationId") applicationId: string,
    @Body() body: Record<string, unknown>
  ) {
    assertAdmissionWorkflowRole(session, ["ADMISSIONS_OFFICER"]);
    return {
      ok: true,
      data: await this.admissionsService.recommendApplication(session.schoolId, session.userId, applicationId, body)
    };
  }

  @Post(":applicationId/decision")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER")
  async decide(
    @CurrentSession() session: SessionPayload,
    @Param("applicationId") applicationId: string,
    @Body() body: Record<string, unknown>
  ) {
    assertAdmissionWorkflowRole(session, ["PRINCIPAL", "ADMIN_OFFICER"]);
    return {
      ok: true,
      data: await this.admissionsService.decideApplication(session.schoolId, session.userId, applicationId, body)
    };
  }

  @Post(":applicationId/issue-offer")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "ADMIN_OFFICER", "ADMISSIONS_OFFICER")
  async issueOffer(
    @CurrentSession() session: SessionPayload,
    @Param("applicationId") applicationId: string,
    @Body() body: Record<string, unknown>
  ) {
    assertAdmissionWorkflowRole(session, ["ADMIN_OFFICER", "ADMISSIONS_OFFICER"]);
    return {
      ok: true,
      data: await this.admissionsService.issueOffer(session.schoolId, session.userId, applicationId, body)
    };
  }

  @Post(":applicationId/accept-offer")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PARENT", "ADMISSIONS_OFFICER")
  async acceptOffer(
    @CurrentSession() session: SessionPayload,
    @Param("applicationId") applicationId: string,
    @Body() body: Record<string, unknown>
  ) {
    assertAdmissionWorkflowRole(session, ["PARENT", "ADMISSIONS_OFFICER"]);
    const application = await this.admissionsService.getAdmission(session.schoolId, applicationId);
    assertParentOwnsAdmission(session, application);
    return {
      ok: true,
      data: await this.admissionsService.acceptOffer(session.schoolId, applicationId, body)
    };
  }

  @Post(":applicationId/decline-offer")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PARENT", "ADMISSIONS_OFFICER")
  async declineOffer(
    @CurrentSession() session: SessionPayload,
    @Param("applicationId") applicationId: string,
    @Body() body: Record<string, unknown>
  ) {
    assertAdmissionWorkflowRole(session, ["PARENT", "ADMISSIONS_OFFICER"]);
    const application = await this.admissionsService.getAdmission(session.schoolId, applicationId);
    assertParentOwnsAdmission(session, application);
    return {
      ok: true,
      data: await this.admissionsService.declineOffer(session.schoolId, applicationId, body)
    };
  }

  @Post(":applicationId/financial-clearance")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "ACCOUNTANT", "ADMIN_OFFICER")
  async financialClearance(
    @CurrentSession() session: SessionPayload,
    @Param("applicationId") applicationId: string,
    @Body() body: Record<string, unknown>
  ) {
    assertAdmissionWorkflowRole(session, ["ACCOUNTANT", "ADMIN_OFFICER"]);
    return {
      ok: true,
      data: await this.admissionsService.markFinanciallyCleared(session.schoolId, session.userId, applicationId, body)
    };
  }

  @Post(":applicationId/register")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "ADMIN_OFFICER")
  async register(
    @CurrentSession() session: SessionPayload,
    @Param("applicationId") applicationId: string,
    @Body() body: Record<string, unknown>
  ) {
    assertAdmissionWorkflowRole(session, ["ADMIN_OFFICER"]);
    return {
      ok: true,
      data: await this.admissionsService.enrollApplicant(session.schoolId, session.userId, applicationId, body)
    };
  }

  @Post(":applicationId/enroll")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "ADMIN_OFFICER")
  async enroll(
    @CurrentSession() session: SessionPayload,
    @Param("applicationId") applicationId: string,
    @Body() body: Record<string, unknown>
  ) {
    assertAdmissionWorkflowRole(session, ["ADMIN_OFFICER"]);
    return {
      ok: true,
      data: await this.admissionsService.enrollApplicant(session.schoolId, session.userId, applicationId, body)
    };
  }

  @Post(":applicationId/comments")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "ADMISSIONS_OFFICER", "ACCOUNTANT", "TEACHER")
  async comment(
    @CurrentSession() session: SessionPayload,
    @Param("applicationId") applicationId: string,
    @Body() body: Record<string, unknown>
  ) {
    return {
      ok: true,
      data: await this.admissionsService.addComment(session.schoolId, session.userId, applicationId, body)
    };
  }

  @Get(":applicationId/offer-letter")
  @Roles("SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "ADMISSIONS_OFFICER", "PARENT")
  async offerLetter(
    @CurrentSession() session: SessionPayload,
    @Param("applicationId") applicationId: string,
    @Query("download") download: string | undefined,
    @Res() response: Response
  ) {
    const application = await this.admissionsService.getAdmission(session.schoolId, applicationId);
    assertParentOwnsAdmission(session, application);
    const bytes = await buildAdmissionOfferPdf({
      schoolName: "FutureRealm SMS School",
      application
    });
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `${download ? "attachment" : "inline"}; filename="${application.applicationNo}-offer-letter.pdf"`
    );
    response.end(Buffer.from(bytes));
  }
}
