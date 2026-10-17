import { createHash, randomBytes } from "crypto";

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

import { hashPassword } from "../../../../src/lib/auth/password";
import { canAssignRole, canManageRole, getStaffTypeForRole, isPlatformRole, isSchoolStaffRole } from "../../../../src/lib/auth/role-architecture";
import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { roleTemplateFor } from "../../../../src/lib/modules/school-access";
import { ClassStructureService } from "../class-structure/class-structure.service";
import { RolesManagementService } from "../roles-management/roles-management.service";
import { AccessService } from "./access.service";
import { accountState, daysSince, fullName, monthYear, roleTitle, store, templateName, type AccountState } from "./staff-access.shared";

/**
 * The staff directory, the record behind each name, and the three things that happen to a
 * person's place at the school: they join (with the access they will hold), they are given
 * and relieved of work, and they leave — which is a gate, not a reminder.
 */

/** What the add-staff wizard offers, and the account role each choice becomes. */
export const ROLE_CHOICES: Record<string, UserRole> = {
  "Subject Teacher": UserRole.SUBJECT_TEACHER,
  "Form Master": UserRole.CLASS_TEACHER,
  "Head of Department": UserRole.HEAD_OF_DEPARTMENT,
  "Exam Officer": UserRole.EXAM_OFFICER,
  Registrar: UserRole.ADMIN_OFFICER,
  "Admissions Officer": UserRole.ADMISSIONS_OFFICER,
  Bursar: UserRole.BURSAR,
  Accountant: UserRole.ACCOUNTANT,
  Librarian: UserRole.LIBRARIAN,
  "School Nurse": UserRole.SCHOOL_NURSE,
  Counsellor: UserRole.GUIDANCE_COUNSELLOR,
  "ICT Officer": UserRole.ICT_CBT_ADMIN,
  Receptionist: UserRole.RECEPTIONIST,
  "Security Officer": UserRole.SECURITY_OFFICER,
  "Maintenance Officer": UserRole.MAINTENANCE_OFFICER,
  "Transport Coordinator": UserRole.TRANSPORT_COORDINATOR,
  "Store Officer": UserRole.STORE_OFFICER,
  "Vice Principal (Academics)": UserRole.VICE_PRINCIPAL_ACADEMICS,
  "Vice Principal (Administration)": UserRole.VICE_PRINCIPAL_ADMINISTRATION,
  Principal: UserRole.PRINCIPAL
};

const TEACHING_CHOICES = new Set(["Subject Teacher", "Form Master", "Head of Department", "Vice Principal (Academics)", "Principal"]);

const onboardSchema = z.object({
  title: z.string().optional(),
  name: z.string().trim().min(3, "Give their full name."),
  gender: z.string().optional(),
  phone: z.string().trim().min(6, "Their mobile number is their login."),
  email: z.string().trim().email("A work email is needed for the activation link."),
  staffNo: z.string().trim().optional(),
  nationality: z.string().optional(),
  address: z.string().optional(),
  kin: z.string().optional(),
  kinPhone: z.string().optional(),
  role: z.string().min(1, "Choose a role."),
  department: z.string().optional(),
  employment: z.string().default("Full time"),
  startDate: z.string().min(1, "Their access begins on a start date."),
  reportsTo: z.string().optional(),
  documents: z.array(z.string()).default([]),
  subjects: z.array(z.string()).default([]),
  arms: z.array(z.string()).default([]),
  formArm: z.string().optional(),
  periods: z.coerce.number().int().min(0).max(40).optional().or(z.literal("")),
  responsibilities: z.array(z.string()).default([]),
  children: z.string().optional(),
  hours: z.string().optional(),
  days: z.string().optional(),
  modules: z.array(z.string()).default([]),
  ticks: z.array(z.string()).default([]),
  scope: z.string().optional(),
  fees: z.string().optional(),
  approve: z.string().optional(),
  sensitive: z.array(z.string()).default([]),
  messaging: z.array(z.string()).default([]),
  exports: z.coerce.boolean().default(false),
  twoStep: z.coerce.boolean().default(false),
  accessEnds: z.string().optional(),
  channels: z.array(z.string()).default([]),
  validFor: z.string().default("7 days"),
  announce: z.coerce.boolean().default(true)
});

const assignmentSchema = z.object({
  kind: z.enum(["Subject", "Form class", "Duty", "Approval", "Function"]),
  subjectId: z.string().optional(),
  classId: z.string().optional(),
  what: z.string().trim().optional(),
  where: z.string().optional(),
  load: z.string().optional(),
  periods: z.coerce.number().int().min(1).max(40).optional().or(z.literal("")),
  startDate: z.string().optional(),
  ends: z.string().optional(),
  endDate: z.string().optional()
});

const offboardSchema = z.object({
  reason: z.string().min(1, "Say why they are leaving."),
  lastDay: z.string().min(1, "Give their last working day."),
  note: z.string().optional(),
  formMasters: z.record(z.string(), z.string()).default({}),
  subjects: z.record(z.string(), z.string()).default({}),
  revokeDelegations: z.coerce.boolean().default(true),
  confirm: z.string().optional()
});

