import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ApiTags } from "@nestjs/swagger";

import {
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  createSessionToken,
  getCookieOptions,
  verifySessionToken,
  type SessionPayload,
} from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { rememberLocale, toLocale } from "../../common/locale";
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
  updateMe(@CurrentSession() session: SessionPayload, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const saved = this.profileService.updateMyProfile(session, body).then((profile) => {
      // A changed language is remembered on this device straight away, not only at the next sign-in.
      rememberLocale(response, toLocale((body as { locale?: unknown } | null)?.locale));
      return profile;
    });
    return this.profileService.ok(saved, "Profile updated.");
  }

  @Patch("profile/me/password")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("profiles.change_password_self")
  async changePassword(
    @CurrentSession() session: SessionPayload,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.profileService.changeMyPassword(session, body);
    // Every device signed in with the old password is turned away from here on,
    // because the session guard refuses a token minted before the change. This
    // one made the change, so it is handed a token minted after it — which is
    // what "you stay signed in here" on the account page means.
    // A fresh token is minted from who they are, not from the old token's dates.
    const token = await createSessionToken({
      userId: session.userId,
      schoolId: session.schoolId,
      role: session.role,
      email: session.email,
      name: session.name,
      csrfToken: session.csrfToken,
    } as Parameters<typeof createSessionToken>[0]);
    const refreshed = await verifySessionToken(token);
    response.cookie(SESSION_COOKIE_NAME, token, getCookieOptions(true));
    if (refreshed) response.cookie(CSRF_COOKIE_NAME, refreshed.csrfToken, getCookieOptions(false));
    return this.profileService.ok(Promise.resolve(result), "Password changed.");
  }

  @Post("profile/me/mfa/setup")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("profiles.manage_mfa_self")
  setupMfa(@CurrentSession() session: SessionPayload) {
    return this.profileService.ok(this.profileService.setupMyMfa(session), "Scan the QR code, then enter a code to confirm.");
  }

  @Post("profile/me/mfa/confirm")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("profiles.manage_mfa_self")
  confirmMfa(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.profileService.ok(this.profileService.confirmMyMfa(session, body), "Two-factor authentication is now on.");
  }

  @Patch("profile/me/mfa/disable")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("profiles.manage_mfa_self")
  disableMfa(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.profileService.ok(this.profileService.disableMyMfa(session, body), "Two-factor authentication is now off.");
  }

  @Post("profile/me/mfa/backup-codes")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("profiles.manage_mfa_self")
  regenerateMfaBackupCodes(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return this.profileService.ok(this.profileService.regenerateMyMfaBackupCodes(session, body), "New backup codes generated — your old ones no longer work.");
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
