import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { AccessService } from "./access.service";
import { AppraisalService } from "./appraisal.service";
import { FlowsService } from "./flows.service";
import { LeaveService } from "./leave.service";
import { PayrollService } from "./payroll.service";
import { StaffAccessService } from "./staff-access.service";

/**
 * Staff & Access: the directory, who can reach what, and the three things a school does
 * to a person — add them, change what they hold, and let them go. Literal paths are declared
 * before parameters so `:id` never swallows a word.
 */
@ApiTags("staff-access")
@Controller("v1/staff-access")
@UseGuards(SessionGuard, PermissionsGuard)
export class StaffAccessController {
  constructor(
    private readonly staff: StaffAccessService,
    private readonly access: AccessService,
    private readonly payroll: PayrollService,
    private readonly leave: LeaveService,
    private readonly appraisal: AppraisalService,
    private readonly flows: FlowsService
  ) {}

  /* directory */

  @Get("directory")
  @RequirePermission("staff-access.directory.view")
  directory(@CurrentSession() session: SessionPayload) {
    return this.staff.ok(this.staff.directory(session));
  }

  @Get("role-options")
  @RequirePermission("staff-access.directory.view")
  roleOptions(@CurrentSession() session: SessionPayload) {
    return this.staff.ok(Promise.resolve(this.staff.roleOptions(session)));
  }

  @Post("staff")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.directory.create")
  onboard(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.staff.ok(this.staff.onboard(session, body), "Staff member created.");
  }

  @Post("staff/invite")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.directory.edit")
  invite(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.staff.ok(this.staff.invite(session, body), "Activation link issued.");
  }

  @Get("staff/:staffId")
  @RequirePermission("staff-access.directory.view")
  record(@CurrentSession() session: SessionPayload, @Param("staffId") staffId: string) {
    return this.staff.ok(this.staff.record(session, staffId));
  }

  @Patch("staff/:staffId")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.directory.edit")
  update(@CurrentSession() session: SessionPayload, @Param("staffId") staffId: string, @Body() body: Record<string, unknown>) {
    return this.staff.ok(this.staff.update(session, staffId, body), "Record saved.");
  }

  @Post("staff/:staffId/assignments")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.directory.edit")
  addAssignment(@CurrentSession() session: SessionPayload, @Param("staffId") staffId: string, @Body() body: Record<string, unknown>) {
    return this.staff.ok(this.staff.addAssignment(session, staffId, body), "Assigned.");
  }

  @Delete("staff/:staffId/assignments/:assignmentId")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.directory.edit")
  removeAssignment(@CurrentSession() session: SessionPayload, @Param("staffId") staffId: string, @Param("assignmentId") assignmentId: string) {
    return this.staff.ok(this.staff.removeAssignment(session, staffId, assignmentId), "Assignment removed.");
  }

  @Post("staff/:staffId/suspend")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.directory.edit")
  suspend(@CurrentSession() session: SessionPayload, @Param("staffId") staffId: string, @Body() body: Record<string, unknown>) {
    return this.staff.ok(this.staff.suspend(session, staffId, body), "Account updated.");
  }

  @Get("staff/:staffId/offboarding")
  @RequirePermission("staff-access.directory.view")
  offboardingPlan(@CurrentSession() session: SessionPayload, @Param("staffId") staffId: string) {
    return this.staff.ok(this.staff.offboardingPlan(session, staffId));
  }

  @Post("staff/:staffId/offboard")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.directory.delete")
  offboard(@CurrentSession() session: SessionPayload, @Param("staffId") staffId: string, @Body() body: Record<string, unknown>) {
    return this.staff.ok(this.staff.offboard(session, staffId, body), "Offboarding complete.");
  }

  @Post("staff/:staffId/reveal")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.directory.view")
  reveal(@CurrentSession() session: SessionPayload, @Param("staffId") staffId: string, @Body() body: Record<string, unknown>) {
    return this.staff.ok(this.staff.reveal(session, staffId, body));
  }

  @Get("activity")
  @RequirePermission("staff-access.activity.view")
  activity(@CurrentSession() session: SessionPayload) {
    return this.staff.ok(this.staff.activity(session));
  }

  /* permissions */

  @Get("access/overview")
  @RequirePermission("staff-access.permissions.view")
  overview(@CurrentSession() session: SessionPayload) {
    return this.access.ok(this.access.overview(session));
  }

  @Post("access/apply-template")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.permissions.edit")
  applyTemplate(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.access.ok(this.access.applyTemplate(session, body), "Template applied.");
  }

  @Post("access/recertify")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.permissions.approve")
  recertify(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.access.ok(this.access.recertify(session, body), "Access confirmed.");
  }

