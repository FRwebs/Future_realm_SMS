import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { ProfileService } from "./profile.service";

@ApiTags("profiles")
@Controller("v1")
@UseGuards(SessionGuard, PermissionsGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get("profile/me")
  @RequirePermission("profiles.view_self")
  me(@CurrentSession() session: SessionPayload) {
    return this.profileService.ok(this.profileService.getMyProfile(session));
  }

  @Patch("profile/me")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("profiles.update_self")
  updateMe(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.profileService.ok(this.profileService.updateMyProfile(session, body), "Profile updated.");
  }

  @Patch("profile/me/password")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("profiles.change_password_self")
  changePassword(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.profileService.ok(this.profileService.changeMyPassword(session, body), "Password changed.");
  }

  @Get("profile/me/edit-requests")
  @RequirePermission("profiles.request_edit_self")
  myEditRequests(@CurrentSession() session: SessionPayload) {
    return this.profileService.ok(this.profileService.listMyEditRequests(session));
  }

  @Post("profile/me/edit-requests")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("profiles.request_edit_self")
  requestMyEdit(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.profileService.ok(this.profileService.requestMyEdit(session, body), "Profile edit request submitted.");
  }

  @Get("profiles/edit-requests")
  @RequirePermission("profiles.review_edit_requests")
  editRequests(@CurrentSession() session: SessionPayload, @Query() query: Record<string, string | undefined>) {
    return this.profileService.ok(this.profileService.listEditRequests(session, query));
  }

  @Patch("profiles/edit-requests/:requestId/review")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("profiles.review_edit_requests")
  reviewEditRequest(
    @CurrentSession() session: SessionPayload,
    @Param("requestId") requestId: string,
    @Body() body: unknown
  ) {
    return this.profileService.ok(this.profileService.reviewEditRequest(session, requestId, body), "Profile edit request reviewed.");
  }

  @Get("profiles/:userId")
  @RequirePermission("profiles.view")
  profile(@CurrentSession() session: SessionPayload, @Param("userId") userId: string) {
    return this.profileService.ok(this.profileService.getProfile(session, userId));
  }

  @Patch("profiles/:userId")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("profiles.update")
  updateProfile(@CurrentSession() session: SessionPayload, @Param("userId") userId: string, @Body() body: unknown) {
    return this.profileService.ok(this.profileService.updateProfile(session, userId, body), "Profile updated.");
  }

  @Post("profiles/:userId/edit-requests")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("profiles.request_edit_self")
  requestEdit(@CurrentSession() session: SessionPayload, @Param("userId") userId: string, @Body() body: unknown) {
    return this.profileService.ok(this.profileService.requestEdit(session, userId, body), "Profile edit request submitted.");
  }

  @Post("profiles/:userId/documents")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("profiles.upload_documents")
  addDocument(@CurrentSession() session: SessionPayload, @Param("userId") userId: string, @Body() body: unknown) {
    return this.profileService.ok(this.profileService.addDocument(session, userId, body), "Document saved.");
  }

  @Delete("profiles/:userId/documents/:documentId")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("profiles.delete_documents")
  deleteDocument(
    @CurrentSession() session: SessionPayload,
    @Param("userId") userId: string,
    @Param("documentId") documentId: string
  ) {
    return this.profileService.ok(this.profileService.deleteDocument(session, userId, documentId), "Document archived.");
  }

  @Get("profiles/:userId/login-history")
  @RequirePermission("profiles.view_login_history")
  loginHistory(@CurrentSession() session: SessionPayload, @Param("userId") userId: string) {
    return this.profileService.ok(this.profileService.loginHistory(session, userId));
  }
}
