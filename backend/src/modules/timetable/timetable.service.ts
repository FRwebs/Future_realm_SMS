import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";

const dayNames = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const categoryOrder = ["Early Years", "Primary", "Junior Secondary", "Senior Secondary"] as const;
const nonTeachingSlots = ["break", "lunch", "assembly", "closing"];

const slotSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(1).max(5).optional(),
  day_of_week: z.coerce.number().int().min(1).max(5).optional(),
  periodNumber: z.coerce.number().int().optional(),
  period_number: z.coerce.number().int().optional(),
  subjectId: z.string().optional().nullable(),
  subject_id: z.string().optional().nullable(),
  teacherId: z.string().optional().nullable(),
  teacher_id: z.string().optional().nullable(),
  room: z.string().optional().nullable(),
  venue: z.string().optional().nullable(),
  slotType: z.enum(["lesson", "free", "sports", "break", "lunch", "assembly", "closing"]).optional(),
  slot_type: z.enum(["lesson", "free", "sports", "break", "lunch", "assembly", "closing"]).optional(),
  notes: z.string().optional().nullable(),
  isDoublePeriod: z.coerce.boolean().optional(),
  is_double_period: z.coerce.boolean().optional()
});

const publishSchema = z.object({
  action: z.enum(["publish", "unpublish"]),
  termId: z.string().optional(),
  term_id: z.string().optional()
});

type PeriodSeed = {
  periodNumber: number;
  label: string;
  startsAt: string;
  endsAt: string;
  slotType: string;
  category: string;
  displayOrder: number;
};

type ClassWithRelations = Prisma.ClassRoomGetPayload<{
  include: {
    classLevel: true;
    classTeacher: { select: { id: true; firstName: true; lastName: true } };
  };
}>;

type TimetableClassListPayload = {
  data: Record<string, Array<{
    id: string;
    name: string;
    shortName: string;
    short_name: string;
    level: string;
    section: string | null;
    category: string;
    arm: string | null;
    displayOrder: number | null;
    display_order: number | null;
    classTeacherName: string | null;
    class_teacher_name: string | null;
    classTeacherId: string | null;
    class_teacher_id: string | null;
    totalSlots: number;
    total_slots: number;
    lessonSlots: number;
    lesson_slots: number;
    publishedSlots: number;
    published_slots: number;
    filledSlots: number;
    filled_slots: number;
    setupStatus: string;
    setup_status: string;
  }>>;
  meta: {
    academicSessionId: string | null;
    academic_year_id: string | null;
    termId: string;
    term_id: string;
    totalClasses: number;
    total_classes: number;
    publishedClasses: number;
    published_classes: number;
    emptyClasses: number;
    empty_classes: number;
  };
};

const periodSeeds: Record<string, PeriodSeed[]> = {
  secondary: [
    [0, "Assembly", "07:30", "07:45", "assembly"],
    [1, "Period 1", "07:45", "08:25", "lesson"],
    [2, "Period 2", "08:25", "09:05", "lesson"],
    [3, "Period 3", "09:05", "09:45", "lesson"],
    [99, "Short Break", "09:45", "10:05", "break"],
    [4, "Period 4", "10:05", "10:45", "lesson"],
    [5, "Period 5", "10:45", "11:25", "lesson"],
    [6, "Period 6", "11:25", "12:05", "lesson"],
    [98, "Lunch Break", "12:05", "12:45", "lunch"],
    [7, "Period 7", "12:45", "13:25", "lesson"],
    [8, "Period 8", "13:25", "14:05", "lesson"],
    [9, "Period 9", "14:05", "14:45", "lesson"],
    [10, "Period 10", "14:45", "15:25", "lesson"],
    [96, "Short Break 2", "15:25", "15:40", "break"],
    [11, "Period 11", "15:40", "16:20", "lesson"],
    [12, "Period 12", "16:20", "17:00", "lesson"],
    [95, "Evening Break", "17:00", "17:15", "break"],
    [13, "Period 13", "17:15", "17:55", "lesson"],
    [14, "Period 14", "17:55", "18:35", "lesson"],
    [94, "Dinner Break", "18:35", "19:15", "break"],
    [15, "Period 15", "19:15", "19:55", "lesson"],
    [16, "Period 16", "19:55", "20:35", "lesson"],
    [97, "Closing", "20:35", "21:00", "closing"]
  ].map(([periodNumber, label, startsAt, endsAt, slotType], index) => ({
    periodNumber: Number(periodNumber),
    label: String(label),
    startsAt: String(startsAt),
    endsAt: String(endsAt),
    slotType: String(slotType),
    category: "secondary",
    displayOrder: index + 1
  })),
  primary: [
    [0, "Assembly", "07:30", "07:50", "assembly"],
    [1, "Period 1", "07:50", "08:30", "lesson"],
    [2, "Period 2", "08:30", "09:10", "lesson"],
    [3, "Period 3", "09:10", "09:50", "lesson"],
    [99, "Short Break", "09:50", "10:10", "break"],
    [4, "Period 4", "10:10", "10:50", "lesson"],
    [5, "Period 5", "10:50", "11:30", "lesson"],
    [6, "Period 6", "11:30", "12:10", "lesson"],
    [98, "Lunch Break", "12:10", "12:40", "lunch"],
    [7, "Period 7", "12:40", "13:20", "lesson"],
    [8, "Period 8", "13:20", "14:00", "lesson"],
    [9, "Period 9", "14:00", "14:40", "lesson"],
    [96, "Short Break 2", "14:40", "14:55", "break"],
    [10, "Period 10", "14:55", "15:35", "lesson"],
    [11, "Period 11", "15:35", "16:15", "lesson"],
    [95, "Evening Break", "16:15", "16:30", "break"],
    [12, "Period 12", "16:30", "17:10", "lesson"],
    [13, "Period 13", "17:10", "17:50", "lesson"],
    [94, "Dinner Break", "17:50", "18:30", "break"],
    [14, "Period 14", "18:30", "19:10", "lesson"],
    [15, "Period 15", "19:10", "19:50", "lesson"],
    [97, "Closing", "19:50", "21:00", "closing"]
  ].map(([periodNumber, label, startsAt, endsAt, slotType], index) => ({
    periodNumber: Number(periodNumber),
    label: String(label),
    startsAt: String(startsAt),
    endsAt: String(endsAt),
    slotType: String(slotType),
    category: "primary",
    displayOrder: index + 1
  })),
  early_years: [
    [0, "Morning Circle", "07:30", "08:00", "assembly"],
    [1, "Period 1", "08:00", "08:40", "lesson"],
    [2, "Period 2", "08:40", "09:20", "lesson"],
    [3, "Period 3", "09:20", "10:00", "lesson"],
    [99, "Snack Break", "10:00", "10:20", "break"],
    [4, "Period 4", "10:20", "11:00", "lesson"],
    [5, "Period 5", "11:00", "11:40", "lesson"],
    [98, "Lunch Break", "11:40", "12:20", "lunch"],
    [6, "Period 6", "12:20", "13:00", "lesson"],
    [7, "Period 7", "13:00", "13:40", "lesson"],
    [8, "Period 8", "13:40", "14:20", "lesson"],
    [96, "Short Break 2", "14:20", "14:40", "break"],
    [9, "Period 9", "14:40", "15:20", "lesson"],
    [10, "Period 10", "15:20", "16:00", "lesson"],
    [95, "Evening Break", "16:00", "16:15", "break"],
    [11, "Period 11", "16:15", "16:55", "lesson"],
    [12, "Period 12", "16:55", "17:35", "lesson"],
    [94, "Dinner Break", "17:35", "18:15", "break"],
    [13, "Period 13", "18:15", "18:55", "lesson"],
    [14, "Period 14", "18:55", "19:35", "lesson"],
    [97, "Closing", "19:35", "21:00", "closing"]
  ].map(([periodNumber, label, startsAt, endsAt, slotType], index) => ({
    periodNumber: Number(periodNumber),
    label: String(label),
    startsAt: String(startsAt),
    endsAt: String(endsAt),
    slotType: String(slotType),
    category: "early_years",
    displayOrder: index + 1
  }))
};