  @Get("access/people/:userId")
  @RequirePermission("staff-access.permissions.view")
  person(@CurrentSession() session: SessionPayload, @Param("userId") userId: string) {
    return this.access.ok(this.access.person(session, userId));
  }

  @Get("access/simulate/:userId")
  @RequirePermission("staff-access.permissions.view")
  simulate(@CurrentSession() session: SessionPayload, @Param("userId") userId: string) {
    return this.access.ok(this.access.simulate(session, userId));
  }

  @Put("access/people/:userId/grid")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.permissions.edit")
  saveGrid(@CurrentSession() session: SessionPayload, @Param("userId") userId: string, @Body() body: Record<string, unknown>) {
    return this.access.ok(this.access.saveGrid(session, userId, body), "Access saved.");
  }

  @Patch("access/people/:userId/profile")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.permissions.edit")
  setProfile(@CurrentSession() session: SessionPayload, @Param("userId") userId: string, @Body() body: Record<string, unknown>) {
    return this.access.ok(this.access.setProfile(session, userId, body), "Data scope saved.");
  }

  @Post("access/people/:userId/role")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.permissions.edit")
  changeRole(@CurrentSession() session: SessionPayload, @Param("userId") userId: string, @Body() body: Record<string, unknown>) {
    return this.access.ok(this.access.changeRole(session, userId, body), "Role changed.");
  }

  @Post("access/people/:userId/copy-module")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.permissions.edit")
  copyModule(@CurrentSession() session: SessionPayload, @Param("userId") userId: string, @Body() body: Record<string, unknown>) {
    return this.access.ok(this.access.copyModule(session, userId, body), "Access copied.");
  }

  @Get("access/templates/:name")
  @RequirePermission("staff-access.permissions.view")
  templateGrid(@CurrentSession() session: SessionPayload, @Param("name") name: string) {
    return this.access.ok(this.access.templateGrid(session, name));
  }

  @Put("access/templates/:name/grid")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.permissions.edit")
  saveTemplateGrid(@CurrentSession() session: SessionPayload, @Param("name") name: string, @Body() body: Record<string, unknown>) {
    return this.access.ok(this.access.saveTemplateGrid(session, name, body), "Template saved.");
  }

  @Post("access/roles")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.permissions.create")
  createRole(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.access.ok(this.access.createRole(session, body), "Role created.");
  }

  @Delete("access/roles/:roleId")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.permissions.delete")
  deleteRole(@CurrentSession() session: SessionPayload, @Param("roleId") roleId: string) {
    return this.access.ok(this.access.deleteRole(session, roleId), "Role deleted.");
  }

  @Post("access/sensitive-groups")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.permissions.create")
  createGroup(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.access.ok(this.access.saveSensitiveGroup(session, null, body), "Sensitive group created.");
  }

  @Put("access/sensitive-groups/:slug")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.permissions.edit")
  saveGroup(@CurrentSession() session: SessionPayload, @Param("slug") slug: string, @Body() body: Record<string, unknown>) {
    return this.access.ok(this.access.saveSensitiveGroup(session, slug, body), "Sensitive group saved.");
  }

  @Delete("access/sensitive-groups/:slug")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.permissions.delete")
  deleteGroup(@CurrentSession() session: SessionPayload, @Param("slug") slug: string) {
    return this.access.ok(this.access.deleteSensitiveGroup(session, slug), "Sensitive group deleted.");
  }

  @Post("access/delegations")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.permissions.create")
  addDelegation(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.access.ok(this.access.addDelegation(session, body), "Delegation recorded.");
  }

  @Delete("access/delegations/:id")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.permissions.delete")
  endDelegation(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return this.access.ok(this.access.endDelegation(session, id), "Delegation ended.");
  }

  /* payroll */

  @Get("payroll")
  @RequirePermission("staff-access.payroll.view")
  payrollOverview(@CurrentSession() session: SessionPayload) {
    return this.payroll.ok(this.payroll.overview(session));
  }

  @Get("payroll/people/:id")
  @RequirePermission("staff-access.payroll.view")
  payrollPerson(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return this.payroll.ok(this.payroll.person(session, id));
  }

  @Get("payroll/bands/:id")
  @RequirePermission("staff-access.payroll.view")
  payrollBand(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return this.payroll.ok(this.payroll.band(session, id));
  }

  @Post("payroll/bands")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.payroll.create")
  createBand(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.payroll.ok(this.payroll.createBand(session, body), "Band created.");
  }

  @Put("payroll/bands/:id")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.payroll.edit")
  updateBand(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.payroll.ok(this.payroll.updateBand(session, id, body), "Band saved.");
  }

  @Patch("payroll/bands/:id/ladder")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.payroll.edit")
  saveLadder(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.payroll.ok(this.payroll.saveLadder(session, id, body), "Ladder saved.");
  }

