import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, NotificationChannel, Prisma, SchemeOfWorkStatus, SchemeOfWorkWeekType, UserRole } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";

const createSchemeSchema = z.object({
  subjectId: z.string().min(1).optional(),
  subject_id: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
  class_id: z.string().min(1).optional(),
  termId: z.string().min(1).optional(),
  term_id: z.string().min(1).optional(),
  academicSessionId: z.string().min(1).optional(),
  academic_session_id: z.string().min(1).optional()
});

const arrayField = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
    } catch {
      return value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return undefined;
}, z.array(z.string()).optional());

const topicPatchSchema = z.object({
  weekNumber: z.coerce.number().int().min(1).max(15).optional(),
  week_number: z.coerce.number().int().min(1).max(15).optional(),
  topic: z.string().trim().min(1).max(500).optional(),
  subtopics: arrayField,
  behaviouralObjectives: z.string().trim().optional().nullable(),
  behavioural_objectives: z.string().trim().optional().nullable(),
  content: z.string().trim().optional().nullable(),
  teachingMethods: arrayField,
  teaching_methods: arrayField,
  teachingAids: arrayField,
  teaching_aids: arrayField,
  referenceMaterials: arrayField,
  reference_materials: arrayField,
  evaluation: z.string().trim().optional().nullable(),
  assignment: z.string().trim().optional().nullable(),
  weekType: z.nativeEnum(SchemeOfWorkWeekType).optional(),
  week_type: z.nativeEnum(SchemeOfWorkWeekType).optional(),
  sortOrder: z.coerce.number().int().optional(),
  sort_order: z.coerce.number().int().optional()
});

const coverSchema = z.object({
  coveredDate: z.string().optional(),
  covered_date: z.string().optional(),
  actualTopicTaught: z.string().trim().max(500).optional().nullable(),
  actual_topic_taught: z.string().trim().max(500).optional().nullable(),
  coverageNotes: z.string().trim().optional().nullable(),
  coverage_notes: z.string().trim().optional().nullable()
});

const approveSchema = z.object({
  action: z.enum(["approve", "return"]),
  returnReason: z.string().trim().optional().nullable(),
  return_reason: z.string().trim().optional().nullable()
});

const defaultWeeks = Array.from({ length: 13 }, (_, index) => index + 1);
const teacherRoles = new Set<UserRole>([UserRole.TEACHER, UserRole.SUBJECT_TEACHER, UserRole.CLASS_TEACHER]);
const approvalRoles = new Set<UserRole>([
  UserRole.HEAD_OF_DEPARTMENT,
  UserRole.VICE_PRINCIPAL_ACADEMICS,
  UserRole.PRINCIPAL,
  UserRole.HEAD_TEACHER,
  UserRole.ADMINISTRATOR,
  UserRole.SCHOOL_OWNER,
  UserRole.PROPRIETOR
]);

type SchemeListQuery = {
  subjectId?: string;
  classId?: string;
  termId?: string;
  status?: string;
  departmentId?: string;
};

@Injectable()
export class SchemeOfWorkService {
  async ok<T>(dataPromise: Promise<T>, message?: string) {
    return { ok: true, success: true, ...(message ? { message } : {}), data: await dataPromise };
  }

  private async audit(session: SessionPayload, action: AuditAction, entityType: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    await prisma.auditLog.create({
      data: {
        schoolId: session.schoolId,
        actorId: session.userId,
        action,
        entityType,
        entityId,
        metadata
      }
    });
  }

  private async currentContext(schoolId: string, termId?: string, academicSessionId?: string) {
    const term = termId
      ? await prisma.term.findFirst({ where: { id: termId, schoolId } })
      : await prisma.term.findFirst({ where: { schoolId, isCurrent: true }, orderBy: { startDate: "desc" } });
    if (!term) {
      throw new BadRequestException("No active term is configured for this school.");
    }

    const academicSession = academicSessionId
      ? await prisma.academicSession.findFirst({ where: { id: academicSessionId, schoolId } })
      : await prisma.academicSession.findFirst({ where: { id: term.academicSessionId, schoolId } });
    if (!academicSession) {
      throw new BadRequestException("No academic session is configured for the selected term.");
    }

    return { term, academicSession };
  }

  private async getStaffDepartmentId(session: SessionPayload) {
    const profile = await prisma.staffProfile.findFirst({
      where: { schoolId: session.schoolId, userId: session.userId },
      select: { departmentId: true }
    });
    return profile?.departmentId ?? null;
  }

