import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Gender, Prisma } from "@prisma/client";
import { z } from "zod";

import { isPlatformRole } from "../../../../src/lib/auth/role-architecture";
import { hashPassword, verifyPassword } from "../../../../src/lib/auth/password";
import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";

const optionalText = z.string().trim().optional().or(z.literal(""));
const optionalEmail = z.string().trim().email().optional().or(z.literal(""));
const optionalDate = z.string().trim().optional().or(z.literal(""));

const profileFields = {
  firstName: z.string().trim().min(2).optional(),
  middleName: optionalText,
  lastName: z.string().trim().min(2).optional(),
  preferredName: optionalText,
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional().or(z.literal("")),
  dateOfBirth: optionalDate,
  nationality: optionalText,
  stateOfOrigin: optionalText,
  lga: optionalText,
  religion: optionalText,
  maritalStatus: optionalText,
  bloodGroup: optionalText,
  genotype: optionalText,
  avatarUrl: optionalText,
  phone: optionalText,
  secondaryPhone: optionalText,
  alternateEmail: optionalEmail,
  homeAddress: optionalText,
  residentialAddress: optionalText,
  city: optionalText,
  country: optionalText,
  nextOfKinFirstName: optionalText,
  nextOfKinLastName: optionalText,
  nextOfKinOtherName: optionalText,
  nextOfKinPhone: optionalText,
  nextOfKinEmail: optionalEmail,
  nextOfKinRelationship: optionalText,
  nextOfKinAddress: optionalText,
  nextOfKinOccupation: optionalText,
};

const selfUpdateSchema = z.object({
  preferredName: profileFields.preferredName,
  avatarUrl: profileFields.avatarUrl,
  phone: profileFields.phone,
  secondaryPhone: profileFields.secondaryPhone,
  alternateEmail: profileFields.alternateEmail,
  homeAddress: profileFields.homeAddress,
  residentialAddress: profileFields.residentialAddress,
  city: profileFields.city,
  country: profileFields.country,
  nextOfKinFirstName: profileFields.nextOfKinFirstName,
  nextOfKinLastName: profileFields.nextOfKinLastName,
  nextOfKinOtherName: profileFields.nextOfKinOtherName,
  nextOfKinPhone: profileFields.nextOfKinPhone,
  nextOfKinEmail: profileFields.nextOfKinEmail,
  nextOfKinRelationship: profileFields.nextOfKinRelationship,
  nextOfKinAddress: profileFields.nextOfKinAddress,
  nextOfKinOccupation: profileFields.nextOfKinOccupation,
});

const adminUpdateSchema = z.object({
  ...profileFields,
  email: z.string().trim().email().optional(),
  username: optionalText,
  accountStatus: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "LOCKED", "PENDING"]).optional(),
  role: z.string().trim().optional(),
});

const documentSchema = z.object({
  title: z.string().trim().min(2),
  type: z.string().trim().min(2),
  fileName: optionalText,
  fileUrl: optionalText,
  mimeType: optionalText,
  sizeBytes: z.coerce.number().int().positive().optional().or(z.literal("")),
  verificationStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional().or(z.literal("")),
  notes: optionalText,
});

const editRequestSchema = z.object({
  fields: z.union([z.record(z.unknown()), z.string().trim().min(2)]),
  reason: optionalText,
});

const reviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewComment: optionalText,
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

function compactText(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException("Invalid date value.");
  return date;
}

function toUserData(payload: Record<string, unknown>) {
  const data: Prisma.UserUpdateInput = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    if (key === "dateOfBirth") {
      const date = parseDate(value);
      if (date !== undefined) data.dateOfBirth = date;
      continue;
    }
    if (key === "gender") {
      if (value) data.gender = value as Gender;
      continue;
    }
    if (key === "accountStatus") {
      const status = String(value);
      data.accountStatus = status;
      data.isActive = status === "ACTIVE";
      data.suspendedAt = status === "SUSPENDED" ? new Date() : null;
      continue;
    }
    (data as Record<string, unknown>)[key] = compactText(value);
  }
  return data;
}

function fullName(user: { firstName: string; middleName?: string | null; lastName: string; preferredName?: string | null }) {
  return user.preferredName?.trim() || [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ");
}

function parseRequestFields(value: Record<string, unknown> | string) {
  if (typeof value !== "string") return value;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Expected object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new BadRequestException("Requested fields must be valid JSON, for example {\"phone\":\"080...\"}.");
  }
}