  @Post("payroll/bands/:id/steps")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.payroll.edit")
  addStep(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.payroll.ok(this.payroll.addStep(session, id, body), "Rung added.");
  }

  @Patch("payroll/bands/:id/allowances")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.payroll.edit")
  saveAllowances(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.payroll.ok(this.payroll.saveAllowances(session, id, body), "Allowances saved.");
  }

  @Post("payroll/bands/:id/allowances")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.payroll.edit")
  addAllowance(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.payroll.ok(this.payroll.addAllowance(session, id, body), "Allowance added.");
  }

  @Delete("payroll/bands/:id/allowances/:index")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.payroll.edit")
  removeAllowance(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Param("index", ParseIntPipe) index: number) {
    return this.payroll.ok(this.payroll.removeAllowance(session, id, index), "Allowance removed.");
  }

  @Post("payroll/bands/:id/open")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.payroll.edit")
  setBandOpen(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.payroll.ok(this.payroll.setBandOpen(session, id, body), "Band updated.");
  }

  @Delete("payroll/bands/:id")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.payroll.delete")
  deleteBand(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return this.payroll.ok(this.payroll.deleteBand(session, id), "Band deleted.");
  }

  @Post("payroll/map")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.payroll.edit")
  mapStaff(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.payroll.ok(this.payroll.mapStaff(session, body), "Mapped to a band.");
  }

  @Post("payroll/move-step")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.payroll.edit")
  moveStep(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.payroll.ok(this.payroll.moveStep(session, body), "Moved.");
  }

  @Post("payroll/status")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.payroll.edit")
  payStatus(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.payroll.ok(this.payroll.setStatus(session, body), "Payment status changed.");
  }

  @Post("payroll/off-cycle")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.payroll.create")
  offCycle(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.payroll.ok(this.payroll.offCycle(session, body), "Off-cycle payment recorded.");
  }

  @Put("payroll/setup")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.payroll.edit")
  paySetup(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.payroll.ok(this.payroll.saveSetup(session, body), "Payroll setup saved.");
  }

  @Post("payroll/run/open")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.payroll.edit")
  openRun(@CurrentSession() session: SessionPayload) {
    return this.payroll.ok(this.payroll.openRun(session));
  }

  @Post("payroll/run/send")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.payroll.edit")
  sendRun(@CurrentSession() session: SessionPayload) {
    return this.payroll.ok(this.payroll.sendForApproval(session), "Run sent for approval.");
  }

  @Post("payroll/run/approve")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.payroll.approve")
  approveRun(@CurrentSession() session: SessionPayload) {
    return this.payroll.ok(this.payroll.approveRun(session), "Run approved.");
  }

  @Post("payroll/run/release-held")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.payroll.edit")
  releaseHeld(@CurrentSession() session: SessionPayload) {
    return this.payroll.ok(this.payroll.releaseHeld(session), "Held payments released.");
  }

  /* leave */

  @Get("leave")
  @RequirePermission("staff-access.leave.view")
  leaveOverview(@CurrentSession() session: SessionPayload) {
    return this.leave.ok(this.leave.overview(session));
  }

  @Post("leave/decide-many")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.leave.approve")
  decideMany(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.leave.ok(this.leave.decideMany(session, body), "Decided.");
  }

  @Post("leave/record")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.leave.create")
  recordLeave(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.leave.ok(this.leave.record(session, body), "Leave recorded.");
  }

  @Post("leave/types")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.leave.create")
  createLeaveType(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.leave.ok(this.leave.saveType(session, null, body), "Leave type created.");
  }

  @Put("leave/types/:code")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.leave.edit")
  saveLeaveType(@CurrentSession() session: SessionPayload, @Param("code") code: string, @Body() body: Record<string, unknown>) {
    return this.leave.ok(this.leave.saveType(session, code, body), "Leave type saved.");
  }

  @Delete("leave/types/:code")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.leave.delete")
  deleteLeaveType(@CurrentSession() session: SessionPayload, @Param("code") code: string) {
    return this.leave.ok(this.leave.deleteType(session, code), "Leave type deleted.");
  }

  @Post("leave/:id/decide")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.leave.approve")
  decideLeave(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.leave.ok(this.leave.decide(session, id, body), "Decision recorded.");
  }

  /* appraisal */

  @Get("appraisal")
  @RequirePermission("staff-access.appraisal.view")
  appraisalOverview(@CurrentSession() session: SessionPayload) {
    return this.appraisal.ok(this.appraisal.overview(session));
  }

  @Get("appraisal/moderation")
  @RequirePermission("staff-access.appraisal.view")
  moderation(@CurrentSession() session: SessionPayload) {
    return this.appraisal.ok(this.appraisal.moderation(session));
  }