function classCategory(classRoom: { category?: string | null; classLevel?: { schoolSection?: string | null } }) {
  if (classRoom.category === "Early Years" || classRoom.category === "Primary" || classRoom.category === "Junior Secondary" || classRoom.category === "Senior Secondary") return classRoom.category;
  if (classRoom.category === "CRECHE" || classRoom.category === "NURSERY") return "Early Years";
  if (classRoom.category === "PRIMARY") return "Primary";
  if (classRoom.category === "JUNIOR_SECONDARY") return "Junior Secondary";
  if (classRoom.category === "SENIOR_SECONDARY") return "Senior Secondary";
  if (classRoom.classLevel?.schoolSection === "CRECHE" || classRoom.classLevel?.schoolSection === "NURSERY") return "Early Years";
  if (classRoom.classLevel?.schoolSection === "PRIMARY") return "Primary";
  if (classRoom.classLevel?.schoolSection === "JUNIOR_SECONDARY") return "Junior Secondary";
  if (classRoom.classLevel?.schoolSection === "SENIOR_SECONDARY") return "Senior Secondary";
  return "Primary";
}

function periodCategory(category: string) {
  if (category === "Early Years") return "early_years";
  if (category === "Primary") return "primary";
  return "secondary";
}

function classDisplayName(classRoom: { name: string; arm?: string | null }) {
  if (!classRoom.arm) return classRoom.name;
  return classRoom.name.includes(classRoom.arm) ? classRoom.name : `${classRoom.name} ${classRoom.arm}`;
}

function displayName(user?: { firstName: string; lastName: string } | null) {
  return user ? `${user.firstName} ${user.lastName}` : null;
}

function isPortalViewOnly(role: string) {
  return [UserRole.STUDENT, UserRole.PARENT].map(String).includes(role);
}

@Injectable()
export class TimetableService {
  private static readonly periodDefinitionCache = new Map<string, number>();
  private static readonly classListCache = new Map<string, { expiresAt: number; value: unknown }>();