@Injectable()
export class ProfileService {
  ok<T>(data: Promise<T> | T, message = "Request completed") {
    return Promise.resolve(data).then((resolved) => ({ ok: true, success: true, message, data: resolved }));
  }

  private assertSchoolScope(session: SessionPayload, schoolId: string) {
    if (!isPlatformRole(session.role) && session.schoolId !== schoolId) {
      throw new ForbiddenException("You cannot access another school's profile data.");
    }
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

  async getProfile(session: SessionPayload, userId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, schoolId: session.schoolId, deletedAt: null },
      include: {
        school: { select: { name: true, schoolCode: true } },
        staffProfile: { include: { department: true, campus: true } },
        student: { include: { currentClass: true, guardians: { include: { guardian: true } } } },
        guardian: { include: { students: { include: { student: { include: { currentClass: true } } } } } },
        roleAssignments: { where: { schoolId: session.schoolId, role: { deletedAt: null } }, include: { role: true } },
        profileDocuments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
        profileEditRequests: { orderBy: { createdAt: "desc" }, take: 20, include: { requestedBy: true, reviewedBy: true } },
        loginAttempts: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!user) throw new NotFoundException("Profile not found.");
    this.assertSchoolScope(session, user.schoolId);

    const classSubjects = user.staffProfile
      ? await prisma.classSubject.findMany({
          where: { schoolId: session.schoolId, teacherId: user.id, isActive: true },
          include: { subject: true, classRoom: true },
          orderBy: { assignedAt: "desc" },
        })
      : [];

    return {
      id: user.id,
      schoolId: user.schoolId,
      fullName: fullName(user),
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      preferredName: user.preferredName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      email: user.email,
      username: user.username,
      phone: user.phone,
      secondaryPhone: user.secondaryPhone,
      alternateEmail: user.alternateEmail,
      accountStatus: user.accountStatus,
      isActive: user.isActive,
      suspendedAt: user.suspendedAt?.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString(),
      createdAt: user.createdAt.toISOString(),
      school: user.school,
      identity: {
        gender: user.gender,
        dateOfBirth: user.dateOfBirth?.toISOString(),
        nationality: user.nationality,
        stateOfOrigin: user.stateOfOrigin,
        lga: user.lga,
        religion: user.religion,
        maritalStatus: user.maritalStatus,
        bloodGroup: user.bloodGroup,
        genotype: user.genotype,
      },
      contact: {
        homeAddress: user.homeAddress,
        residentialAddress: user.residentialAddress,
        city: user.city,
        country: user.country,
      },
      nextOfKin: {
        firstName: user.nextOfKinFirstName,
        lastName: user.nextOfKinLastName,
        otherName: user.nextOfKinOtherName,
        phone: user.nextOfKinPhone,
        email: user.nextOfKinEmail,
        relationship: user.nextOfKinRelationship,
        address: user.nextOfKinAddress,
        occupation: user.nextOfKinOccupation,
      },
      staff: user.staffProfile
        ? {
            id: user.staffProfile.id,
            employeeNo: user.staffProfile.employeeNo,
            designation: user.staffProfile.designation,
            staffType: user.staffProfile.staffType,
            employmentType: user.staffProfile.employmentType,
            staffCategory: user.staffProfile.staffCategory,
            qualification: user.staffProfile.qualification,
            yearsOfExperience: user.staffProfile.yearsOfExperience,
            employmentDate: user.staffProfile.employmentDate.toISOString(),
            emergencyContactName: user.staffProfile.emergencyContactName,
            emergencyContactPhone: user.staffProfile.emergencyContactPhone,
            departmentName: user.staffProfile.department?.name,
            campusName: user.staffProfile.campus?.name,
            notes: user.staffProfile.notes,
            teachingAssignments: classSubjects.map((item) => ({
              id: item.id,
              subjectId: item.subjectId,
              subjectName: item.subject.name,
              classId: item.classId,
              className: `${item.classRoom.name}${item.classRoom.arm ? ` ${item.classRoom.arm}` : ""}`,
            })),
          }
        : null,
      student: user.student
        ? {
            id: user.student.id,
            admissionNumber: user.student.admissionNumber,
            status: user.student.status,
            className: user.student.currentClass ? `${user.student.currentClass.name} ${user.student.currentClass.arm}` : null,
            guardians: user.student.guardians.map((item) => ({
              id: item.guardian.id,
              name: `${item.guardian.firstName} ${item.guardian.lastName}`,
              phone: item.guardian.phone,
              relationship: item.guardian.relationship,
              isPrimary: item.isPrimary,
            })),
          }
        : null,
      parent: user.guardian
        ? {
            id: user.guardian.id,
            relationship: user.guardian.relationship,
            occupation: user.guardian.occupation,
            children: user.guardian.students.map((item) => ({
              id: item.student.id,
              name: `${item.student.firstName} ${item.student.lastName}`,
              admissionNumber: item.student.admissionNumber,
              className: item.student.currentClass ? `${item.student.currentClass.name} ${item.student.currentClass.arm}` : null,
            })),
          }
        : null,
      roles: user.roleAssignments.map((assignment) => ({
        id: assignment.role.id,
        name: assignment.role.name,
        systemRole: assignment.role.systemRole,
      })),
      documents: user.profileDocuments.map((document) => ({
        ...document,
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
      })),
      editRequests: user.profileEditRequests.map((request) => ({
        id: request.id,
        fields: request.fields,
        reason: request.reason,
        status: request.status,
        reviewComment: request.reviewComment,
        createdAt: request.createdAt.toISOString(),
        reviewedAt: request.reviewedAt?.toISOString(),
        requestedBy: fullName(request.requestedBy),
        reviewedBy: request.reviewedBy ? fullName(request.reviewedBy) : null,
      })),
      loginHistory: user.loginAttempts.map((attempt) => ({
        id: attempt.id,
        email: attempt.email,
        success: attempt.success,
        reason: attempt.reason,
        ipAddress: attempt.ipAddress,
        device: attempt.device,
        createdAt: attempt.createdAt.toISOString(),
      })),
    };
  }

