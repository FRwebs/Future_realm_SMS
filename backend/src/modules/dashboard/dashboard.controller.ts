import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CurrentSession } from "../../auth/current-session.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { Roles } from "../../auth/roles.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { DashboardService } from "./dashboard.service";

@ApiTags("dashboard")
@Controller("v1/dashboard")
@UseGuards(SessionGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("overview")
  @Roles(
    "SUPER_ADMIN",
    "SCHOOL_OWNER",
    "PROPRIETOR",
    "ADMINISTRATOR",
    "PRINCIPAL",
    "HEAD_TEACHER",
    "VICE_PRINCIPAL_ACADEMICS",
    "VICE_PRINCIPAL_ADMINISTRATION",
    "VICE_PRINCIPAL_SPECIAL_DUTIES",
    "ADMIN_OFFICER",
    "TEACHER",
    "EXAM_OFFICER",
    "HEAD_OF_DEPARTMENT",
    "CLASS_TEACHER",
    "SUBJECT_TEACHER",
    "ACCOUNTANT",
    "PARENT",
    "STUDENT",
    "ADMISSIONS_OFFICER",
    "GUIDANCE_COUNSELLOR",
    "LIBRARIAN",
    "LABORATORY_STAFF",
    "ICT_CBT_ADMIN",
    "ATTENDANCE_OFFICER",
    "NURSE",
    "TRANSPORT_MANAGER",
    "HOSTEL_MANAGER",
    "HOSTEL_MASTER",
    "HOSTEL_MISTRESS",
    "STORE_OFFICER"
  )
  async overview(@CurrentSession() session: SessionPayload) {
    return {
      ok: true,
      data: await this.dashboardService.getOverview(session)
    };
  }
}