import { Body, CanActivate, Controller, ExecutionContext, Get, HttpException, Injectable, Param, Post, Query, SetMetadata, UseGuards, createParamDecorator } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { ApiAccessService } from "./api-access.service";

const SCOPE = "api-scope";
const NeedsScope = (scope: string) => SetMetadata(SCOPE, scope);

type KeyedRequest = Request & { apiKey?: { schoolId: string; keyId: string } };
const CurrentKey = createParamDecorator((_data: unknown, context: ExecutionContext) => context.switchToHttp().getRequest<KeyedRequest>().apiKey);
const hits = new Map<string, number[]>();

/** Authenticates `Authorization: Bearer frk_…`, checks the plan and the key's scope, and holds a key to sixty calls a minute. */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly access: ApiAccessService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<KeyedRequest>();
    const header = String(request.headers.authorization ?? "");
    const result = await this.access.authenticate(header.startsWith("Bearer ") ? header.slice(7).trim() : undefined);
    if (!result.ok) throw new HttpException(result.error, result.status);
    const scope = this.reflector.get<string>(SCOPE, context.getHandler());
    if (scope && !result.scopes.includes(scope)) throw new HttpException(`This key may not read ${scope}.`, 403);
    const now = Date.now();
    const recent = (hits.get(result.keyId) ?? []).filter((at) => now - at < 60_000);
    if (recent.length >= 60) throw new HttpException("Sixty calls a minute is the limit for a key. Try again shortly.", 429);
    recent.push(now);
    hits.set(result.keyId, recent);
    request.apiKey = { schoolId: result.schoolId, keyId: result.keyId };
    return true;
  }
}

/** What a school's owner sees and does in Audit & Security → Integrations. */
@ApiTags("api-access")
@Controller("v1/api-access")
@UseGuards(SessionGuard, PermissionsGuard)
export class ApiAccessController {
  constructor(private readonly service: ApiAccessService) {}

  @Get()
  @RequirePermission("audit-security.integrations.view")
  overview(@CurrentSession() session: SessionPayload) {
    return ok(this.service.overview(session));
  }

  @Post("keys")
  @UseGuards(CsrfGuard)
  @RequirePermission("audit-security.integrations.create")
  create(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.service.create(session, body));
  }

  @Post("keys/:id/revoke")
  @UseGuards(CsrfGuard)
  @RequirePermission("audit-security.integrations.delete")
  revoke(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return ok(this.service.revoke(session, id));
  }
}

/** The read-only API a key opens. Small on purpose. */
@ApiTags("open-api")
@Controller("v1/open")
@UseGuards(ApiKeyGuard)
export class OpenApiController {
  constructor(private readonly service: ApiAccessService) {}

  @Get("students")
  @NeedsScope("students.read")
  students(@Query() query: { page?: string; classId?: string }, @CurrentKey() key: { schoolId: string }) {
    return ok(this.service.students(key.schoolId, query));
  }

  @Get("classes")
  @NeedsScope("classes.read")
  classes(@CurrentKey() key: { schoolId: string }) {
    return ok(this.service.classes(key.schoolId));
  }

  @Get("attendance")
  @NeedsScope("attendance.read")
  attendance(@Query("date") date: string | undefined, @CurrentKey() key: { schoolId: string }) {
    return ok(this.service.attendance(key.schoolId, date));
  }
}