  private readClassListCache<T>(key: string) {
    const entry = TimetableService.classListCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      TimetableService.classListCache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  private writeClassListCache<T>(key: string, value: T, ttlMs = 15_000) {
    TimetableService.classListCache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
    return value;
  }

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

  private async currentContext(schoolId: string, termId?: string) {
    const term = termId
      ? await prisma.term.findFirst({ where: { id: termId, schoolId } })
      : await prisma.term.findFirst({ where: { schoolId, isCurrent: true }, orderBy: { startDate: "desc" } });
    if (!term) throw new BadRequestException("No current term is configured for this school.");
    const termSession = await prisma.academicSession.findUnique({ where: { id: term.academicSessionId } });
    return { academicSession: termSession, term };
  }

  private async ensurePeriodDefinitions(schoolId: string) {
    const cachedAt = TimetableService.periodDefinitionCache.get(schoolId);
    if (cachedAt && cachedAt > Date.now() - 5 * 60_000) {
      return;
    }

    const totalSeedCount = Object.values(periodSeeds).reduce((sum, seeds) => sum + seeds.length, 0);
    const existingCount = await prisma.periodDefinition.count({ where: { schoolId } });
    if (existingCount >= totalSeedCount) {
      TimetableService.periodDefinitionCache.set(schoolId, Date.now());
      return;
    }

    for (const seeds of Object.values(periodSeeds)) {
      for (const period of seeds) {
        await prisma.periodDefinition.upsert({
          where: {
            schoolId_periodNumber_category: {
              schoolId,
              periodNumber: period.periodNumber,
              category: period.category
            }
          },
          update: {
            label: period.label,
            startsAt: period.startsAt,
            endsAt: period.endsAt,
            slotType: period.slotType,
            displayOrder: period.displayOrder
          },
          create: {
            ...period,
            schoolId
          }
        });
      }
    }

    TimetableService.periodDefinitionCache.set(schoolId, Date.now());
  }

  private async getPeriodDefinitions(schoolId: string, category: string) {
    await this.ensurePeriodDefinitions(schoolId);
    return prisma.periodDefinition.findMany({
      where: { schoolId, category: periodCategory(category) },
      orderBy: { displayOrder: "asc" }
    });
  }

  private async classForAccess(session: SessionPayload, classId: string) {
    const classRoom = await prisma.classRoom.findFirst({
      where: { id: classId, schoolId: session.schoolId, deletedAt: null },
      include: {
        classLevel: true,
        classTeacher: { select: { id: true, firstName: true, lastName: true } }
      }
    });
    if (!classRoom) throw new NotFoundException("Class not found.");
    await this.assertClassAccess(session, classRoom);
    return classRoom;
  }

  private async assertClassAccess(session: SessionPayload, classRoom: ClassWithRelations) {
    if (session.role === UserRole.CLASS_TEACHER && classRoom.classTeacherId !== session.userId) {
      throw new ForbiddenException("You can only view your assigned class timetable.");
    }

    if (session.role === UserRole.TEACHER || session.role === UserRole.SUBJECT_TEACHER) {
      const teachesClass = await prisma.classSubject.count({
        where: { schoolId: session.schoolId, classId: classRoom.id, teacherId: session.userId }
      });
      if (teachesClass === 0) throw new ForbiddenException("You can only view classes you teach.");
    }

    if (session.role === UserRole.STUDENT) {
      const student = await prisma.student.findFirst({
        where: { schoolId: session.schoolId, userId: session.userId, currentClassId: classRoom.id }
      });
      if (!student) throw new ForbiddenException("You can only view your class timetable.");
    }

    if (session.role === UserRole.PARENT) {
      const guardian = await prisma.guardian.findFirst({
        where: { schoolId: session.schoolId, userId: session.userId },
        include: { students: { include: { student: { select: { currentClassId: true } } } } }
      });
      if (!guardian?.students.some((item) => item.student.currentClassId === classRoom.id)) {
        throw new ForbiddenException("You can only view your child's class timetable.");
      }
    }
  }

  private async classWhereForRole(session: SessionPayload, termId: string) {
    const base: Prisma.ClassRoomWhereInput = { schoolId: session.schoolId, deletedAt: null };
    if (session.role === UserRole.CLASS_TEACHER) return { ...base, classTeacherId: session.userId };
    if (session.role === UserRole.TEACHER || session.role === UserRole.SUBJECT_TEACHER) {
      const taught = await prisma.classSubject.findMany({
        where: { schoolId: session.schoolId, teacherId: session.userId },
        select: { classId: true }
      });
      const periodClasses = await prisma.timetableEntry.findMany({
        where: { schoolId: session.schoolId, termId, teacherId: session.userId },
        select: { classId: true },
        distinct: ["classId"]
      });
      return { ...base, id: { in: [...taught, ...periodClasses].map((item) => item.classId) } };
    }
    if (session.role === UserRole.STUDENT) {
      const student = await prisma.student.findFirst({ where: { schoolId: session.schoolId, userId: session.userId } });
      return { ...base, id: student?.currentClassId ?? "__none__" };
    }
    if (session.role === UserRole.PARENT) {
      const guardian = await prisma.guardian.findFirst({
        where: { schoolId: session.schoolId, userId: session.userId },
        include: { students: { include: { student: { select: { currentClassId: true } } } } }
      });
      return { ...base, id: { in: (guardian?.students ?? []).flatMap((item) => (item.student.currentClassId ? [item.student.currentClassId] : [])) } };
    }
    return base;
  }

  private async ensureTimetableForClass(classRoom: ClassWithRelations, termId: string, academicSessionId?: string | null) {
    await this.ensurePeriodDefinitions(classRoom.schoolId);
    const periods = await this.getPeriodDefinitions(classRoom.schoolId, classCategory(classRoom));
    const expectedCount = periods.length * 5;
    const existing = await prisma.timetableEntry.findMany({
      where: { schoolId: classRoom.schoolId, classId: classRoom.id, termId },
      select: { id: true, dayOfWeek: true, periodNumber: true, slotType: true, subjectId: true, teacherId: true }
    });
    if (existing.length >= expectedCount) {
      return;
    }
    const existingByKey = new Map(existing.map((slot) => [`${slot.dayOfWeek}:${slot.periodNumber}`, slot]));
    const subjects = await prisma.classSubject.findMany({
      where: { schoolId: classRoom.schoolId, classId: classRoom.id },
      include: { subject: true },
      orderBy: { subject: { name: "asc" } }
    });

    const lessonSubjects = subjects.length > 0 ? subjects : [];
    const rows: Prisma.TimetableEntryCreateManyInput[] = [];
    for (let day = 1; day <= 5; day += 1) {
      let lessonIndex = 0;
      for (const period of periods) {
        const existingSlot = existingByKey.get(`${day}:${period.periodNumber}`);
        if (existingSlot) {
          if (!nonTeachingSlots.includes(period.slotType)) lessonIndex += 1;
          continue;
        }
        const subjectAssignment = lessonSubjects[(lessonIndex + day - 1) % Math.max(lessonSubjects.length, 1)];
        const isTeaching = !nonTeachingSlots.includes(period.slotType);
        rows.push({
          schoolId: classRoom.schoolId,
          academicSessionId: academicSessionId ?? undefined,
          termId,
          classId: classRoom.id,
          dayOfWeek: day,
          periodNumber: period.periodNumber,
          startsAt: period.startsAt,
          endsAt: period.endsAt,
          subjectId: isTeaching ? subjectAssignment?.subjectId ?? null : null,
          teacherId: isTeaching ? subjectAssignment?.teacherId ?? null : null,
          venue: classRoom.room ?? "Main classroom",
          slotType: period.slotType === "lesson" ? (subjectAssignment ? "lesson" : "free") : period.slotType,
          isPublished: false
        });
        if (isTeaching) lessonIndex += 1;
      }
    }

    if (rows.length > 0) await prisma.timetableEntry.createMany({ data: rows, skipDuplicates: true });
  }

  private mapSlot(slot: Prisma.TimetableEntryGetPayload<{ include: { subject: true } }> & { teacherName?: string | null; teacherEmail?: string | null }) {
    return {
      id: slot.id,
      dayOfWeek: slot.dayOfWeek,
      day_of_week: slot.dayOfWeek,
      periodNumber: slot.periodNumber,
      period_number: slot.periodNumber,
      startTime: slot.startsAt,
      start_time: slot.startsAt,
      endTime: slot.endsAt,
      end_time: slot.endsAt,
      slotType: slot.slotType,
      slot_type: slot.slotType,
      room: slot.venue,
      notes: slot.notes,
      isPublished: slot.isPublished,
      is_published: slot.isPublished,
      isDoublePeriod: slot.isDoublePeriod,
      is_double_period: slot.isDoublePeriod,
      subjectId: slot.subjectId,
      subject_id: slot.subjectId,
      subjectName: slot.subject?.name ?? null,
      subject_name: slot.subject?.name ?? null,
      subjectCode: slot.subject?.code ?? null,
      subject_code: slot.subject?.code ?? null,
      teacherId: slot.teacherId,
      teacher_id: slot.teacherId,
      teacherName: slot.teacherName ?? null,
      teacher_name: slot.teacherName ?? null,
      teacherEmail: slot.teacherEmail ?? null,
      teacher_email: slot.teacherEmail ?? null
    };
  }

  async listClasses(session: SessionPayload, query: Record<string, string | undefined>): Promise<TimetableClassListPayload> {
    const cacheKey = JSON.stringify({
      schoolId: session.schoolId,
      userId: session.userId,
      role: session.role,
      termId: query.term_id ?? query.termId ?? "current",
    });
    const cached = this.readClassListCache<TimetableClassListPayload>(cacheKey);
    if (cached) {
      return cached;
    }

    const context = await this.currentContext(session.schoolId, query.term_id ?? query.termId);
    await this.ensurePeriodDefinitions(session.schoolId);

    const classRooms = await prisma.classRoom.findMany({
      where: await this.classWhereForRole(session, context.term.id),
      include: {
        classLevel: true,
        classTeacher: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: [{ displayOrder: "asc" }, { classLevel: { order: "asc" } }, { name: "asc" }]
    });

    const classIds = classRooms.map((classRoom) => classRoom.id);
    const slotCounts = classIds.length
      ? await prisma.timetableEntry.groupBy({
          by: ["classId"],
          where: { schoolId: session.schoolId, termId: context.term.id, classId: { in: classIds } },
          _count: { _all: true },
        })
      : [];
    const countByClassId = new Map(slotCounts.map((row) => [row.classId, row._count._all]));
    const expectedCountByCategory = new Map<string, number>();
    for (const classRoom of classRooms) {
      const category = classCategory(classRoom);
      if (!expectedCountByCategory.has(category)) {
        const periods = await this.getPeriodDefinitions(session.schoolId, category);
        expectedCountByCategory.set(category, periods.length * 5);
      }
    }
    await Promise.all(
      classRooms
        .filter((classRoom) => (countByClassId.get(classRoom.id) ?? 0) < (expectedCountByCategory.get(classCategory(classRoom)) ?? 0))
        .map((classRoom) => this.ensureTimetableForClass(classRoom, context.term.id, context.academicSession?.id)),
    );

    const statRows = await prisma.timetableEntry.findMany({
      where: { schoolId: session.schoolId, termId: context.term.id },
      select: { classId: true, subjectId: true, isPublished: true, slotType: true }
    });
    const statsByClass = new Map<string, { totalSlots: number; lessonSlots: number; filledSlots: number; publishedSlots: number }>();
    for (const row of statRows) {
      const current = statsByClass.get(row.classId) ?? { totalSlots: 0, lessonSlots: 0, filledSlots: 0, publishedSlots: 0 };
      const teachingSlot = !nonTeachingSlots.includes(row.slotType);
      current.totalSlots += 1;
      if (teachingSlot) current.lessonSlots += 1;
      if (teachingSlot && row.subjectId) current.filledSlots += 1;
      if (teachingSlot && row.isPublished) current.publishedSlots += 1;
      statsByClass.set(row.classId, current);
    }

    const mapped = classRooms.map((classRoom) => {
      const stat = statsByClass.get(classRoom.id);
      const totalSlots = stat?.totalSlots ?? 0;
      const lessonSlots = stat?.lessonSlots ?? 0;
      const filledSlots = stat?.filledSlots ?? 0;
      const publishedSlots = stat?.publishedSlots ?? 0;
      const setupStatus = totalSlots === 0 ? "empty" : filledSlots === 0 ? "structure_only" : publishedSlots === lessonSlots ? "published" : "draft";
      const category = classCategory(classRoom);
      return {
        id: classRoom.id,
        name: classDisplayName(classRoom),
        shortName: classRoom.shortName ?? classRoom.name.slice(0, 4).toUpperCase(),
        short_name: classRoom.shortName ?? classRoom.name.slice(0, 4).toUpperCase(),
        level: classRoom.classLevel.name,
        section: classRoom.section,
        category,
        arm: classRoom.arm,
        displayOrder: classRoom.displayOrder,
        display_order: classRoom.displayOrder,
        classTeacherName: displayName(classRoom.classTeacher),
        class_teacher_name: displayName(classRoom.classTeacher),
        classTeacherId: classRoom.classTeacherId,
        class_teacher_id: classRoom.classTeacherId,
        totalSlots,
        total_slots: totalSlots,
        lessonSlots,
        lesson_slots: lessonSlots,
        publishedSlots,
        published_slots: publishedSlots,
        filledSlots,
        filled_slots: filledSlots,
        setupStatus: setupStatus,
        setup_status: setupStatus
      };
    });

    const grouped = categoryOrder.reduce<Record<string, typeof mapped>>((acc, category) => {
      const items = mapped.filter((item) => item.category === category);
      if (items.length > 0) acc[category] = items;
      return acc;
    }, {});
    const other = mapped.filter((item) => !categoryOrder.includes(item.category as (typeof categoryOrder)[number]));
    if (other.length > 0) grouped.Other = other;

    return this.writeClassListCache(cacheKey, {
      data: grouped,
      meta: {
        academicSessionId: context.academicSession?.id ?? null,
        academic_year_id: context.academicSession?.id ?? null,
        termId: context.term.id,
        term_id: context.term.id,
        totalClasses: mapped.length,
        total_classes: mapped.length,
        publishedClasses: mapped.filter((item) => item.setupStatus === "published").length,
        published_classes: mapped.filter((item) => item.setupStatus === "published").length,
        emptyClasses: mapped.filter((item) => item.setupStatus === "empty" || item.setupStatus === "structure_only").length,
        empty_classes: mapped.filter((item) => item.setupStatus === "empty" || item.setupStatus === "structure_only").length
      }
    });
  }

  async getClassTimetable(session: SessionPayload, classId: string, query: Record<string, string | undefined>) {
    const context = await this.currentContext(session.schoolId, query.term_id ?? query.termId);
    const classRoom = await this.classForAccess(session, classId);
    await this.ensureTimetableForClass(classRoom, context.term.id, context.academicSession?.id);

    const category = classCategory(classRoom);
    const periodDefinitions = await this.getPeriodDefinitions(session.schoolId, category);
    const days = dayNames.slice(1).map((name, index) => ({ number: index + 1, name, short: name.slice(0, 3) }));
    const viewOnly = isPortalViewOnly(session.role);

    const slots = await prisma.timetableEntry.findMany({
      where: {
        schoolId: session.schoolId,
        classId,
        termId: context.term.id,
        ...(viewOnly ? { isPublished: true } : {})
      },
      include: { subject: true },
      orderBy: [{ dayOfWeek: "asc" }, { periodNumber: "asc" }]
    });

    const teacherIds = slots.flatMap((slot) => (slot.teacherId ? [slot.teacherId] : []));
    const teachers = teacherIds.length
      ? new Map(
          (
            await prisma.user.findMany({
              where: { schoolId: session.schoolId, id: { in: teacherIds } },
              select: { id: true, firstName: true, lastName: true, email: true }
            })
          ).map((teacher) => [teacher.id, teacher])
        )
      : new Map<string, { id: string; firstName: string; lastName: string; email: string }>();

    const slotsWithTeachers = slots.map((slot) => {
      const teacher = slot.teacherId ? teachers.get(slot.teacherId) : null;
      return {
        ...slot,
        teacherName: displayName(teacher),
        teacherEmail: teacher?.email ?? null
      };
    });

    const grid = periodDefinitions.map((period) => ({
      periodNumber: period.periodNumber,
      period_number: period.periodNumber,
      label: period.label,
      startTime: period.startsAt,
      start_time: period.startsAt,
      endTime: period.endsAt,
      end_time: period.endsAt,
      slotType: period.slotType,
      slot_type: period.slotType,
      slots: days.map((day) => ({
        dayNumber: day.number,
        day_number: day.number,
        dayName: day.name,
        day_name: day.name,
        slot: slotsWithTeachers.find((slot) => slot.dayOfWeek === day.number && slot.periodNumber === period.periodNumber)
          ? this.mapSlot(slotsWithTeachers.find((slot) => slot.dayOfWeek === day.number && slot.periodNumber === period.periodNumber)!)
          : null
      }))
    }));

    const teachingSlots = slotsWithTeachers.filter((slot) => !nonTeachingSlots.includes(slot.slotType));
    const publishedSlots = teachingSlots.filter((slot) => slot.isPublished).length;

    return {
      class: {
        id: classRoom.id,
        name: classDisplayName(classRoom),
        shortName: classRoom.shortName,
        short_name: classRoom.shortName,
        level: classRoom.classLevel.name,
        section: classRoom.section,
        category,
        arm: classRoom.arm,
        classTeacherName: displayName(classRoom.classTeacher),
        class_teacher_name: displayName(classRoom.classTeacher)
      },
      grid,
      days,
      periodDefinitions,
      period_definitions: periodDefinitions,
      rawSlots: slotsWithTeachers.map((slot) => this.mapSlot(slot)),
      raw_slots: slotsWithTeachers.map((slot) => this.mapSlot(slot)),
      meta: {
        termId: context.term.id,
        term_id: context.term.id,
        totalLessonSlots: teachingSlots.length,
        total_lesson_slots: teachingSlots.length,
        filledSlots: teachingSlots.filter((slot) => slot.subjectId).length,
        filled_slots: teachingSlots.filter((slot) => slot.subjectId).length,
        publishedSlots,
        published_slots: publishedSlots,
        isFullyPublished: teachingSlots.length > 0 && publishedSlots === teachingSlots.length,
        is_fully_published: teachingSlots.length > 0 && publishedSlots === teachingSlots.length,
        isDraft: teachingSlots.length > 0 && publishedSlots < teachingSlots.length,
        is_draft: teachingSlots.length > 0 && publishedSlots < teachingSlots.length,
        isEmpty: teachingSlots.length === 0,
        is_empty: teachingSlots.length === 0
      }
    };
  }

  async listClassSubjects(session: SessionPayload, classId: string) {
    await this.classForAccess(session, classId);
    const classSubjects = await prisma.classSubject.findMany({
      where: { schoolId: session.schoolId, classId },
      include: { subject: true },
      orderBy: { subject: { name: "asc" } }
    });
    const teacherIds = classSubjects.flatMap((item) => (item.teacherId ? [item.teacherId] : []));
    const teachers = teacherIds.length
      ? new Map(
          (
            await prisma.user.findMany({
              where: { schoolId: session.schoolId, id: { in: teacherIds } },
              select: { id: true, firstName: true, lastName: true, email: true }
            })
          ).map((teacher) => [teacher.id, teacher])
        )
      : new Map<string, { id: string; firstName: string; lastName: string; email: string }>();

    return classSubjects.map((item) => {
      const teacher = item.teacherId ? teachers.get(item.teacherId) : null;
      return {
        id: item.subject.id,
        subjectId: item.subject.id,
        subject_id: item.subject.id,
        name: item.subject.name,
        code: item.subject.code,
        teacherId: item.teacherId,
        teacher_id: item.teacherId,
        teacherName: displayName(teacher),
        teacher_name: displayName(teacher)
      };
    });
  }

  async listTeacherOptions(session: SessionPayload, query: Record<string, string | undefined>) {
    const search = query.search?.trim();
    const teachers = await prisma.user.findMany({
      where: {
        schoolId: session.schoolId,
        deletedAt: null,
        isActive: true,
        role: { in: [UserRole.TEACHER, UserRole.CLASS_TEACHER, UserRole.SUBJECT_TEACHER, UserRole.HEAD_OF_DEPARTMENT] },
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 250
    });
    return teachers.map((teacher) => ({
      id: teacher.id,
      firstName: teacher.firstName,
      first_name: teacher.firstName,
      lastName: teacher.lastName,
      last_name: teacher.lastName,
      name: `${teacher.firstName} ${teacher.lastName}`,
      email: teacher.email,
      role: teacher.role
    }));
  }

  private async assertCanEditSubject(session: SessionPayload, subjectId?: string | null) {
    if (session.role !== UserRole.HEAD_OF_DEPARTMENT || !subjectId) return;
    const [staff, subject] = await Promise.all([
      prisma.staffProfile.findUnique({ where: { userId: session.userId }, select: { departmentId: true } }),
      prisma.subject.findFirst({ where: { schoolId: session.schoolId, id: subjectId }, select: { departmentId: true } })
    ]);
    if (staff?.departmentId && subject?.departmentId && staff.departmentId !== subject.departmentId) {
      throw new ForbiddenException("HODs can only edit timetable slots for subjects in their department.");
    }
  }

  async saveSlot(session: SessionPayload, classId: string, body: Record<string, unknown>) {
    const parsed = slotSchema.parse(body);
    const dayOfWeek = parsed.dayOfWeek ?? parsed.day_of_week;
    const periodNumber = parsed.periodNumber ?? parsed.period_number;
    if (!dayOfWeek || periodNumber === undefined) throw new BadRequestException("Day and period are required.");

    const context = await this.currentContext(session.schoolId);
    const classRoom = await this.classForAccess(session, classId);
    const subjectId = parsed.subjectId ?? parsed.subject_id ?? null;
    const teacherId = parsed.teacherId ?? parsed.teacher_id ?? null;
    const slotType = parsed.slotType ?? parsed.slot_type ?? "lesson";
    await this.assertCanEditSubject(session, subjectId);

    const period = await prisma.periodDefinition.findFirst({
      where: { schoolId: session.schoolId, category: periodCategory(classCategory(classRoom)), periodNumber }
    });
    if (!period) throw new BadRequestException("Invalid period number for this class category.");

    if (subjectId) {
      const subject = await prisma.subject.findFirst({ where: { schoolId: session.schoolId, id: subjectId } });
      if (!subject) throw new BadRequestException("Selected subject does not exist in this school.");
    }
    if (teacherId) {
      const teacher = await prisma.user.findFirst({ where: { schoolId: session.schoolId, id: teacherId, deletedAt: null, isActive: true } });
      if (!teacher) throw new BadRequestException("Selected teacher does not exist in this school.");
    }

    if (teacherId && (slotType === "lesson" || slotType === "sports")) {
      const conflict = await prisma.timetableEntry.findFirst({
        where: {
          schoolId: session.schoolId,
          termId: context.term.id,
          teacherId,
          dayOfWeek,
          periodNumber,
          classId: { not: classId },
          slotType: { in: ["lesson", "sports"] }
        },
        include: { classRoom: true }
      });
      if (conflict) {
        throw new ConflictException({
          message: `Teacher conflict detected. This teacher is already assigned to ${classDisplayName(conflict.classRoom)} on ${dayNames[dayOfWeek]}, ${period.label} (${period.startsAt} - ${period.endsAt}).`,
          conflict: {
            type: "teacher",
            conflictingClass: classDisplayName(conflict.classRoom),
            conflicting_class: classDisplayName(conflict.classRoom),
            day: dayNames[dayOfWeek],
            period: period.label,
            time: `${period.startsAt} - ${period.endsAt}`
          }
        });
      }
    }

    const existing = await prisma.timetableEntry.findFirst({
      where: { schoolId: session.schoolId, classId, termId: context.term.id, dayOfWeek, periodNumber }
    });
    const isTeaching = slotType === "lesson" || slotType === "sports";
    const data = {
      academicSessionId: context.academicSession?.id ?? undefined,
      termId: context.term.id,
      startsAt: period.startsAt,
      endsAt: period.endsAt,
      subjectId: isTeaching ? subjectId : null,
      teacherId: isTeaching ? teacherId : null,
      venue: parsed.room ?? parsed.venue ?? null,
      slotType,
      notes: parsed.notes ?? null,
      isDoublePeriod: parsed.isDoublePeriod ?? parsed.is_double_period ?? false,
      isPublished: false,
      updatedById: session.userId
    };

    const saved = existing
      ? await prisma.timetableEntry.update({ where: { id: existing.id }, data })
      : await prisma.timetableEntry.create({
          data: {
            schoolId: session.schoolId,
            classId,
            dayOfWeek,
            periodNumber,
            createdById: session.userId,
            ...data
          }
        });

    await this.audit(session, existing ? AuditAction.UPDATE : AuditAction.CREATE, "timetable_slot", saved.id, {
      classId,
      dayOfWeek,
      periodNumber,
      subjectId,
      teacherId,
      slotType
    });

    return saved;
  }

  async deleteSlot(session: SessionPayload, classId: string, slotId: string, query: Record<string, string | undefined>) {
    await this.classForAccess(session, classId);
    const slot = await prisma.timetableEntry.findFirst({ where: { id: slotId, classId, schoolId: session.schoolId } });
    if (!slot) throw new NotFoundException("Slot not found.");

    if (query.clear_only === "true" || query.clearOnly === "true") {
      await prisma.timetableEntry.update({
        where: { id: slotId },
        data: {
          subjectId: null,
          teacherId: null,
          venue: null,
          notes: null,
          slotType: "free",
          isDoublePeriod: false,
          isPublished: false,
          updatedById: session.userId
        }
      });
    } else {
      await prisma.timetableEntry.delete({ where: { id: slotId } });
    }

    await this.audit(session, AuditAction.DELETE, "timetable_slot", slotId, { classId });
    return { message: "Slot cleared." };
  }

  async publishClass(session: SessionPayload, classId: string, body: Record<string, unknown>) {
    const parsed = publishSchema.parse(body);
    const context = await this.currentContext(session.schoolId, parsed.termId ?? parsed.term_id);
    const classRoom = await this.classForAccess(session, classId);
    const isPublished = parsed.action === "publish";

    if (isPublished) {
      const emptyCount = await prisma.timetableEntry.count({
        where: {
          schoolId: session.schoolId,
          classId,
          termId: context.term.id,
          slotType: "lesson",
          subjectId: null
        }
      });
      if (emptyCount > 0) {
        throw new BadRequestException(`This timetable has ${emptyCount} unfilled lesson slot(s). Fill all lesson slots or mark them as free periods before publishing.`);
      }
    }

    const updated = await prisma.timetableEntry.updateMany({
      where: { schoolId: session.schoolId, classId, termId: context.term.id },
      data: { isPublished, updatedById: session.userId }
    });

    await prisma.timetablePublishLog.create({
      data: {
        schoolId: session.schoolId,
        classId,
        academicSessionId: context.academicSession?.id,
        termId: context.term.id,
        action: isPublished ? "published" : "unpublished",
        publishedById: session.userId
      }
    });
    await this.audit(session, AuditAction.UPDATE, "timetable", classId, { action: parsed.action, updated: updated.count });

    return { message: `${classDisplayName(classRoom)} timetable has been ${isPublished ? "published" : "unpublished"}.`, updated: updated.count };
  }

  async publishAll(session: SessionPayload, body: Record<string, unknown>) {
    const parsed = publishSchema.parse(body);
    const context = await this.currentContext(session.schoolId, parsed.termId ?? parsed.term_id);
    const isPublished = parsed.action === "publish";
    const updated = await prisma.timetableEntry.updateMany({
      where: { schoolId: session.schoolId, termId: context.term.id },
      data: { isPublished, updatedById: session.userId }
    });
    await prisma.timetablePublishLog.create({
      data: {
        schoolId: session.schoolId,
        classId: null,
        academicSessionId: context.academicSession?.id,
        termId: context.term.id,
        action: isPublished ? "published" : "unpublished",
        publishedById: session.userId
      }
    });
    await this.audit(session, AuditAction.UPDATE, "timetable", session.schoolId, { action: parsed.action, updated: updated.count });
    return { message: `All timetables have been ${isPublished ? "published" : "unpublished"}.`, updated: updated.count };
  }

  async getTeacherTimetable(session: SessionPayload) {
    const context = await this.currentContext(session.schoolId);
    const slots = await prisma.timetableEntry.findMany({
      where: { schoolId: session.schoolId, termId: context.term.id, teacherId: session.userId, isPublished: true, slotType: { in: ["lesson", "sports"] } },
      include: { subject: true, classRoom: { include: { classLevel: true } } },
      orderBy: [{ dayOfWeek: "asc" }, { periodNumber: "asc" }]
    });
    const mapped = slots.map((slot) => this.mapTeacherSlot(slot));
    const byDay = dayNames.slice(1).reduce<Record<string, typeof mapped>>((acc, day) => {
      acc[day] = [];
      return acc;
    }, {});
    mapped.forEach((slot) => {
      byDay[slot.dayName]?.push(slot);
    });
    const todayNumber = new Date().getDay();
    return {
      byDay,
      by_day: byDay,
      today: mapped.filter((slot) => slot.dayOfWeek === todayNumber),
      allSlots: mapped,
      all_slots: mapped,
      summary: {
        totalPeriodsPerWeek: mapped.length,
        total_periods_per_week: mapped.length,
        classesTeaching: new Set(mapped.map((slot) => slot.classId)).size,
        classes_teaching: new Set(mapped.map((slot) => slot.classId)).size,
        subjectsTeaching: new Set(mapped.map((slot) => slot.subjectCode).filter(Boolean)).size,
        subjects_teaching: new Set(mapped.map((slot) => slot.subjectCode).filter(Boolean)).size
      }
    };
  }

  private mapTeacherSlot(
    slot: Prisma.TimetableEntryGetPayload<{ include: { subject: true; classRoom: { include: { classLevel: true } } } }>
  ) {
    return {
      id: slot.id,
      dayOfWeek: slot.dayOfWeek,
      day_of_week: slot.dayOfWeek,
      dayName: dayNames[slot.dayOfWeek],
      day_name: dayNames[slot.dayOfWeek],
      periodNumber: slot.periodNumber,
      period_number: slot.periodNumber,
      startTime: slot.startsAt,
      start_time: slot.startsAt,
      endTime: slot.endsAt,
      end_time: slot.endsAt,
      room: slot.venue,
      subjectName: slot.subject?.name ?? "Free Period",
      subject_name: slot.subject?.name ?? "Free Period",
      subjectCode: slot.subject?.code ?? null,
      subject_code: slot.subject?.code ?? null,
      classId: slot.classId,
      class_id: slot.classId,
      className: classDisplayName(slot.classRoom),
      class_name: classDisplayName(slot.classRoom),
      shortName: slot.classRoom.shortName,
      short_name: slot.classRoom.shortName
    };
  }

  async checkConflicts(session: SessionPayload) {
    const context = await this.currentContext(session.schoolId);
    const slots = await prisma.timetableEntry.findMany({
      where: {
        schoolId: session.schoolId,
        termId: context.term.id,
        teacherId: { not: null },
        slotType: { in: ["lesson", "sports"] }
      },
      include: { subject: true, classRoom: true },
      orderBy: [{ dayOfWeek: "asc" }, { periodNumber: "asc" }]
    });

    const seen = new Map<string, typeof slots[number]>();
    const conflicts: Array<Record<string, string | number | null>> = [];
    for (const slot of slots) {
      const key = `${slot.teacherId}:${slot.dayOfWeek}:${slot.periodNumber}`;
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, slot);
        continue;
      }
      const teacher = slot.teacherId
        ? await prisma.user.findUnique({ where: { id: slot.teacherId }, select: { firstName: true, lastName: true } })
        : null;
      conflicts.push({
        teacherName: displayName(teacher),
        teacher_name: displayName(teacher),
        teacherId: slot.teacherId,
        teacher_id: slot.teacherId,
        dayOfWeek: slot.dayOfWeek,
        day_of_week: slot.dayOfWeek,
        periodNumber: slot.periodNumber,
        period_number: slot.periodNumber,
        startTime: slot.startsAt,
        start_time: slot.startsAt,
        endTime: slot.endsAt,
        end_time: slot.endsAt,
        class1: classDisplayName(existing.classRoom),
        class_1: classDisplayName(existing.classRoom),
        subject1: existing.subject?.name ?? "Free",
        subject_1: existing.subject?.name ?? "Free",
        class2: classDisplayName(slot.classRoom),
        class_2: classDisplayName(slot.classRoom),
        subject2: slot.subject?.name ?? "Free",
        subject_2: slot.subject?.name ?? "Free"
      });
    }

    return { data: conflicts, hasConflicts: conflicts.length > 0, has_conflicts: conflicts.length > 0, conflictCount: conflicts.length, conflict_count: conflicts.length };
  }
}