  private getCurrentSchoolWeek(termStartDate?: Date | null) {
    if (!termStartDate) return 1;
    const now = new Date();
    const elapsedDays = Math.floor((now.getTime() - termStartDate.getTime()) / (1000 * 60 * 60 * 24));
    if (elapsedDays < 0) return 1;
    return Math.max(1, Math.min(15, Math.floor(elapsedDays / 7) + 1));
  }

  private className(classRoom?: { name: string; arm?: string | null; classLevel?: { name: string } | null }) {
    if (!classRoom) return "Unknown class";
    if (classRoom.classLevel?.name && classRoom.arm) return `${classRoom.classLevel.name} ${classRoom.arm}`;
    if (classRoom.arm && !classRoom.name.includes(classRoom.arm)) return `${classRoom.name} ${classRoom.arm}`;
    return classRoom.name;
  }

  private displayName(user?: { firstName: string; lastName: string } | null) {
    return user ? `${user.firstName} ${user.lastName}`.trim() : undefined;
  }

  private parseArray(value: Prisma.JsonValue | null | undefined) {
    if (!Array.isArray(value)) return undefined;
    return value.map((item) => String(item));
  }

  private computeStats(topics: Array<{ weekType: SchemeOfWorkWeekType; isCovered: boolean; weekNumber: number }>, termStartDate?: Date | null) {
    const totalWeeks = topics.length;
    const teachingTopics = topics.filter((topic) => topic.weekType === SchemeOfWorkWeekType.TEACHING);
    const teachingWeeks = teachingTopics.length;
    const coveredWeeks = teachingTopics.filter((topic) => topic.isCovered).length;
    const coveragePercent = teachingWeeks === 0 ? 0 : Math.round((coveredWeeks / teachingWeeks) * 100);
    const currentWeek = teachingTopics.find((topic) => !topic.isCovered)?.weekNumber;
    const isOnTrack = currentWeek ? currentWeek <= this.getCurrentSchoolWeek(termStartDate) : true;
    return {
      totalWeeks,
      teachingWeeks,
      coveredWeeks,
      coveragePercent,
      currentWeek,
      isOnTrack
    };
  }

  private async assertCanViewSow(
    session: SessionPayload,
    sow: Prisma.SchemeOfWorkGetPayload<{
      include: {
        subject: true;
        classRoom: true;
      };
    }>
  ) {
    if (approvalRoles.has(session.role as UserRole)) {
      if (session.role === UserRole.HEAD_OF_DEPARTMENT) {
        const departmentId = await this.getStaffDepartmentId(session);
        if (departmentId && sow.subject.departmentId && sow.subject.departmentId !== departmentId) {
          throw new ForbiddenException("You can only view schemes of work for your department.");
        }
      }
      return;
    }

    if (teacherRoles.has(session.role as UserRole)) {
      const isAssignedTeacher = sow.teacherId === session.userId;
      const isClassTeacher = session.role === UserRole.CLASS_TEACHER && sow.classRoom.classTeacherId === session.userId;
      if (!isAssignedTeacher && !isClassTeacher) {
        throw new ForbiddenException("You can only view schemes of work assigned to you or your class.");
      }
      return;
    }

    throw new ForbiddenException("Access denied.");
  }

  private async notifyUser(schoolId: string, userId: string | null | undefined, title: string, body: string, metadata?: Prisma.InputJsonValue) {
    if (!userId) return;
    await prisma.notificationLog.create({
      data: {
        schoolId,
        userId,
        channel: NotificationChannel.IN_APP,
        title,
        body,
        status: "QUEUED",
        metadata,
        sentAt: new Date()
      }
    });
  }

