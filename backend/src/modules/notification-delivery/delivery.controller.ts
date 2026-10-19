import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
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
