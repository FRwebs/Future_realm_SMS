import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { SessionGuard } from "../../auth/session.guard";
import { KnowledgeBaseService } from "./knowledge-base.service";

const supportPlatformRoles = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER", "SUPER_ADMIN"] as const;

@ApiTags("super-admin")
@Controller("super-admin/support/knowledge-base")
@UseGuards(SessionGuard, RolesGuard)
@Roles(...supportPlatformRoles)
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Get()
  listArticles() {
    return this.knowledgeBaseService.listArticles();
  }

  @Post()
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  createArticle(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.knowledgeBaseService.createArticle(session, body);
  }
}