  async list(session: SessionPayload, query: Record<string, string | undefined>) {
    const normalized: SchemeListQuery = {
      subjectId: query.subjectId ?? query.subject_id,
      classId: query.classId ?? query.class_id,
      termId: query.termId ?? query.term_id,
      status: query.status,
      departmentId: query.departmentId ?? query.department_id
    };
    const { term } = await this.currentContext(session.schoolId, normalized.termId);
    const departmentScope = session.role === UserRole.HEAD_OF_DEPARTMENT ? await this.getStaffDepartmentId(session) : null;

    const rows = await prisma.schemeOfWork.findMany({
      where: {
        schoolId: session.schoolId,
        termId: term.id,
        ...(normalized.subjectId ? { subjectId: normalized.subjectId } : {}),
        ...(normalized.classId ? { classId: normalized.classId } : {}),
        ...(normalized.status ? { status: normalized.status as SchemeOfWorkStatus } : {}),
        subject: {
          ...(normalized.departmentId ? { departmentId: normalized.departmentId } : {}),
          ...(departmentScope ? { departmentId: departmentScope } : {})
        }
      },
      include: {
        subject: {
          include: {
            department: true
          }
        },
        classRoom: {
          include: {
            classLevel: true
          }
        },
        teacher: {
          select: { id: true, firstName: true, lastName: true }
        },
        topics: {
          select: { weekType: true, isCovered: true, weekNumber: true }
        }
      },
      orderBy: [{ classRoom: { displayOrder: "asc" } }, { subject: { name: "asc" } }]
    });

    return rows.map((row) => {
      const stats = this.computeStats(row.topics, term.startDate);
      return {
        id: row.id,
        status: row.status,
        submittedAt: row.submittedAt?.toISOString(),
        approvedAt: row.approvedAt?.toISOString(),
        subjectId: row.subjectId,
        subjectName: row.subject.name,
        subjectCode: row.subject.code,
        classId: row.classId,
        className: this.className(row.classRoom),
        level: row.classRoom.classLevel?.name ?? row.classRoom.name,
        section: row.classRoom.section ?? undefined,
        category: row.classRoom.category ?? undefined,
        arm: row.classRoom.arm,
        departmentId: row.subject.departmentId ?? undefined,
        departmentName: row.subject.department?.name ?? undefined,
        teacherId: row.teacherId ?? undefined,
        teacherName: this.displayName(row.teacher),
        totalWeeks: stats.totalWeeks,
        coveredWeeks: stats.coveredWeeks,
        teachingWeeks: stats.teachingWeeks,
        coveragePercent: stats.coveragePercent
      };
    });
  }

  async listMy(session: SessionPayload) {
    const { term } = await this.currentContext(session.schoolId);

    const where: Prisma.SchemeOfWorkWhereInput = {
      schoolId: session.schoolId,
      termId: term.id
    };

    if (session.role === UserRole.CLASS_TEACHER) {
      where.OR = [{ teacherId: session.userId }, { classRoom: { classTeacherId: session.userId } }];
    } else {
      where.teacherId = session.userId;
    }

    const rows = await prisma.schemeOfWork.findMany({
      where,
      include: {
        subject: true,
        classRoom: { include: { classLevel: true } },
        topics: { select: { weekType: true, isCovered: true, weekNumber: true } }
      },
      orderBy: [{ classRoom: { displayOrder: "asc" } }, { subject: { name: "asc" } }]
    });

    return rows.map((row) => {
      const stats = this.computeStats(row.topics, term.startDate);
      const nextWeek = row.topics
        .filter((topic) => topic.weekType === SchemeOfWorkWeekType.TEACHING && !topic.isCovered)
        .sort((left, right) => left.weekNumber - right.weekNumber)[0]?.weekNumber;
      const lastCoveredWeek = row.topics
        .filter((topic) => topic.isCovered)
        .sort((left, right) => right.weekNumber - left.weekNumber)[0]?.weekNumber;
      return {
        id: row.id,
        status: row.status,
        subjectId: row.subjectId,
        subjectName: row.subject.name,
        subjectCode: row.subject.code,
        classId: row.classId,
        className: this.className(row.classRoom),
        level: row.classRoom.classLevel?.name ?? row.classRoom.name,
        section: row.classRoom.section ?? undefined,
        totalWeeks: stats.totalWeeks,
        coveredWeeks: stats.coveredWeeks,
        teachingWeeks: stats.teachingWeeks,
        coveragePercent: stats.coveragePercent,
        lastCoveredWeek,
        nextWeek
      };
    });
  }

