import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

import { hashPassword } from "../../../../src/lib/auth/password";
import { canAssignRole, canManageRole, getStaffTypeForRole, isAcademicRole, isPlatformRole, isSchoolStaffRole } from "../../../../src/lib/auth/role-architecture";
import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { RolesManagementService } from "../roles-management/roles-management.service";

const optionalText = z.string().trim().optional().or(z.literal(""));
const optionalEmail = z.string().trim().email().optional().or(z.literal(""));
const optionalDate = z.string().trim().optional().or(z.literal(""));

const staffRoles = Object.values(UserRole).filter((role) => isSchoolStaffRole(role));

const staffPayloadSchema = z.object({
  firstName: z.string().trim().min(2),
  middleName: optionalText,
  lastName: z.string().trim().min(2),
  preferredName: optionalText,
  email: z.string().trim().email(),
  phone: optionalText,
  secondaryPhone: optionalText,
  alternateEmail: optionalEmail,
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional().or(z.literal("")),
  dateOfBirth: optionalDate,
  address: optionalText,
  homeAddress: optionalText,
  residentialAddress: optionalText,
  city: optionalText,
  country: optionalText,
  stateOfOrigin: optionalText,
  lga: optionalText,
  nationality: optionalText,
  religion: optionalText,
  maritalStatus: optionalText,
  bloodGroup: optionalText,
  genotype: optionalText,
  employeeNo: optionalText,
  staffId: optionalText,
  staffType: z.enum(["ACADEMIC", "NON_ACADEMIC"]).default("ACADEMIC"),
  designation: z.string().trim().min(2),
  departmentId: optionalText,
  campusId: optionalText,
  employmentType: optionalText,
  staffCategory: optionalText,
  qualification: optionalText,
  yearsOfExperience: z.coerce.number().int().min(0).optional().or(z.literal("")),
  employmentDate: optionalDate,
  dateOfEmployment: optionalDate,
  emergencyContactName: optionalText,
  emergencyContactPhone: optionalText,
  nextOfKinFirstName: optionalText,
  nextOfKinLastName: optionalText,
  nextOfKinPhone: optionalText,
  nextOfKinEmail: optionalEmail,
  nextOfKinRelationship: optionalText,
  nextOfKinAddress: optionalText,
  role: z.nativeEnum(UserRole).default("TEACHER"),
  primaryRole: z.nativeEnum(UserRole).optional(),
  canLogin: z.coerce.boolean().default(true),
  password: z.string().min(8).optional().or(z.literal("")),
  notes: optionalText,
});

const staffUpdateSchema = staffPayloadSchema.partial();

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "LOCKED", "PENDING"]),
  reason: optionalText,
});

const roleAssignSchema = z.object({
  primaryRole: z.nativeEnum(UserRole).optional().or(z.literal("")),
  roleIds: z.union([z.array(z.string()), z.string()]).optional(),
});