  @Post("appraisal/publish")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.appraisal.create")
  publishCycle(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.appraisal.ok(this.appraisal.publish(session, body), "Cycle published.");
  }

  @Post("appraisal/deadline")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.appraisal.edit")
  extendDeadline(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.appraisal.ok(this.appraisal.extendDeadline(session, body), "Deadline extended.");
  }

  @Post("appraisal/remind")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.appraisal.edit")
  remindAppraisal(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.appraisal.ok(this.appraisal.remind(session, body), "Reminder sent.");
  }

  @Get("appraisal/people/:id")
  @RequirePermission("staff-access.appraisal.view")
  appraisalOne(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return this.appraisal.ok(this.appraisal.one(session, id));
  }

  @Patch("appraisal/people/:id")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.appraisal.edit")
  rateAppraisal(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.appraisal.ok(this.appraisal.rate(session, id, body), "Review saved.");
  }

  @Post("appraisal/people/:id/complete")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.appraisal.approve")
  completeAppraisal(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return this.appraisal.ok(this.appraisal.complete(session, id), "Review completed.");
  }

  @Post("appraisal/people/:id/return")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.appraisal.edit")
  returnAppraisal(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.appraisal.ok(this.appraisal.returnForEvidence(session, id, body), "Returned for evidence.");
  }

  @Post("appraisal/kpis")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.appraisal.create")
  defineKpi(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    return this.appraisal.ok(this.appraisal.defineKpi(session, body), "KPI created.");
  }

  @Patch("appraisal/sets/:name")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.appraisal.edit")
  saveKpiSet(@CurrentSession() session: SessionPayload, @Param("name") name: string, @Body() body: Record<string, unknown>) {
    return this.appraisal.ok(this.appraisal.saveSet(session, name, body), "KPI set saved.");
  }

  @Post("appraisal/sets/:name/kpis")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.appraisal.create")
  addKpi(@CurrentSession() session: SessionPayload, @Param("name") name: string, @Body() body: Record<string, unknown>) {
    return this.appraisal.ok(this.appraisal.saveKpi(session, name, null, body), "KPI added.");
  }

  @Put("appraisal/sets/:name/kpis/:index")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.appraisal.edit")
  saveKpi(@CurrentSession() session: SessionPayload, @Param("name") name: string, @Param("index", ParseIntPipe) index: number, @Body() body: Record<string, unknown>) {
    return this.appraisal.ok(this.appraisal.saveKpi(session, name, index, body), "KPI saved.");
  }

  @Delete("appraisal/sets/:name/kpis/:index")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.appraisal.delete")
  removeKpi(@CurrentSession() session: SessionPayload, @Param("name") name: string, @Param("index", ParseIntPipe) index: number) {
    return this.appraisal.ok(this.appraisal.removeKpi(session, name, index), "KPI removed.");
  }

  @Post("appraisal/sets/:name/copy")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.appraisal.edit")
  copyKpiSet(@CurrentSession() session: SessionPayload, @Param("name") name: string, @Body() body: Record<string, unknown>) {
    return this.appraisal.ok(this.appraisal.copySet(session, name, body), "KPI set copied.");
  }

  @Post("appraisal/sets/:name/reset")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.appraisal.edit")
  resetKpiSet(@CurrentSession() session: SessionPayload, @Param("name") name: string) {
    return this.appraisal.ok(this.appraisal.resetSet(session, name), "KPI set reset.");
  }

  /* process flows */

  @Get("flows/:id")
  @RequirePermission("staff-access.directory.view")
  flow(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return this.flows.ok(this.flows.get(session, id));
  }

  @Post("flows/:id/stages")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.directory.edit")
  addStage(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.flows.ok(this.flows.addStage(session, id, body), "Stage added.");
  }

  @Put("flows/:id/stages/:index")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.directory.edit")
  updateStage(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Param("index", ParseIntPipe) index: number, @Body() body: Record<string, unknown>) {
    return this.flows.ok(this.flows.updateStage(session, id, index, body), "Stage saved.");
  }

  @Delete("flows/:id/stages/:index")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.directory.edit")
  removeStage(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Param("index", ParseIntPipe) index: number) {
    return this.flows.ok(this.flows.removeStage(session, id, index), "Stage removed.");
  }

  @Post("flows/:id/move")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.directory.edit")
  moveStage(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.flows.ok(this.flows.move(session, id, body), "Stage moved.");
  }

  @Post("flows/:id/preset")
  @UseGuards(SessionGuard, CsrfGuard, PermissionsGuard)
  @RequirePermission("staff-access.directory.edit")
  presetFlow(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.flows.ok(this.flows.preset(session, id, body), "Sequence set.");
  }
}