  async get(session: SessionPayload, sowId: string) {
    const sow = await prisma.schemeOfWork.findFirst({
      where: { id: sowId, schoolId: session.schoolId },
      include: {
        subject: { include: { department: true } },
        classRoom: { include: { classLevel: true } },
        term: true,
        academicSession: true,
        teacher: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        approvedBy: { select: { firstName: true, lastName: true } },
        topics: {
          include: {
            coveredBy: { select: { firstName: true, lastName: true } },
            resources: true
          },
          orderBy: [{ weekNumber: "asc" }]
        }
      }
    });

    if (!sow) throw new NotFoundException("Scheme of work not found.");
    await this.assertCanViewSow(session, sow);

    const stats = this.computeStats(sow.topics, sow.term.startDate);

    return {
      id: sow.id,
      schoolId: sow.schoolId,
      subjectId: sow.subjectId,
      classId: sow.classId,
      academicSessionId: sow.academicSessionId,
      termId: sow.termId,
      teacherId: sow.teacherId ?? undefined,
      status: sow.status,
      returnReason: sow.returnReason ?? undefined,
      submittedAt: sow.submittedAt?.toISOString(),
      approvedAt: sow.approvedAt?.toISOString(),
      subjectName: sow.subject.name,
      subjectCode: sow.subject.code,
      periodsPerWeek: sow.subject.periodsPerWeek,
      requiresLab: sow.subject.requiresLab,
      className: this.className(sow.classRoom),
      level: sow.classRoom.classLevel?.name ?? sow.classRoom.name,
      section: sow.classRoom.section ?? undefined,
      category: sow.classRoom.category ?? undefined,
      arm: sow.classRoom.arm,
      termName: sow.term.name,
      termNumber: sow.term.order,
      academicSessionName: sow.academicSession.name,
      teacherName: this.displayName(sow.teacher),
      teacherEmail: sow.teacher?.email ?? undefined,
      teacherAvatar: sow.teacher?.avatarUrl ?? undefined,
      approvedByName: this.displayName(sow.approvedBy),
      topics: sow.topics.map((topic) => ({
        id: topic.id,
        weekNumber: topic.weekNumber,
        topic: topic.topic,
        subtopics: this.parseArray(topic.subtopics),
        behaviouralObjectives: topic.behaviouralObjectives ?? undefined,
        content: topic.content ?? undefined,
        teachingMethods: this.parseArray(topic.teachingMethods),
        teachingAids: this.parseArray(topic.teachingAids),
        referenceMaterials: this.parseArray(topic.referenceMaterials),
        evaluation: topic.evaluation ?? undefined,
        assignment: topic.assignment ?? undefined,
        isCovered: topic.isCovered,
        coveredDate: topic.coveredDate?.toISOString(),
        coveredByName: this.displayName(topic.coveredBy),
        actualTopicTaught: topic.actualTopicTaught ?? undefined,
        coverageNotes: topic.coverageNotes ?? undefined,
        weekType: topic.weekType,
        sortOrder: topic.sortOrder,
        resources: topic.resources.map((resource) => ({
          id: resource.id,
          resourceType: resource.resourceType,
          title: resource.title,
          url: resource.url ?? undefined,
          filePath: resource.filePath ?? undefined,
          createdAt: resource.createdAt.toISOString()
        }))
      })),
      stats
    };
  }

  async create(session: SessionPayload, payload: unknown) {
    const parsed = createSchemeSchema.parse(payload);
    const subjectId = parsed.subjectId ?? parsed.subject_id;
    const classId = parsed.classId ?? parsed.class_id;
    if (!subjectId || !classId) {
      throw new BadRequestException("subjectId and classId are required.");
    }

    const { term, academicSession } = await this.currentContext(
      session.schoolId,
      parsed.termId ?? parsed.term_id,
      parsed.academicSessionId ?? parsed.academic_session_id
    );

    const [subject, classRoom, assignment] = await Promise.all([
      prisma.subject.findFirst({ where: { id: subjectId, schoolId: session.schoolId, deletedAt: null } }),
      prisma.classRoom.findFirst({ where: { id: classId, schoolId: session.schoolId, deletedAt: null } }),
      prisma.classSubject.findFirst({
        where: { schoolId: session.schoolId, classId, subjectId, isActive: true },
        orderBy: { assignedAt: "desc" }
      })
    ]);

    if (!subject) throw new NotFoundException("Subject not found.");
    if (!classRoom) throw new NotFoundException("Class not found.");

    const existing = await prisma.schemeOfWork.findFirst({
      where: { schoolId: session.schoolId, subjectId, classId, termId: term.id }
    });
    if (existing) {
      return this.get(session, existing.id);
    }

    const created = await prisma.schemeOfWork.create({
      data: {
        schoolId: session.schoolId,
        subjectId,
        classId,
        academicSessionId: academicSession.id,
        termId: term.id,
        teacherId: assignment?.teacherId ?? null,
        topics: {
          create: defaultWeeks.map((weekNumber) => ({
            schoolId: session.schoolId,
            weekNumber,
            topic: `Week ${weekNumber} topic to be planned`,
            weekType: weekNumber === 8 || weekNumber === 13 ? SchemeOfWorkWeekType.REVISION : SchemeOfWorkWeekType.TEACHING,
            sortOrder: weekNumber
          }))
        }
      }
    });

    await this.audit(session, "CREATE", "SchemeOfWork", created.id, { subjectId, classId, termId: term.id });
    return this.get(session, created.id);
  }