function asNullable(value: unknown) {
  if (typeof value !== "string") return value ?? null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function dateOrDefault(value: unknown, fallback = new Date()) {
  if (typeof value !== "string" || value.trim() === "") return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException("Invalid date value.");
  return date;
}

function fullName(user: { firstName: string; middleName?: string | null; lastName: string; preferredName?: string | null }) {
  return user.preferredName?.trim() || [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ");
}

function normalizeRoleIds(value: string[] | string | undefined) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
}

function inferStaffType(role: UserRole, requested?: "ACADEMIC" | "NON_ACADEMIC") {
  if (requested) return requested;
  return getStaffTypeForRole(role);
}

@Injectable()
export class StaffService {
  constructor(private readonly rolesManagementService: RolesManagementService) {}

  ok<T>(data: Promise<T> | T, message = "Request completed") {
    return Promise.resolve(data).then((resolved) => ({ ok: true, success: true, message, data: resolved }));
  }

  private async audit(session: SessionPayload, action: AuditAction, entityType: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    await prisma.auditLog.create({
      data: {
        schoolId: session.schoolId,
        actorId: session.userId,
        action,
        entityType,
        entityId,
        metadata,
      },
    });
  }

  private async assertCanManageStaffUser(session: SessionPayload, targetUser: { id: string; role: UserRole }, action: string) {
    if (isPlatformRole(session.role)) return;
    const assignedRoles = await prisma.userRoleAssignment.findMany({
      where: { schoolId: session.schoolId, userId: targetUser.id, role: { deletedAt: null, systemRole: { not: null } } },
      include: { role: true }
    });
    const targetRoles = [targetUser.role, ...assignedRoles.map((assignment) => assignment.role.systemRole).filter((role): role is UserRole => Boolean(role))];
    if (targetRoles.some((role) => !canManageRole(session.role, role))) {
      throw new ForbiddenException(`You cannot ${action} a staff member with equal or higher school authority.`);
    }
  }

  private assertCanAssignStaffRole(session: SessionPayload, role: UserRole) {
    if (!staffRoles.includes(role)) throw new BadRequestException("Select a valid school staff role.");
    if (isPlatformRole(session.role)) return;
    if (!canAssignRole(session.role, role)) {
      throw new ForbiddenException("You cannot assign a role that is equal to or above your authority.");
    }
  }

  private async nextEmployeeNo(schoolId: string) {
    const count = await prisma.staffProfile.count({ where: { schoolId } });
    return `STF-${String(count + 1).padStart(4, "0")}`;
  }

  private mapStaff(profile: Prisma.StaffProfileGetPayload<{
    include: {
      department: true;
      campus: true;
      user: {
        include: {
          roleAssignments: { include: { role: true } };
          profileDocuments: true;
        };
      };
    };
  }>) {
    const subjects = profile.user
      ? profile.user.roleAssignments.map((assignment) => assignment.role.name)
      : [];
    return {
      id: profile.id,
      userId: profile.userId,
      fullName: fullName(profile.user),
      firstName: profile.user.firstName,
      middleName: profile.user.middleName,
      lastName: profile.user.lastName,
      email: profile.user.email,
      phone: profile.user.phone,
      avatarUrl: profile.user.avatarUrl,
      role: profile.user.role,
      roles: subjects,
      status: profile.user.accountStatus,
      isActive: profile.user.isActive,
      staffType: profile.staffType,
      employeeNo: profile.employeeNo,
      designation: profile.designation,
      departmentId: profile.departmentId,
      departmentName: profile.department?.name,
      campusName: profile.campus?.name,
      employmentType: profile.employmentType,
      staffCategory: profile.staffCategory,
      qualification: profile.qualification,
      yearsOfExperience: profile.yearsOfExperience,
      employmentDate: profile.employmentDate.toISOString(),
      emergencyContactName: profile.emergencyContactName,
      emergencyContactPhone: profile.emergencyContactPhone,
      notes: profile.notes,
      documentCount: profile.user.profileDocuments.length,
      lastLoginAt: profile.user.lastLoginAt?.toISOString(),
    };
  }

  private staffQuery(schoolId: string) {
    return prisma.staffProfile.findMany({
      where: { schoolId, user: { deletedAt: null } },
      include: {
        department: true,
        campus: true,
        user: {
          include: {
            roleAssignments: { where: { schoolId, role: { deletedAt: null } }, include: { role: true } },
            profileDocuments: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: [{ employeeNo: "asc" }],
    });
  }

  async listStaff(session: SessionPayload, query: Record<string, string | undefined>) {
    const search = query.search?.toLowerCase().trim();
    const staffType = query.staffType && query.staffType !== "all" ? query.staffType : undefined;
    const status = query.status && query.status !== "all" ? query.status : undefined;
    const role = query.role && query.role !== "all" ? query.role : undefined;
    const teacherOnly = query.view === "teachers";

    const profiles = await this.staffQuery(session.schoolId);
    return profiles
      .map((profile) => this.mapStaff(profile))
      .filter((profile) => !staffType || profile.staffType === staffType)
      .filter((profile) => !status || profile.status === status)
      .filter((profile) => !role || profile.role === role)
      .filter((profile) => !teacherOnly || isAcademicRole(profile.role))
      .filter((profile) => {
        if (!search) return true;
        return [
          profile.fullName,
          profile.email,
          profile.phone,
          profile.employeeNo,
          profile.designation,
          profile.departmentName,
          profile.role,
          profile.staffType,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search);
      });
  }

  async getStaff(session: SessionPayload, staffId: string) {
    const profile = await prisma.staffProfile.findFirst({
      where: { id: staffId, schoolId: session.schoolId, user: { deletedAt: null } },
      include: {
        department: true,
        campus: true,
        user: {
          include: {
            school: { select: { name: true, schoolCode: true } },
            classesLed: true,
            roleAssignments: { where: { schoolId: session.schoolId, role: { deletedAt: null } }, include: { role: true } },
            profileDocuments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
            loginAttempts: { orderBy: { createdAt: "desc" }, take: 10 },
          },
        },
      },
    });
    if (!profile) throw new NotFoundException("Staff member not found.");

    const [classSubjects, timetable] = await Promise.all([
      prisma.classSubject.findMany({
        where: { schoolId: session.schoolId, teacherId: profile.userId, isActive: true },
        include: { subject: true, classRoom: true },
        orderBy: { assignedAt: "desc" },
      }),
      prisma.timetableEntry.findMany({
        where: { schoolId: session.schoolId, teacherId: profile.userId },
        include: { subject: true, classRoom: true },
        orderBy: [{ dayOfWeek: "asc" }, { periodNumber: "asc" }],
        take: 30,
      }),
    ]);

    return {
      ...this.mapStaff({
        ...profile,
        user: {
          ...profile.user,
          profileDocuments: profile.user.profileDocuments,
        },
      }),
      school: profile.user.school,
      identity: {
        gender: profile.user.gender,
        dateOfBirth: profile.user.dateOfBirth?.toISOString(),
        nationality: profile.user.nationality,
        stateOfOrigin: profile.user.stateOfOrigin,
        lga: profile.user.lga,
        religion: profile.user.religion,
        maritalStatus: profile.user.maritalStatus,
        bloodGroup: profile.user.bloodGroup,
        genotype: profile.user.genotype,
      },
      contact: {
        secondaryPhone: profile.user.secondaryPhone,
        alternateEmail: profile.user.alternateEmail,
        homeAddress: profile.user.homeAddress,
        residentialAddress: profile.user.residentialAddress,
        city: profile.user.city,
        country: profile.user.country,
      },
      nextOfKin: {
        firstName: profile.user.nextOfKinFirstName,
        lastName: profile.user.nextOfKinLastName,
        phone: profile.user.nextOfKinPhone,
        email: profile.user.nextOfKinEmail,
        relationship: profile.user.nextOfKinRelationship,
        address: profile.user.nextOfKinAddress,
      },
      assignedClasses: profile.user.classesLed.map((classRoom) => ({
        id: classRoom.id,
        name: `${classRoom.name} ${classRoom.arm}`,
      })),
      assignedSubjects: classSubjects.map((assignment) => ({
        id: assignment.id,
        subjectId: assignment.subjectId,
        subjectName: assignment.subject.name,
        classId: assignment.classId,
        className: `${assignment.classRoom.name} ${assignment.classRoom.arm}`,
      })),
      timetable: timetable.map((entry) => ({
        id: entry.id,
        dayOfWeek: entry.dayOfWeek,
        periodNumber: entry.periodNumber,
        startTime: entry.startsAt,
        endTime: entry.endsAt,
        subjectName: entry.subject?.name,
        className: `${entry.classRoom.name} ${entry.classRoom.arm}`,
      })),
      documents: profile.user.profileDocuments.map((document) => ({
        ...document,
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
      })),
      loginHistory: profile.user.loginAttempts.map((attempt) => ({
        id: attempt.id,
        success: attempt.success,
        reason: attempt.reason,
        ipAddress: attempt.ipAddress,
        device: attempt.device,
        createdAt: attempt.createdAt.toISOString(),
      })),
    };
  }

  async createStaff(session: SessionPayload, payload: unknown) {
    const parsed = staffPayloadSchema.parse(payload);
    const role = parsed.primaryRole ?? parsed.role;
    this.assertCanAssignStaffRole(session, role);

    const existing = await prisma.user.findUnique({ where: { email: parsed.email } });
    if (existing) throw new BadRequestException("A user with this email already exists.");

    const employeeNo = (parsed.employeeNo || parsed.staffId || (await this.nextEmployeeNo(session.schoolId))) as string;
    const duplicateEmployeeNo = await prisma.staffProfile.findFirst({ where: { schoolId: session.schoolId, employeeNo } });
    if (duplicateEmployeeNo) throw new BadRequestException("A staff member with this employee number already exists.");

    const employmentDate = dateOrDefault(parsed.employmentDate || parsed.dateOfEmployment);
    const password = parsed.password || "ChangeMe123!";

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          schoolId: session.schoolId,
          firstName: parsed.firstName,
          middleName: asNullable(parsed.middleName) as string | null,
          lastName: parsed.lastName,
          preferredName: asNullable(parsed.preferredName) as string | null,
          email: parsed.email,
          phone: asNullable(parsed.phone) as string | null,
          secondaryPhone: asNullable(parsed.secondaryPhone) as string | null,
          alternateEmail: asNullable(parsed.alternateEmail) as string | null,
          gender: parsed.gender ? parsed.gender : null,
          dateOfBirth: parsed.dateOfBirth ? dateOrDefault(parsed.dateOfBirth) : null,
          nationality: asNullable(parsed.nationality) as string | null,
          stateOfOrigin: asNullable(parsed.stateOfOrigin) as string | null,
          lga: asNullable(parsed.lga) as string | null,
          religion: asNullable(parsed.religion) as string | null,
          maritalStatus: asNullable(parsed.maritalStatus) as string | null,
          bloodGroup: asNullable(parsed.bloodGroup) as string | null,
          genotype: asNullable(parsed.genotype) as string | null,
          homeAddress: (asNullable(parsed.homeAddress) || asNullable(parsed.address)) as string | null,
          residentialAddress: asNullable(parsed.residentialAddress) as string | null,
          city: asNullable(parsed.city) as string | null,
          country: asNullable(parsed.country) as string | null,
          nextOfKinFirstName: asNullable(parsed.nextOfKinFirstName) as string | null,
          nextOfKinLastName: asNullable(parsed.nextOfKinLastName) as string | null,
          nextOfKinPhone: asNullable(parsed.nextOfKinPhone) as string | null,
          nextOfKinEmail: asNullable(parsed.nextOfKinEmail) as string | null,
          nextOfKinRelationship: asNullable(parsed.nextOfKinRelationship) as string | null,
          nextOfKinAddress: asNullable(parsed.nextOfKinAddress) as string | null,
          role,
          isActive: parsed.canLogin,
          accountStatus: parsed.canLogin ? "ACTIVE" : "INACTIVE",
          passwordHash: hashPassword(password),
          passwordResetRequired: true,
        },
      });
      const staff = await tx.staffProfile.create({
        data: {
          schoolId: session.schoolId,
          userId: user.id,
          employeeNo,
          designation: parsed.designation,
          staffType: inferStaffType(role, parsed.staffType),
          departmentId: asNullable(parsed.departmentId) as string | null,
          campusId: asNullable(parsed.campusId) as string | null,
          employmentType: asNullable(parsed.employmentType) as string | null,
          staffCategory: asNullable(parsed.staffCategory) as string | null,
          qualification: asNullable(parsed.qualification) as string | null,
          yearsOfExperience: typeof parsed.yearsOfExperience === "number" ? parsed.yearsOfExperience : null,
          employmentDate,
          emergencyContactName: asNullable(parsed.emergencyContactName) as string | null,
          emergencyContactPhone: asNullable(parsed.emergencyContactPhone) as string | null,
          notes: asNullable(parsed.notes) as string | null,
        },
      });
      return { user, staff };
    });

    await this.audit(session, "CREATE", "StaffProfile", created.staff.id, { userId: created.user.id, employeeNo, role });
    return this.getStaff(session, created.staff.id);
  }

  async updateStaff(session: SessionPayload, staffId: string, payload: unknown) {
    const parsed = staffUpdateSchema.parse(payload);
    const profile = await prisma.staffProfile.findFirst({ where: { id: staffId, schoolId: session.schoolId }, include: { user: true } });
    if (!profile) throw new NotFoundException("Staff member not found.");
    await this.assertCanManageStaffUser(session, profile.user, "update");
    if (parsed.email && parsed.email !== profile.user.email) {
      const duplicate = await prisma.user.findUnique({ where: { email: parsed.email } });
      if (duplicate) throw new BadRequestException("A user with this email already exists.");
    }
    const role = parsed.primaryRole ?? parsed.role;
    if (role) this.assertCanAssignStaffRole(session, role);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: profile.userId },
        data: {
          ...(parsed.firstName ? { firstName: parsed.firstName } : {}),
          ...(parsed.middleName !== undefined ? { middleName: asNullable(parsed.middleName) as string | null } : {}),
          ...(parsed.lastName ? { lastName: parsed.lastName } : {}),
          ...(parsed.preferredName !== undefined ? { preferredName: asNullable(parsed.preferredName) as string | null } : {}),
          ...(parsed.email ? { email: parsed.email } : {}),
          ...(parsed.phone !== undefined ? { phone: asNullable(parsed.phone) as string | null } : {}),
          ...(parsed.secondaryPhone !== undefined ? { secondaryPhone: asNullable(parsed.secondaryPhone) as string | null } : {}),
          ...(parsed.alternateEmail !== undefined ? { alternateEmail: asNullable(parsed.alternateEmail) as string | null } : {}),
          ...(parsed.gender ? { gender: parsed.gender } : {}),
          ...(parsed.dateOfBirth !== undefined ? { dateOfBirth: parsed.dateOfBirth ? dateOrDefault(parsed.dateOfBirth) : null } : {}),
          ...(parsed.homeAddress !== undefined || parsed.address !== undefined ? { homeAddress: (asNullable(parsed.homeAddress) || asNullable(parsed.address)) as string | null } : {}),
          ...(parsed.residentialAddress !== undefined ? { residentialAddress: asNullable(parsed.residentialAddress) as string | null } : {}),
          ...(parsed.city !== undefined ? { city: asNullable(parsed.city) as string | null } : {}),
          ...(parsed.country !== undefined ? { country: asNullable(parsed.country) as string | null } : {}),
          ...(parsed.nextOfKinFirstName !== undefined ? { nextOfKinFirstName: asNullable(parsed.nextOfKinFirstName) as string | null } : {}),
          ...(parsed.nextOfKinLastName !== undefined ? { nextOfKinLastName: asNullable(parsed.nextOfKinLastName) as string | null } : {}),
          ...(parsed.nextOfKinPhone !== undefined ? { nextOfKinPhone: asNullable(parsed.nextOfKinPhone) as string | null } : {}),
          ...(parsed.nextOfKinEmail !== undefined ? { nextOfKinEmail: asNullable(parsed.nextOfKinEmail) as string | null } : {}),
          ...(parsed.nextOfKinRelationship !== undefined ? { nextOfKinRelationship: asNullable(parsed.nextOfKinRelationship) as string | null } : {}),
          ...(parsed.nextOfKinAddress !== undefined ? { nextOfKinAddress: asNullable(parsed.nextOfKinAddress) as string | null } : {}),
          ...(role ? { role } : {}),
        },
      }),
      prisma.staffProfile.update({
        where: { id: profile.id },
        data: {
          ...(parsed.employeeNo || parsed.staffId ? { employeeNo: (parsed.employeeNo || parsed.staffId) as string } : {}),
          ...(parsed.designation ? { designation: parsed.designation } : {}),
          ...(parsed.staffType ? { staffType: parsed.staffType } : {}),
          ...(parsed.departmentId !== undefined ? { departmentId: asNullable(parsed.departmentId) as string | null } : {}),
          ...(parsed.campusId !== undefined ? { campusId: asNullable(parsed.campusId) as string | null } : {}),
          ...(parsed.employmentType !== undefined ? { employmentType: asNullable(parsed.employmentType) as string | null } : {}),
          ...(parsed.staffCategory !== undefined ? { staffCategory: asNullable(parsed.staffCategory) as string | null } : {}),
          ...(parsed.qualification !== undefined ? { qualification: asNullable(parsed.qualification) as string | null } : {}),
          ...(parsed.yearsOfExperience !== undefined ? { yearsOfExperience: typeof parsed.yearsOfExperience === "number" ? parsed.yearsOfExperience : null } : {}),
          ...(parsed.employmentDate || parsed.dateOfEmployment ? { employmentDate: dateOrDefault(parsed.employmentDate || parsed.dateOfEmployment) } : {}),
          ...(parsed.emergencyContactName !== undefined ? { emergencyContactName: asNullable(parsed.emergencyContactName) as string | null } : {}),
          ...(parsed.emergencyContactPhone !== undefined ? { emergencyContactPhone: asNullable(parsed.emergencyContactPhone) as string | null } : {}),
          ...(parsed.notes !== undefined ? { notes: asNullable(parsed.notes) as string | null } : {}),
        },
      }),
    ]);
    if (role) this.rolesManagementService.invalidatePermissionCache(profile.userId, session.schoolId);
    await this.audit(session, "UPDATE", "StaffProfile", profile.id, { fields: Object.keys(parsed), role });
    return this.getStaff(session, profile.id);
  }

  async updateStatus(session: SessionPayload, staffId: string, payload: unknown) {
    const parsed = statusSchema.parse(payload);
    const profile = await prisma.staffProfile.findFirst({ where: { id: staffId, schoolId: session.schoolId }, include: { user: true } });
    if (!profile) throw new NotFoundException("Staff member not found.");
    await this.assertCanManageStaffUser(session, profile.user, parsed.status === "ACTIVE" ? "reactivate" : "change status for");
    await prisma.user.update({
      where: { id: profile.userId },
      data: {
        accountStatus: parsed.status,
        isActive: parsed.status === "ACTIVE",
        suspendedAt: parsed.status === "SUSPENDED" ? new Date() : null,
      },
    });
    this.rolesManagementService.invalidatePermissionCache(profile.userId, session.schoolId);
    await this.audit(session, parsed.status === "ACTIVE" ? "ACTIVATE" : "SUSPEND", "StaffProfile", profile.id, { status: parsed.status, reason: parsed.reason });
    return this.getStaff(session, profile.id);
  }

  async assignRoles(session: SessionPayload, staffId: string, payload: unknown) {
    const parsed = roleAssignSchema.parse(payload);
    const profile = await prisma.staffProfile.findFirst({ where: { id: staffId, schoolId: session.schoolId }, include: { user: true } });
    if (!profile) throw new NotFoundException("Staff member not found.");
    await this.assertCanManageStaffUser(session, profile.user, "assign roles to");
    const roleIds = normalizeRoleIds(parsed.roleIds);
    if (parsed.primaryRole) {
      this.assertCanAssignStaffRole(session, parsed.primaryRole as UserRole);
      await prisma.user.update({ where: { id: profile.userId }, data: { role: parsed.primaryRole as UserRole } });
    }
    if (roleIds.length > 0) {
      await this.rolesManagementService.assignRoles(session, session.schoolId, { userId: profile.userId, roleIds });
    }
    this.rolesManagementService.invalidatePermissionCache(profile.userId, session.schoolId);
    await this.audit(session, "UPDATE", "StaffRoleAssignment", profile.userId, { primaryRole: parsed.primaryRole || null, roleIds });
    return this.getStaff(session, profile.id);
  }

  async archiveStaff(session: SessionPayload, staffId: string) {
    const profile = await prisma.staffProfile.findFirst({ where: { id: staffId, schoolId: session.schoolId }, include: { user: true } });
    if (!profile) throw new NotFoundException("Staff member not found.");
    await this.assertCanManageStaffUser(session, profile.user, "archive");
    await prisma.user.update({
      where: { id: profile.userId },
      data: {
        deletedAt: new Date(),
        isActive: false,
        accountStatus: "INACTIVE",
      },
    });
    this.rolesManagementService.invalidatePermissionCache(profile.userId, session.schoolId);
    await this.audit(session, "DELETE", "StaffProfile", profile.id, { softDelete: true });
    return { id: profile.id };
  }
}