  getMyProfile(session: SessionPayload) {
    return this.getProfile(session, session.userId);
  }

  async updateMyProfile(session: SessionPayload, payload: unknown) {
    const parsed = selfUpdateSchema.parse(payload);
    await prisma.user.update({
      where: { id: session.userId },
      data: toUserData(parsed),
    });
    await this.audit(session, "UPDATE", "UserProfile", session.userId, { selfService: true, fields: Object.keys(parsed) });
    return this.getProfile(session, session.userId);
  }

  async updateProfile(session: SessionPayload, userId: string, payload: unknown) {
    const parsed = adminUpdateSchema.parse(payload);
    const user = await prisma.user.findFirst({ where: { id: userId, schoolId: session.schoolId, deletedAt: null } });
    if (!user) throw new NotFoundException("Profile not found.");
    await prisma.user.update({
      where: { id: user.id },
      data: toUserData(parsed),
    });
    await this.audit(session, "UPDATE", "UserProfile", user.id, { fields: Object.keys(parsed) });
    return this.getProfile(session, user.id);
  }

  async changeMyPassword(session: SessionPayload, payload: unknown) {
    const parsed = passwordSchema.parse(payload);
    const user = await prisma.user.findFirst({ where: { id: session.userId, schoolId: session.schoolId, deletedAt: null } });
    if (!user) throw new NotFoundException("Profile not found.");
    if (!verifyPassword(parsed.currentPassword, user.passwordHash)) {
      throw new BadRequestException("Current password is incorrect.");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(parsed.newPassword), passwordResetRequired: false },
    });
    await this.audit(session, "RESET_PASSWORD", "UserProfile", user.id, { selfService: true });
    return { id: user.id };
  }

  async requestEdit(session: SessionPayload, targetUserId: string, payload: unknown) {
    const parsed = editRequestSchema.parse(payload);
    const target = await prisma.user.findFirst({ where: { id: targetUserId, schoolId: session.schoolId, deletedAt: null } });
    if (!target) throw new NotFoundException("Profile not found.");
    if (target.id !== session.userId && session.role === "PARENT") {
      throw new ForbiddenException("Parents can only submit profile corrections through their own account.");
    }
    const fields = parseRequestFields(parsed.fields);
    const request = await prisma.profileEditRequest.create({
      data: {
        schoolId: session.schoolId,
        targetUserId: target.id,
        requestedById: session.userId,
      fields: fields as Prisma.InputJsonValue,
        reason: compactText(parsed.reason) as string | null,
      },
    });
    await this.audit(session, "CREATE", "ProfileEditRequest", request.id, { targetUserId: target.id, fields: fields as Prisma.InputJsonValue });
    return { id: request.id };
  }

  requestMyEdit(session: SessionPayload, payload: unknown) {
    return this.requestEdit(session, session.userId, payload);
  }

  async listEditRequests(session: SessionPayload, query: Record<string, string | undefined>) {
    const status = query.status && query.status !== "all" ? query.status : undefined;
    const requests = await prisma.profileEditRequest.findMany({
      where: { schoolId: session.schoolId, ...(status ? { status } : {}) },
      include: { targetUser: true, requestedBy: true, reviewedBy: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return requests.map((request) => ({
      id: request.id,
      targetUserId: request.targetUserId,
      targetName: fullName(request.targetUser),
      requestedBy: fullName(request.requestedBy),
      reviewedBy: request.reviewedBy ? fullName(request.reviewedBy) : null,
      fields: request.fields,
      reason: request.reason,
      status: request.status,
      reviewComment: request.reviewComment,
      createdAt: request.createdAt.toISOString(),
      reviewedAt: request.reviewedAt?.toISOString(),
    }));
  }

  async listMyEditRequests(session: SessionPayload) {
    const requests = await prisma.profileEditRequest.findMany({
      where: { schoolId: session.schoolId, requestedById: session.userId },
      include: { targetUser: true, reviewedBy: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return requests.map((request) => ({
      id: request.id,
      targetName: fullName(request.targetUser),
      fields: request.fields,
      reason: request.reason,
      status: request.status,
      reviewComment: request.reviewComment,
      reviewedBy: request.reviewedBy ? fullName(request.reviewedBy) : null,
      createdAt: request.createdAt.toISOString(),
      reviewedAt: request.reviewedAt?.toISOString(),
    }));
  }

  async reviewEditRequest(session: SessionPayload, requestId: string, payload: unknown) {
    const parsed = reviewSchema.parse(payload);
    const request = await prisma.profileEditRequest.findFirst({
      where: { id: requestId, schoolId: session.schoolId },
    });
    if (!request) throw new NotFoundException("Edit request not found.");
    if (request.status !== "PENDING") throw new BadRequestException("This edit request has already been reviewed.");

    const fields = request.fields as Record<string, unknown>;
    const safeUpdate = adminUpdateSchema.partial().parse(fields);
    await prisma.$transaction([
      ...(parsed.status === "APPROVED"
        ? [
            prisma.user.update({
              where: { id: request.targetUserId },
              data: toUserData(safeUpdate),
            }),
          ]
        : []),
      prisma.profileEditRequest.update({
        where: { id: request.id },
        data: {
          status: parsed.status,
          reviewedById: session.userId,
          reviewedAt: new Date(),
          reviewComment: compactText(parsed.reviewComment) as string | null,
        },
      }),
    ]);
    await this.audit(session, parsed.status === "APPROVED" ? "APPROVE" : "REJECT", "ProfileEditRequest", request.id, {
      targetUserId: request.targetUserId,
    });
    return { id: request.id, status: parsed.status };
  }

  async addDocument(session: SessionPayload, userId: string, payload: unknown) {
    const parsed = documentSchema.parse(payload);
    const user = await prisma.user.findFirst({ where: { id: userId, schoolId: session.schoolId, deletedAt: null } });
    if (!user) throw new NotFoundException("Profile not found.");
    const document = await prisma.profileDocument.create({
      data: {
        schoolId: session.schoolId,
        userId: user.id,
        title: parsed.title,
        type: parsed.type,
        fileName: compactText(parsed.fileName) as string | null,
        fileUrl: compactText(parsed.fileUrl) as string | null,
        mimeType: compactText(parsed.mimeType) as string | null,
        sizeBytes: typeof parsed.sizeBytes === "number" ? parsed.sizeBytes : null,
        verificationStatus: parsed.verificationStatus || "PENDING",
        notes: compactText(parsed.notes) as string | null,
        uploadedById: session.userId,
      },
    });
    await this.audit(session, "CREATE", "ProfileDocument", document.id, { userId: user.id, type: document.type });
    return document;
  }

  async deleteDocument(session: SessionPayload, userId: string, documentId: string) {
    const document = await prisma.profileDocument.findFirst({
      where: { id: documentId, userId, schoolId: session.schoolId, deletedAt: null },
    });
    if (!document) throw new NotFoundException("Document not found.");
    await prisma.profileDocument.update({ where: { id: document.id }, data: { deletedAt: new Date() } });
    await this.audit(session, "DELETE", "ProfileDocument", document.id, { userId });
    return { id: document.id };
  }

  async loginHistory(session: SessionPayload, userId: string) {
    const user = await prisma.user.findFirst({ where: { id: userId, schoolId: session.schoolId, deletedAt: null } });
    if (!user) throw new NotFoundException("Profile not found.");
    const rows = await prisma.loginAttempt.findMany({
      where: { schoolId: session.schoolId, userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      success: row.success,
      reason: row.reason,
      ipAddress: row.ipAddress,
      device: row.device,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