  async updateTopic(session: SessionPayload, sowId: string, topicId: string, payload: unknown) {
    const parsed = topicPatchSchema.parse(payload);
    const sow = await prisma.schemeOfWork.findFirst({
      where: { id: sowId, schoolId: session.schoolId },
      include: { classRoom: true, subject: true }
    });
    if (!sow) throw new NotFoundException("Scheme of work not found.");
    await this.assertCanViewSow(session, sow);

    const topic = await prisma.sowTopic.findFirst({
      where: { id: topicId, schoolId: session.schoolId, schemeOfWorkId: sowId }
    });
    if (!topic) throw new NotFoundException("Scheme topic not found.");

    const canEdit = approvalRoles.has(session.role as UserRole) || sow.teacherId === session.userId;
    if (!canEdit) {
      throw new ForbiddenException("You cannot edit this topic.");
    }

    await prisma.sowTopic.update({
      where: { id: topic.id },
      data: {
        ...(parsed.weekNumber ?? parsed.week_number ? { weekNumber: parsed.weekNumber ?? parsed.week_number } : {}),
        ...(parsed.topic ? { topic: parsed.topic } : {}),
        ...(parsed.subtopics !== undefined ? { subtopics: parsed.subtopics } : {}),
        ...(parsed.behaviouralObjectives !== undefined || parsed.behavioural_objectives !== undefined
          ? { behaviouralObjectives: parsed.behaviouralObjectives ?? parsed.behavioural_objectives ?? null }
          : {}),
        ...(parsed.content !== undefined ? { content: parsed.content || null } : {}),
        ...(parsed.teachingMethods !== undefined || parsed.teaching_methods !== undefined
          ? { teachingMethods: parsed.teachingMethods ?? parsed.teaching_methods ?? [] }
          : {}),
        ...(parsed.teachingAids !== undefined || parsed.teaching_aids !== undefined
          ? { teachingAids: parsed.teachingAids ?? parsed.teaching_aids ?? [] }
          : {}),
        ...(parsed.referenceMaterials !== undefined || parsed.reference_materials !== undefined
          ? { referenceMaterials: parsed.referenceMaterials ?? parsed.reference_materials ?? [] }
          : {}),
        ...(parsed.evaluation !== undefined ? { evaluation: parsed.evaluation || null } : {}),
        ...(parsed.assignment !== undefined ? { assignment: parsed.assignment || null } : {}),
        ...(parsed.weekType ?? parsed.week_type ? { weekType: parsed.weekType ?? parsed.week_type } : {}),
        ...(parsed.sortOrder ?? parsed.sort_order ? { sortOrder: parsed.sortOrder ?? parsed.sort_order } : {})
      }
    });

    await this.audit(session, "UPDATE", "SowTopic", topic.id, { sowId });
    return this.get(session, sowId);
  }

  async markCovered(session: SessionPayload, sowId: string, topicId: string, payload: unknown) {
    const parsed = coverSchema.parse(payload);
    const sow = await prisma.schemeOfWork.findFirst({
      where: { id: sowId, schoolId: session.schoolId },
      include: { classRoom: true, subject: true }
    });
    if (!sow) throw new NotFoundException("Scheme of work not found.");
    await this.assertCanViewSow(session, sow);

    const canMark = sow.teacherId === session.userId || approvalRoles.has(session.role as UserRole);
    if (!canMark) {
      throw new ForbiddenException("Only the assigned teacher or academic managers can mark topics as covered.");
    }

    const topic = await prisma.sowTopic.findFirst({
      where: { id: topicId, schoolId: session.schoolId, schemeOfWorkId: sowId }
    });
    if (!topic) throw new NotFoundException("Scheme topic not found.");

    const coveredDate = parsed.coveredDate ?? parsed.covered_date;
    await prisma.sowTopic.update({
      where: { id: topic.id },
      data: {
        isCovered: true,
        coveredDate: coveredDate ? new Date(coveredDate) : new Date(),
        coveredById: session.userId,
        actualTopicTaught: parsed.actualTopicTaught ?? parsed.actual_topic_taught ?? null,
        coverageNotes: parsed.coverageNotes ?? parsed.coverage_notes ?? null
      }
    });

    await this.audit(session, "UPDATE", "SowTopic", topic.id, { action: "mark_covered", sowId });
    return { message: "Topic marked as covered." };
  }