const updateSchema = z.object({
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  designation: z.string().trim().optional(),
  department: z.string().trim().optional(),
  employmentType: z.string().trim().optional(),
  reportsTo: z.string().optional(),
  staffNo: z.string().trim().optional(),
  address: z.string().optional(),
  reason: z.string().trim().optional()
});

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

type Row = {
  id: string;
  userId: string;
  name: string;
  phone: string | null;
  email: string;
  staffNo: string | null;
  role: string;
  roleCode: UserRole;
  department: string;
  employment: string;
  joined: string | null;
  joinedLabel: string;
  account: AccountState;
  accountDays: number;
  lastLoginAt: string | null;
  openTasks: number;
  periods: number;
  isYou: boolean;
};

@Injectable()
export class StaffAccessService {
  constructor(
    private readonly structure: ClassStructureService,
    private readonly roles: RolesManagementService,
    private readonly access: AccessService
  ) {}

  async ok<T>(dataPromise: Promise<T>, message?: string) {
    return { ok: true, success: true, ...(message ? { message } : {}), data: await dataPromise };
  }

  private async audit(session: SessionPayload, action: AuditAction, entityType: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType, entityId, metadata } });
  }

  /* ───────────────────────── directory ───────────────────────── */

  async directory(session: SessionPayload) {
    const schoolId = session.schoolId;
    const [users, teaching, accessOverview, appraisals, offboarded] = await Promise.all([
      prisma.user.findMany({
        where: { schoolId, deletedAt: null, staffProfile: { isNot: null } },
        include: { staffProfile: { include: { department: { select: { name: true } } } } },
        orderBy: [{ firstName: "asc" }]
      }),
      this.structure.teaching(session),
      this.access.overview(session),
      prisma.staffAppraisal.groupBy({ by: ["reviewerId"], where: { schoolId, status: "DRAFT" }, _count: { _all: true } }),
      prisma.auditLog.count({ where: { schoolId, entityType: "StaffOffboarding" } })
    ]);

    const load = new Map(teaching.teachers.map((teacher) => [teacher.id, teacher]));
    const reviewing = new Map(appraisals.map((row) => [row.reviewerId, row._count._all]));
    const rows: Row[] = users
      .filter((user) => isSchoolStaffRole(user.role))
      .map((user) => {
        const state = accountState(user);
        const teacher = load.get(user.id);
        const profile = user.staffProfile!;
        return {
          id: profile.id,
          userId: user.id,
          name: fullName(user),
          phone: user.phone,
          email: user.email,
          staffNo: profile.employeeNo,
          role: templateName(user.role),
          roleCode: user.role,
          department: profile.department?.name ?? "No department",
          employment: profile.employmentType ?? "Full time",
          joined: profile.employmentDate.toISOString(),
          joinedLabel: `Joined ${monthYear(profile.employmentDate)}`,
          account: state.state,
          accountDays: state.days,
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
          openTasks: (teacher?.sheetsOwed ?? 0) + (reviewing.get(user.id) ?? 0),
          periods: teacher?.periods ?? 0,
          isYou: user.id === session.userId
        };
      });

    const count = (state: AccountState) => rows.filter((row) => row.account === state).length;
    return {
      counts: {
        total: rows.length,
        departments: new Set(rows.map((row) => row.department)).size,
        active: count("Active"),
        dormant: count("Dormant"),
        never: count("Never activated"),
        suspended: count("Suspended"),
        delegationsActive: accessOverview.delegations.filter((item) => item.status === "Active").length,
        delegationsExpired: accessOverview.delegations.filter((item) => item.status === "Expired").length,
        offboarded
      },
      never: rows.filter((row) => row.account === "Never activated").map((row) => ({ id: row.id, name: row.name, role: row.role, days: row.accountDays })),
      rows,
      delegations: accessOverview.delegations,
      roleOptions: Array.from(new Set(rows.map((row) => row.role))).sort(),
      departmentOptions: Array.from(new Set(rows.map((row) => row.department))).sort()
    };
  }

  /* ───────────────────────── one person ───────────────────────── */

  private async profileOrThrow(schoolId: string, staffId: string) {
    const profile = await prisma.staffProfile.findFirst({
      where: { id: staffId, schoolId, user: { deletedAt: null } },
      include: { user: true, department: true, campus: true, payBand: true }
    });
    if (!profile) throw new NotFoundException("That staff member does not exist.");
    return profile;
  }

  private async assertCanManage(session: SessionPayload, target: { id: string; role: UserRole }, verb: string) {
    if (isPlatformRole(session.role as never)) return;
    if (target.id === session.userId) throw new ForbiddenException(`Nobody can ${verb} their own account.`);
    if (!canManageRole(session.role as never, target.role as never)) {
      throw new ForbiddenException(`You cannot ${verb} somebody with equal or higher authority than yours.`);
    }
  }

  async record(session: SessionPayload, staffId: string) {
    const schoolId = session.schoolId;
    const profile = await this.profileOrThrow(schoolId, staffId);
    const user = profile.user;
    const [assignments, teaching, supervisor, groups, access, sessions, attempts] = await Promise.all([
      this.assignmentsOf(session, profile.userId),
      this.structure.teaching(session),
      profile.supervisorId ? prisma.user.findFirst({ where: { id: profile.supervisorId }, select: { id: true, firstName: true, lastName: true } }) : Promise.resolve(null),
      store(schoolId, "sensitive-groups").list<{ holders: string[] }>(),
      this.access.person(session, user.id),
      prisma.platformSession.findMany({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastActivityAt: "desc" }, take: 5 }),
      prisma.loginAttempt.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 6 })
    ]);
    const teacher = teaching.teachers.find((item) => item.id === user.id);
    const state = accountState(user);
    const peer = profile.departmentId
      ? await prisma.staffProfile.findFirst({
          where: { schoolId, id: { not: profile.id }, departmentId: profile.departmentId, user: { deletedAt: null, isActive: true } },
          include: { user: true }
        })
      : null;
    const held = groups.filter((group) => group.data.holders?.includes(user.id)).map((group) => group.name);

    return {
      id: profile.id,
      userId: user.id,
      name: fullName(user),
      email: user.email,
      phone: user.phone,
      staffNo: profile.employeeNo,
      designation: profile.designation,
      role: templateName(user.role),
      roleCode: user.role,
      department: profile.department?.name ?? "No department",
      campus: profile.campus?.name ?? "Main campus",
      employment: profile.employmentType ?? "Full time",
      since: profile.employmentDate.toISOString(),
      account: state.state,
      accountDays: state.days,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      reportsTo: supervisor ? { id: supervisor.id, name: fullName(supervisor) } : null,
      cover: peer ? { id: peer.userId, name: fullName(peer.user) } : null,
      personal: {
        gender: user.gender,
        dateOfBirth: user.dateOfBirth?.toISOString() ?? null,
        nationality: user.nationality,
        stateOfOrigin: user.stateOfOrigin,
        address: user.homeAddress,
        qualification: profile.qualification,
        years: profile.yearsOfExperience
      },
      sensitiveHeld: held,
      periods: teacher?.periods ?? 0,
      ceiling: teacher?.ceiling ?? teaching.schoolCeiling,
      subjects: teacher?.subjects ?? [],
      arms: teacher?.arms ?? [],
      assignments,
      pay: profile.payBand
        ? { band: profile.payBand.code, bandName: profile.payBand.name, step: profile.payStep, method: profile.payMethod }
        : null,
      access: { scope: access.scope, fees: access.fees, approve: access.approve, above: access.above },
      mfa: user.mfaEnabled,
      sessions: sessions.map((item) => ({ id: item.id, device: item.device ?? "Unknown device", ip: item.ipAddress, lastActivityAt: item.lastActivityAt.toISOString(), startedAt: item.createdAt.toISOString() })),
      signIns: attempts.map((item) => ({ id: item.id, ok: item.success, reason: item.reason, device: item.device, ip: item.ipAddress, at: item.createdAt.toISOString() }))
    };
  }

  /* ───────────────────────── what a person holds ───────────────────────── */

  private async assignmentsOf(session: SessionPayload, userId: string) {
    const schoolId = session.schoolId;
    const [teaching, arms, duties] = await Promise.all([
      this.structure.teaching(session),
      prisma.classRoom.findMany({ where: { schoolId, classTeacherId: userId, deletedAt: null }, include: { _count: { select: { students: { where: { status: "ACTIVE" } } } } } }),
      store(schoolId, "staff-duties").get<{ items: Array<{ id: string; what: string; kind: string; where: string; load: string; since: string; state: string; endsOn?: string | null }> }>(userId)
    ]);
    const out: Array<{ id: string; source: "subject" | "form" | "duty"; ref: string; what: string; kind: string; where: string; load: string; since: string; state: string }> = [];
    for (const row of teaching.subjectArms.filter((item) => item.teacher?.id === userId)) {
      out.push({ id: `s:${row.id}`, source: "subject", ref: row.id, what: row.subject, kind: "Subject", where: row.arm, load: `${row.periods} periods`, since: "", state: "Active" });
    }
    for (const row of teaching.subjectArms.filter((item) => item.assistant?.id === userId)) {
      out.push({ id: `a:${row.id}`, source: "subject", ref: row.id, what: `${row.subject} · second teacher`, kind: "Subject", where: row.arm, load: "Cover", since: "", state: "Active" });
    }
    for (const arm of arms) {
      out.push({ id: `f:${arm.id}`, source: "form", ref: arm.id, what: "Form master", kind: "Form class", where: `${arm.name}${arm.arm && !arm.name.endsWith(arm.arm) ? ` ${arm.arm}` : ""}`, load: `Daily register · ${arm._count.students} students`, since: "", state: "Active" });
    }
    for (const item of duties?.data.items ?? []) {
      out.push({ id: `d:${item.id}`, source: "duty", ref: item.id, what: item.what, kind: item.kind, where: item.where, load: item.load, since: item.since, state: item.state });
    }
    return out;
  }

  async assignments(session: SessionPayload, staffId: string) {
    const profile = await this.profileOrThrow(session.schoolId, staffId);
    return this.assignmentsOf(session, profile.userId);
  }

  async addAssignment(session: SessionPayload, staffId: string, body: unknown) {
    const input = assignmentSchema.parse(body);
    const profile = await this.profileOrThrow(session.schoolId, staffId);
    const schoolId = session.schoolId;
    if (input.kind === "Subject") {
      if (!input.subjectId || !input.classId) throw new BadRequestException("A subject assignment names the subject and the arm.");
      await this.structure.mapSubject(session, {
        teacherId: profile.userId,
        subjectId: input.subjectId,
        classIds: [input.classId],
        role: "PRIMARY",
        periodsPerWeek: input.periods === "" ? undefined : input.periods,
        overCeilingReason: "Assigned from the staff record"
      });
    } else if (input.kind === "Form class") {
      if (!input.classId) throw new BadRequestException("Choose the arm they are form master of.");
      await prisma.classRoom.update({ where: { id: input.classId }, data: { classTeacherId: profile.userId } });
    } else {
      if (!input.what) throw new BadRequestException("Say what they hold.");
      const current = (await store(schoolId, "staff-duties").get<{ items: Array<Record<string, unknown>> }>(profile.userId))?.data.items ?? [];
      current.push({
        id: `x${Date.now().toString(36)}`,
        what: input.what,
        kind: input.kind,
        where: input.where ?? "The whole school",
        load: input.load ?? "Standing",
        since: input.startDate ?? new Date().toISOString().slice(0, 10),
        state: "Active",
        endsOn: input.ends === "On a date I choose" ? input.endDate ?? null : null
      });
      await store(schoolId, "staff-duties").put(profile.userId, fullName(profile.user), { items: current });
    }
    await this.audit(session, AuditAction.CREATE, "StaffProfile", profile.id, { summary: `Assigned ${input.kind.toLowerCase()} · ${input.what ?? input.kind}` });
    return { id: profile.id };
  }

  async removeAssignment(session: SessionPayload, staffId: string, assignmentId: string) {
    const profile = await this.profileOrThrow(session.schoolId, staffId);
    const [kind, ref] = assignmentId.split(":");
    if (kind === "s") {
      await prisma.classSubject.updateMany({ where: { id: ref, schoolId: session.schoolId, teacherId: profile.userId }, data: { teacherId: null } });
    } else if (kind === "a") {
      await prisma.classSubject.updateMany({ where: { id: ref, schoolId: session.schoolId, assistantTeacherId: profile.userId }, data: { assistantTeacherId: null } });
    } else if (kind === "f") {
      await prisma.classRoom.updateMany({ where: { id: ref, schoolId: session.schoolId, classTeacherId: profile.userId }, data: { classTeacherId: null } });
    } else if (kind === "d") {
      const entry = await store(session.schoolId, "staff-duties").get<{ items: Array<{ id: string }> }>(profile.userId);
      await store(session.schoolId, "staff-duties").put(profile.userId, fullName(profile.user), { items: (entry?.data.items ?? []).filter((item) => item.id !== ref) });
    }
    await this.audit(session, AuditAction.DELETE, "StaffProfile", profile.id, { summary: "An assignment was removed" });
    return { id: assignmentId };
  }

  /* ───────────────────────── invitations ───────────────────────── */

  private async issueLink(userId: string, schoolId: string, days: number) {
    const token = randomBytes(32).toString("base64url");
    await prisma.passwordResetToken.updateMany({ where: { userId, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
    await prisma.passwordResetToken.create({
      data: { userId, schoolId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + days * 86_400_000) }
    });
    return `/reset-password?token=${token}`;
  }

  async invite(session: SessionPayload, body: unknown) {
    const input = z.object({ userIds: z.array(z.string()).min(1, "Choose who to send it to."), days: z.coerce.number().int().min(1).max(30).default(7) }).parse(body);
    const out: Array<{ userId: string; name: string; link: string; phone: string | null; email: string }> = [];
    for (const userId of input.userIds) {
      const user = await prisma.user.findFirst({ where: { id: userId, schoolId: session.schoolId, deletedAt: null } });
      if (!user) continue;
      out.push({ userId, name: fullName(user), link: await this.issueLink(user.id, session.schoolId, input.days), phone: user.phone, email: user.email });
    }
    await this.audit(session, AuditAction.RESET_PASSWORD, "User", input.userIds[0], { summary: `Activation ${out.length === 1 ? "link" : "links"} issued to ${out.length}`, validForDays: input.days });
    return { links: out };
  }

  /* ───────────────────────── onboarding ───────────────────────── */

  roleOptions(session: SessionPayload) {
    return Object.entries(ROLE_CHOICES)
      .filter(([, role]) => isPlatformRole(session.role as never) || canAssignRole(session.role as never, role as never))
      .map(([label, role]) => ({ label, role, teaching: TEACHING_CHOICES.has(label), template: roleTemplateFor(role as never) ?? roleTitle(role) }));
  }

  async onboard(session: SessionPayload, body: unknown) {
    const input = onboardSchema.parse(body);
    const schoolId = session.schoolId;
    const role = ROLE_CHOICES[input.role];
    if (!role) throw new BadRequestException("That role is not offered.");
    if (!isPlatformRole(session.role as never) && !canAssignRole(session.role as never, role as never)) {
      throw new ForbiddenException(`You cannot create a ${input.role}: it is equal to or above your own authority.`);
    }
    const email = input.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) throw new BadRequestException("A person with that email already has an account.");

    const [first, ...rest] = input.name.replace(/^(Mr|Mrs|Miss|Ms|Dr|Prof|Alhaji|Hajiya|Rev)\.?\s+/i, "").trim().split(/\s+/);
    const last = rest.join(" ") || first;
    const department = input.department ? await prisma.department.findFirst({ where: { schoolId, name: { equals: input.department, mode: "insensitive" } } }) : null;
    const employeeNo = input.staffNo || (await this.nextEmployeeNo(schoolId));
    if (await prisma.staffProfile.findFirst({ where: { schoolId, employeeNo } })) throw new BadRequestException(`Staff number ${employeeNo} is already taken.`);
    const supervisor = input.reportsTo ? await prisma.user.findFirst({ where: { id: input.reportsTo, schoolId, deletedAt: null } }) : null;
    const start = new Date(input.startDate);
    if (Number.isNaN(start.getTime())) throw new BadRequestException("The start date is not a date.");

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          schoolId,
          firstName: first,
          lastName: last,
          email,
          phone: input.phone,
          gender: input.gender === "Female" ? "FEMALE" : input.gender === "Male" ? "MALE" : null,
          nationality: input.nationality ?? null,
          homeAddress: input.address || null,
          nextOfKinFirstName: input.kin || null,
          nextOfKinPhone: input.kinPhone || null,
          role,
          // Nobody ever types a password here: they choose their own from the activation link.
          passwordHash: hashPassword(randomBytes(24).toString("hex")),
          passwordResetRequired: true,
          isActive: true,
          accountStatus: "ACTIVE",
          mfaEnabled: false
        }
      });
      const staff = await tx.staffProfile.create({
        data: {
          schoolId,
          userId: user.id,
          employeeNo,
          designation: input.role,
          staffType: getStaffTypeForRole(role),
          departmentId: department?.id ?? null,
          employmentType: input.employment,
          employmentDate: start,
          supervisorId: supervisor?.id ?? null,
          notes: input.documents.length ? `On file: ${input.documents.join(", ")}` : null
        }
      });
      return { user, staff };
    });

    const warnings: string[] = [];
    // What they teach, and who they answer for: each is a real mapping, refused if it breaks a rule.
    if (TEACHING_CHOICES.has(input.role) && input.subjects.length && input.arms.length) {
      const perWeek = input.periods === "" || input.periods === undefined ? undefined : Math.max(1, Math.round(Number(input.periods) / Math.max(1, input.subjects.length * input.arms.length)));
      for (const subjectId of input.subjects) {
        try {
          await this.structure.mapSubject(session, { teacherId: created.user.id, subjectId, classIds: input.arms, role: "PRIMARY", periodsPerWeek: perWeek, overCeilingReason: "Assigned when they were added" });
        } catch (cause) {
          warnings.push(cause instanceof Error ? cause.message : "A subject could not be assigned.");
        }
      }
    }
    if (input.formArm) {
      await prisma.classRoom.update({ where: { id: input.formArm }, data: { classTeacherId: created.user.id } }).catch(() => warnings.push("The form class could not be assigned."));
    }
    if (input.responsibilities.length) {
      await store(schoolId, "staff-duties").put(created.user.id, fullName(created.user), {
        items: input.responsibilities.map((what, index) => ({
          id: `i${index}${Date.now().toString(36)}`,
          what,
          kind: "Duty",
          where: "The whole school",
          load: "Standing",
          since: start.toISOString().slice(0, 10),
          state: "Active"
        }))
      });
    }

    // The access they hold from the first sign-in.
    if (input.ticks.length) {
      try {
        await this.access.setAccessFromTicks(session, created.user, input.ticks);
      } catch (cause) {
        warnings.push(cause instanceof Error ? cause.message : "Their access could not be set exactly.");
      }
    }
    await store(schoolId, "access-profiles").put(created.user.id, fullName(created.user), {
      scope: input.scope,
      fees: input.fees,
      approve: input.approve,
      twoStep: input.twoStep,
      exports: input.exports,
      messaging: input.messaging,
      accessEnds: input.accessEnds
    });
    for (const groupName of input.sensitive) {
      const groups = await store(schoolId, "sensitive-groups").list<{ holders: string[] }>();
      const found = groups.find((group) => group.name.toLowerCase() === groupName.toLowerCase());
      if (found) await store(schoolId, "sensitive-groups").put(found.code ?? found.id, found.name, { ...found.data, holders: Array.from(new Set([...(found.data.holders ?? []), created.user.id])) });
    }

    const days = Number.parseInt(input.validFor, 10) || 7;
    const link = await this.issueLink(created.user.id, schoolId, days);
    if (input.announce) {
      await prisma.announcement.create({
        data: { schoolId, createdById: session.userId, channel: "IN_APP", audience: "Teachers and staff", title: `${fullName(created.user)} has joined`, body: `${fullName(created.user)} joins as ${input.role}${department ? ` in ${department.name}` : ""}.` }
      });
    }
    this.roles.invalidatePermissionCache(created.user.id, schoolId);
    await this.audit(session, AuditAction.CREATE, "StaffProfile", created.staff.id, { summary: `Staff member created · ${input.role}`, employeeNo, warnings: warnings.length });
    return { id: created.staff.id, userId: created.user.id, name: fullName(created.user), employeeNo, link, warnings };
  }

  private async nextEmployeeNo(schoolId: string): Promise<string> {
    const numbers = await prisma.staffProfile.findMany({ where: { schoolId }, select: { employeeNo: true } });
    const highest = numbers.reduce((max, item) => Math.max(max, Number.parseInt(item.employeeNo.replace(/\D+/g, ""), 10) || 0), 0);
    return `EMP-${String(highest + 1).padStart(3, "0")}`;
  }

  /* ───────────────────────── edit, suspend ───────────────────────── */

  async update(session: SessionPayload, staffId: string, body: unknown) {
    const input = updateSchema.parse(body);
    const profile = await this.profileOrThrow(session.schoolId, staffId);
    await this.assertCanManage(session, profile.user, "edit the record of");
    if (input.email && input.email.toLowerCase() !== profile.user.email) {
      if (await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } })) throw new BadRequestException("That email already has an account.");
    }
    const department = input.department && input.department !== "No department" ? await prisma.department.findFirst({ where: { schoolId: session.schoolId, name: { equals: input.department, mode: "insensitive" } } }) : null;
    await prisma.$transaction([
      prisma.user.update({
        where: { id: profile.userId },
        data: { ...(input.phone !== undefined ? { phone: input.phone || null } : {}), ...(input.email ? { email: input.email.toLowerCase() } : {}), ...(input.address !== undefined ? { homeAddress: input.address || null } : {}) }
      }),
      prisma.staffProfile.update({
        where: { id: profile.id },
        data: {
          ...(input.designation ? { designation: input.designation } : {}),
          ...(input.employmentType ? { employmentType: input.employmentType } : {}),
          ...(input.staffNo ? { employeeNo: input.staffNo } : {}),
          ...(input.reportsTo !== undefined ? { supervisorId: input.reportsTo || null } : {}),
          ...(input.department !== undefined ? { departmentId: department?.id ?? null } : {})
        }
      })
    ]);
    await this.audit(session, AuditAction.UPDATE, "StaffProfile", profile.id, { summary: "Staff record edited", fields: Object.keys(input).filter((key) => key !== "reason"), reason: input.reason });
    return { id: profile.id };
  }

  async suspend(session: SessionPayload, staffId: string, body: unknown) {
    const input = z
      .object({
        reason: z.string().min(1, "Say why."),
        routed: z.string().optional(),
        moveTo: z.string().optional(),
        duties: z.string().optional(),
        until: z.string().optional(),
        liftOn: z.string().optional(),
        note: z.string().optional(),
        lift: z.coerce.boolean().optional()
      })
      .parse(body);
    const profile = await this.profileOrThrow(session.schoolId, staffId);
    await this.assertCanManage(session, profile.user, input.lift ? "restore" : "suspend");
    await prisma.user.update({
      where: { id: profile.userId },
      data: input.lift ? { accountStatus: "ACTIVE", isActive: true, suspendedAt: null } : { accountStatus: "SUSPENDED", isActive: false, suspendedAt: new Date() }
    });
    if (!input.lift && input.duties === "Reassign now") {
      // The arm they led has nobody marking its register: say so rather than leave it silently.
      const arms = await prisma.classRoom.count({ where: { schoolId: session.schoolId, classTeacherId: profile.userId, deletedAt: null } });
      if (arms) await this.audit(session, AuditAction.UPDATE, "StaffProfile", profile.id, { summary: `${arms} form ${arms === 1 ? "class" : "classes"} need a new form master` });
    }
    this.roles.invalidatePermissionCache(profile.userId, session.schoolId);
    await this.audit(session, input.lift ? AuditAction.ACTIVATE : AuditAction.SUSPEND, "StaffProfile", profile.id, {
      summary: input.lift ? "Account restored" : `Account suspended · ${input.reason}`,
      routed: input.routed,
      note: input.note
    });
    return { id: profile.id };
  }

  /* ───────────────────────── offboarding ───────────────────────── */

  async offboardingPlan(session: SessionPayload, staffId: string) {
    const schoolId = session.schoolId;
    const profile = await this.profileOrThrow(schoolId, staffId);
    const [arms, teaching, delegations, others] = await Promise.all([
      prisma.classRoom.findMany({ where: { schoolId, classTeacherId: profile.userId, deletedAt: null }, include: { _count: { select: { students: { where: { status: "ACTIVE" } } } } } }),
      this.structure.teaching(session),
      this.access.overview(session).then((overview) => overview.delegations.filter((item) => item.userId === profile.userId)),
      prisma.user.findMany({ where: { schoolId, deletedAt: null, id: { not: profile.userId }, staffProfile: { isNot: null }, isActive: true }, orderBy: { firstName: "asc" } })
    ]);
    const subjects = teaching.subjectArms.filter((row) => row.teacher?.id === profile.userId);
    const owed = subjects.filter((row) => row.scores.state === "In progress" || row.scores.state === "Returned");
    const approvals = await prisma.approvalRequest.count({ where: { schoolId, assigneeId: profile.userId, status: "PENDING" } });
    return {
      id: profile.id,
      name: fullName(profile.user),
      formClasses: arms.map((arm) => ({ id: arm.id, name: arm.name, roll: arm._count.students })),
      subjects: subjects.map((row) => ({ id: row.id, subject: row.subject, arm: row.arm, classId: row.classId })),
      unsubmittedSheets: owed.length,
      delegations: delegations.length,
      routedApprovals: approvals,
      candidates: others.filter((user) => isSchoolStaffRole(user.role)).map((user) => ({ id: user.id, name: fullName(user), role: templateName(user.role) }))
    };
  }

  async offboard(session: SessionPayload, staffId: string, body: unknown) {
    const input = offboardSchema.parse(body);
    const schoolId = session.schoolId;
    const profile = await this.profileOrThrow(schoolId, staffId);
    await this.assertCanManage(session, profile.user, "offboard");
    const plan = await this.offboardingPlan(session, staffId);

    // The gate: everything they hold must find an owner before the exit can complete.
    const unowned = [
      ...plan.formClasses.filter((arm) => !input.formMasters[arm.id]).map((arm) => `${arm.name} needs a new form master`),
      ...plan.subjects.filter((row) => !input.subjects[row.id]).map((row) => `${row.subject} in ${row.arm} needs a teacher`)
    ];
    if (unowned.length) {
      throw new BadRequestException(`The exit cannot complete while ${unowned.length} ${unowned.length === 1 ? "thing is" : "things are"} unowned: ${unowned.slice(0, 3).join("; ")}${unowned.length > 3 ? "; and more" : ""}.`);
    }
    if (plan.unsubmittedSheets && input.confirm !== "OFFBOARD") {
      throw new BadRequestException(`${plan.unsubmittedSheets} score ${plan.unsubmittedSheets === 1 ? "sheet is" : "sheets are"} unfinished. Type OFFBOARD to confirm they will be finished by whoever takes them over.`);
    }

    await prisma.$transaction(async (tx) => {
      for (const [armId, userId] of Object.entries(input.formMasters)) {
        await tx.classRoom.updateMany({ where: { id: armId, schoolId, classTeacherId: profile.userId }, data: { classTeacherId: userId } });
      }
      for (const [mappingId, userId] of Object.entries(input.subjects)) {
        await tx.classSubject.updateMany({ where: { id: mappingId, schoolId, teacherId: profile.userId }, data: { teacherId: userId, assignedById: session.userId, assignedAt: new Date() } });
      }
      await tx.classSubject.updateMany({ where: { schoolId, assistantTeacherId: profile.userId }, data: { assistantTeacherId: null } });
      await tx.user.update({ where: { id: profile.userId }, data: { isActive: false, accountStatus: "INACTIVE", suspendedAt: new Date() } });
    });
    if (input.revokeDelegations) {
      for (const delegation of (await this.access.overview(session)).delegations.filter((item) => item.userId === profile.userId)) {
        await this.access.endDelegation(session, delegation.id);
      }
    }
    this.roles.invalidatePermissionCache(profile.userId, schoolId);
    await this.audit(session, AuditAction.UPDATE, "StaffOffboarding", profile.id, {
      summary: `Offboarded · ${input.reason}`,
      lastDay: input.lastDay,
      note: input.note,
      reassigned: Object.keys(input.formMasters).length + Object.keys(input.subjects).length
    });
    return { id: profile.id, name: fullName(profile.user), reassigned: Object.keys(input.formMasters).length + Object.keys(input.subjects).length };
  }

  /* ───────────────────────── sensitive fields ───────────────────────── */

  /** Opening the sensitive fields is logged at the moment it opens, with the reason given. */
  async reveal(session: SessionPayload, staffId: string, body: unknown) {
    const input = z.object({ reason: z.string().trim().min(5, "A reason is required, and it is kept.") }).parse(body);
    const profile = await this.profileOrThrow(session.schoolId, staffId);
    const groups = await store(session.schoolId, "sensitive-groups").list<{ holders: string[]; covers: string[] }>();
    const mayOpen =
      isPlatformRole(session.role as never) ||
      session.userId === profile.userId ||
      groups.some((group) => group.data.covers?.includes("Staff salary band and next of kin") && group.data.holders?.includes(session.userId));
    if (!mayOpen) {
      await this.audit(session, AuditAction.EXPORT, "SensitiveReveal", profile.id, { summary: `Refused · ${fullName(profile.user)}'s sensitive fields`, reason: input.reason });
      throw new ForbiddenException("You do not hold the group these fields sit in. The attempt has been logged.");
    }
    await this.audit(session, AuditAction.EXPORT, "SensitiveReveal", profile.id, { summary: `Opened ${fullName(profile.user)}'s sensitive fields`, reason: input.reason });
    const user = profile.user;
    return {
      name: fullName(user),
      fields: [
        ["Next of kin", [user.nextOfKinFirstName, user.nextOfKinLastName].filter(Boolean).join(" ") || "Not recorded"],
        ["Next of kin phone", user.nextOfKinPhone ?? "Not recorded"],
        ["Next of kin relationship", user.nextOfKinRelationship ?? "Not recorded"],
        ["Salary band", profile.payBand ? `${profile.payBand.code} · ${profile.payBand.name} · step ${profile.payStep ?? "—"}` : "Not on a band"],
        ["Blood group and genotype", [user.bloodGroup, user.genotype].filter(Boolean).join(" · ") || "Not recorded"],
        ["Emergency contact", [profile.emergencyContactName, profile.emergencyContactPhone].filter(Boolean).join(" · ") || "Not recorded"]
      ]
    };
  }

  /* ───────────────────────── activity ───────────────────────── */

  async activity(session: SessionPayload) {
    const schoolId = session.schoolId;
    const term = await prisma.term.findFirst({ where: { schoolId, isCurrent: true } });
    const directory = await this.directory(session);
    const teaching = await this.structure.teaching(session);
    const now = new Date();
    const termDay = term ? Math.max(1, daysSince(term.startDate, now)) : 0;

    const marked = term
      ? await prisma.studentAttendance.groupBy({ by: ["markedById", "date"], where: { schoolId, termId: term.id, markedBy: { schoolId } }, _count: { _all: true } })
      : [];
    const registerDays = new Map<string, Set<string>>();
    for (const row of marked) {
      registerDays.set(row.markedById, (registerDays.get(row.markedById) ?? new Set()).add(row.date.toISOString().slice(0, 10)));
    }
    const schoolDays = new Set(marked.map((row) => row.date.toISOString().slice(0, 10))).size;

    const sheets = await prisma.resultSheet.findMany({ where: { schoolId, ...(term ? { termId: term.id } : {}) }, select: { classId: true, teacherComment: true } });
    const remarksDone = new Map<string, { written: number; roll: number }>();
    const arms = await prisma.classRoom.findMany({ where: { schoolId, deletedAt: null, classTeacherId: { not: null } }, include: { _count: { select: { students: { where: { status: "ACTIVE" } } } } } });
    for (const arm of arms) {
      const own = sheets.filter((sheet) => sheet.classId === arm.id);
      const current = remarksDone.get(arm.classTeacherId!) ?? { written: 0, roll: 0 };
      current.written += own.filter((sheet) => sheet.teacherComment && sheet.teacherComment.trim()).length;
      current.roll += arm._count.students;
      remarksDone.set(arm.classTeacherId!, current);
    }

    const approvals = await prisma.approvalRequest.groupBy({ by: ["decidedById", "status"], where: { schoolId, decidedById: { not: null } }, _count: { _all: true } });
    const open = await prisma.approvalRequest.groupBy({ by: ["assigneeId"], where: { schoolId, status: "PENDING", assigneeId: { not: null } }, _count: { _all: true } });
    const messages = await prisma.announcement.groupBy({ by: ["createdById"], where: { schoolId, createdById: { not: null } }, _count: { _all: true } });

    const rows = directory.rows.map((row) => {
      const mine = teaching.subjectArms.filter((item) => item.teacher?.id === row.userId);
      const states = (name: string) => mine.filter((item) => item.scores.state === name).length;
      const decided = approvals.filter((item) => item.decidedById === row.userId).reduce((sum, item) => sum + item._count._all, 0);
      const pending = open.find((item) => item.assigneeId === row.userId)?._count._all ?? 0;
      const remarks = remarksDone.get(row.userId);
      const days = registerDays.get(row.userId)?.size ?? 0;
      return {
        id: row.id,
        userId: row.userId,
        name: row.name,
        role: row.role,
        department: row.department,
        isYou: row.isYou,
        registers: arms.some((arm) => arm.classTeacherId === row.userId) ? { marked: days, of: schoolDays } : null,
        sheets: mine.length ? { total: mine.length, submitted: mine.length - states("In progress") - states("Not started"), returned: states("Returned"), inProgress: states("In progress") } : null,
        remarks: remarks ? { written: remarks.written, of: remarks.roll } : null,
        approvals: decided || pending ? { decided, open: pending } : null,
        messages: messages.find((item) => item.createdById === row.userId)?._count._all ?? 0,
        lastLoginAt: row.lastLoginAt,
        account: row.account
      };
    });

    const withRegisters = rows.filter((row) => row.registers);
    const registersMarked = withRegisters.reduce((sum, row) => sum + (row.registers?.marked ?? 0), 0);
    const registersOf = withRegisters.reduce((sum, row) => sum + (row.registers?.of ?? 0), 0);
    return {
      term: term ? { name: term.name, day: termDay } : null,
      rows,
      totals: {
        staff: rows.length,
        registerPct: registersOf ? Math.round((registersMarked / registersOf) * 100) : null,
        sheetsOutstanding: rows.reduce((sum, row) => sum + (row.sheets ? row.sheets.inProgress + row.sheets.returned : 0), 0),
        teachersWithSheets: rows.filter((row) => row.sheets && row.sheets.inProgress + row.sheets.returned > 0).length,
        remarksOutstanding: rows.reduce((sum, row) => sum + (row.remarks ? Math.max(0, row.remarks.of - row.remarks.written) : 0), 0),
        formMastersNotStarted: rows.filter((row) => row.remarks && row.remarks.written === 0 && row.remarks.of > 0).length
      }
    };
  }

}