  async submit(session: SessionPayload, sowId: string) {
    const sow = await prisma.schemeOfWork.findFirst({
      where: { id: sowId, schoolId: session.schoolId },
      include: { topics: true, subject: true, classRoom: true }
    });
    if (!sow) throw new NotFoundException("Scheme of work not found.");
    if (sow.teacherId !== session.userId) {
      throw new ForbiddenException("Only the assigned teacher can submit this scheme of work.");
    }
    if (sow.status !== SchemeOfWorkStatus.DRAFT && sow.status !== SchemeOfWorkStatus.RETURNED) {
      throw new BadRequestException(`This scheme of work cannot be submitted from ${sow.status.toLowerCase()} status.`);
    }
    if (sow.topics.length < 10) {
      throw new BadRequestException(`At least 10 weeks must be defined before submission. Currently ${sow.topics.length}.`);
    }

    await prisma.schemeOfWork.update({
      where: { id: sow.id },
      data: {
        status: SchemeOfWorkStatus.SUBMITTED,
        submittedAt: new Date(),
        submittedById: session.userId
      }
    });

    if (sow.subject.departmentId) {
      const hods = await prisma.staffProfile.findMany({
        where: { schoolId: session.schoolId, departmentId: sow.subject.departmentId, user: { role: UserRole.HEAD_OF_DEPARTMENT } },
        select: { userId: true }
      });
      await Promise.all(
        hods.map((hod) =>
          this.notifyUser(
            session.schoolId,
            hod.userId,
            "Scheme of Work submitted",
            `${sow.subject.name} for ${this.className(sow.classRoom)} has been submitted for review.`,
            { sowId: sow.id }
          )
        )
      );
    }

    await this.audit(session, "UPDATE", "SchemeOfWork", sow.id, { action: "submit" });
    return { message: "Scheme of work submitted for review." };
  }

  async approve(session: SessionPayload, sowId: string, payload: unknown) {
    const parsed = approveSchema.parse(payload);
    const action = parsed.action;
    const returnReason = parsed.returnReason ?? parsed.return_reason;

    const sow = await prisma.schemeOfWork.findFirst({
      where: { id: sowId, schoolId: session.schoolId },
      include: { subject: true, classRoom: true }
    });
    if (!sow) throw new NotFoundException("Scheme of work not found.");
    if (sow.status !== SchemeOfWorkStatus.SUBMITTED) {
      throw new BadRequestException("Only submitted schemes of work can be approved or returned.");
    }
    await this.assertCanViewSow(session, sow);
    if (!approvalRoles.has(session.role as UserRole)) {
      throw new ForbiddenException("You are not allowed to approve this scheme of work.");
    }

    if (action === "return" && !returnReason) {
      throw new BadRequestException("A return reason is required.");
    }

    await prisma.schemeOfWork.update({
      where: { id: sow.id },
      data:
        action === "approve"
          ? {
              status: SchemeOfWorkStatus.APPROVED,
              approvedAt: new Date(),
              approvedById: session.userId,
              returnReason: null
            }
          : {
              status: SchemeOfWorkStatus.RETURNED,
              returnReason: returnReason ?? null
            }
    });

    await this.notifyUser(
      session.schoolId,
      sow.teacherId,
      action === "approve" ? "Scheme of Work approved" : "Scheme of Work returned",
      action === "approve"
        ? `${sow.subject.name} for ${this.className(sow.classRoom)} has been approved.`
        : `${sow.subject.name} for ${this.className(sow.classRoom)} was returned for revision.${returnReason ? ` ${returnReason}` : ""}`,
      { sowId: sow.id, action }
    );

    await this.audit(session, "UPDATE", "SchemeOfWork", sow.id, { action, returnReason });
    return {
      message: action === "approve" ? "Scheme of work approved." : "Scheme of work returned for revision."
    };
  }
}
