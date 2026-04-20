import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, SchoolCategory, SchoolSection, StudentStatus, UserRole } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import {
  formatNigeriaClassName,
  getNigeriaClassLookupNames,
  nigeriaClassOptions,
  normalizeNigeriaClassValue
} from "../../../../src/lib/school-options";

const defaultNigerianClasses = [
  ["Nursery 1", "A", "N1A", 25],
  ["Nursery 1", "B", "N1B", 25],
  ["Nursery 2", "A", "N2A", 25],
  ["Nursery 2", "B", "N2B", 25],
  ["KG 1", "A", "K1A", 28],
  ["KG 1", "B", "K1B", 28],
  ["KG 2", "A", "K2A", 28],
  ["KG 2", "B", "K2B", 28],
  ["Primary 1", "A", "P1A", 35],
  ["Primary 1", "B", "P1B", 35],
  ["Primary 2", "A", "P2A", 35],
  ["Primary 2", "B", "P2B", 35],
  ["Primary 3", "A", "P3A", 35],
  ["Primary 3", "B", "P3B", 35],
  ["Primary 4", "A", "P4A", 38],
  ["Primary 4", "B", "P4B", 38],
  ["Primary 5", "A", "P5A", 38],
  ["Primary 5", "B", "P5B", 38],
  ["Primary 6", "A", "P6A", 38],
  ["Primary 6", "B", "P6B", 38],
  ["JSS 1", "A", "J1A", 40],
  ["JSS 1", "B", "J1B", 40],
  ["JSS 1", "C", "J1C", 40],
  ["JSS 2", "A", "J2A", 40],
  ["JSS 2", "B", "J2B", 40],
  ["JSS 2", "C", "J2C", 40],
  ["JSS 3", "A", "J3A", 40],
  ["JSS 3", "B", "J3B", 40],
  ["JSS 3", "C", "J3C", 40],
  ["SSS 1", "Science", "SS1S", 40],
  ["SSS 1", "Arts", "SS1A", 38],
  ["SSS 1", "Commercial", "SS1C", 38],
  ["SSS 2", "Science", "SS2S", 40],
  ["SSS 2", "Arts", "SS2A", 38],
  ["SSS 2", "Commercial", "SS2C", 38],
  ["SSS 3", "Science", "SS3S", 40],
  ["SSS 3", "Arts", "SS3A", 38],
  ["SSS 3", "Commercial", "SS3C", 38]
] as const;

const skillDefinitions = [
  ["Social Development", "Shares and takes turns"],
  ["Social Development", "Cooperates with peers"],
  ["Social Development", "Follows classroom rules"],
  ["Social Development", "Shows empathy"],
  ["Physical Development", "Fine motor skills"],
  ["Physical Development", "Gross motor skills"],
  ["Physical Development", "Hand-eye coordination"],
  ["Physical Development", "Personal hygiene habits"],
  ["Cognitive Development", "Problem solving"],
  ["Cognitive Development", "Attention and focus"],
  ["Cognitive Development", "Memory and recall"],
  ["Cognitive Development", "Number recognition"],
  ["Communication", "Expresses ideas clearly"],
  ["Communication", "Listens attentively"],
  ["Communication", "Vocabulary development"],
  ["Communication", "Participates in discussions"],
  ["Creative Arts", "Drawing and colouring"],
  ["Creative Arts", "Music and rhythm"],
  ["Creative Arts", "Role play and drama"],
  ["Creative Arts", "Craft work"],
  ["Emotional Development", "Self-confidence"],
  ["Emotional Development", "Manages emotions"],
  ["Emotional Development", "Independence"],
  ["Emotional Development", "Positive attitude to learning"]
] as const;

const classPayloadSchema = z.object({
  name: z.string().min(2),
  shortName: z.string().optional().or(z.literal("")),
  level: z.string().min(2),
  section: z.string().optional().or(z.literal("")),
  category: z.enum(["Early Years", "Primary", "Junior Secondary", "Senior Secondary"]),
  arm: z.string().optional().or(z.literal("")),
  capacity: z.coerce.number().int().min(1).max(250).default(40),
  room: z.string().optional().or(z.literal("")),
  displayOrder: z.coerce.number().int().min(0).default(0)
});

const assignTeacherSchema = z.object({
  classTeacherId: z.string().optional().nullable(),
  assistantClassTeacherId: z.string().optional().nullable()
});

function pagination(query: Record<string, string | undefined>) {
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize ?? "25", 10) || 25));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function categoryFromSection(section?: SchoolSection | null) {
  if (section === "CRECHE" || section === "NURSERY") return "Early Years";
  if (section === "PRIMARY") return "Primary";
  if (section === "JUNIOR_SECONDARY") return "Junior Secondary";
  if (section === "SENIOR_SECONDARY") return "Senior Secondary";
  return "Primary";
}

function normalizeCategory(category?: string | null, section?: SchoolSection | null) {
  if (category === "Early Years" || category === "Primary" || category === "Junior Secondary" || category === "Senior Secondary") return category;
  if (category === "CRECHE" || category === "NURSERY") return "Early Years";
  if (category === "PRIMARY") return "Primary";
  if (category === "JUNIOR_SECONDARY") return "Junior Secondary";
  if (category === "SENIOR_SECONDARY") return "Senior Secondary";
  return categoryFromSection(section);
}

function sectionsForCategory(category: string) {
  if (category === "Early Years") return [SchoolSection.CRECHE, SchoolSection.NURSERY];
  if (category === "Primary") return [SchoolSection.PRIMARY];
  if (category === "Junior Secondary") return [SchoolSection.JUNIOR_SECONDARY];
  if (category === "Senior Secondary") return [SchoolSection.SENIOR_SECONDARY];
  return [];
}

function schoolCategoryFromSection(section: SchoolSection): SchoolCategory {
  if (section === "PRIMARY") return SchoolCategory.PRIMARY;
  if (section === "CRECHE" || section === "NURSERY") return SchoolCategory.NURSERY;
  return SchoolCategory.SECONDARY;
}

function displayName(name: string, arm?: string | null) {
  if (!arm) return name;
  if (name.includes(arm)) return name;
  return `${name} ${arm}`;
}

function gradeFromScore(score?: number | null) {
  if (score === null || score === undefined) return null;
  if (score >= 75) return "A1";
  if (score >= 70) return "B2";
  if (score >= 65) return "B3";
  if (score >= 60) return "C4";
  if (score >= 55) return "C5";
  if (score >= 50) return "C6";
  if (score >= 45) return "D7";
  if (score >= 40) return "E8";
  return "F9";
}

type ClassTeacherLite = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
};

type ClassShapeInput = {
  id: string;
  name: string;
  arm: string;
  shortName: string | null;
  section: string | null;
  category: string | null;
  capacity: number;
  room: string | null;
  displayOrder: number;
  isActive: boolean;
  classLevel: {
    name: string;
    order: number;
    schoolSection: SchoolSection | null;
  };
  classTeacher: ClassTeacherLite | null;
  assistantClassTeacher: ClassTeacherLite | null;
  _count?: {
    students: number;
  };
};

@Injectable()
export class ClassesService {
  async ok<T>(dataPromise: Promise<T>, message?: string) {
    return { ok: true, success: true, ...(message ? { message } : {}), data: await dataPromise };
  }

  private async audit(session: SessionPayload, action: AuditAction, entityId: string, metadata?: Prisma.InputJsonValue) {
    await prisma.auditLog.create({
      data: {
        schoolId: session.schoolId,
        actorId: session.userId,
        action,
        entityType: "class",
        entityId,
        metadata
      }
    });
  }

  private async currentContext(schoolId: string) {
    const [academicSession, term] = await Promise.all([
      prisma.academicSession.findFirst({ where: { schoolId, isCurrent: true }, orderBy: { startDate: "desc" } }),
      prisma.term.findFirst({ where: { schoolId, isCurrent: true }, orderBy: { startDate: "desc" } })
    ]);
    return { academicSession, term };
  }

  private async ensureClassLevels(schoolId: string) {
    const existing = await prisma.classLevel.findMany({ where: { schoolId } });
    const byName = new Map(existing.map((item) => [item.name, item]));

    for (const option of nigeriaClassOptions) {
      if (byName.has(option.label)) continue;
      const created = await prisma.classLevel.create({
        data: {
          schoolId,
          name: option.label,
          section: schoolCategoryFromSection(option.section),
          schoolSection: option.section,
          order: option.order
        }
      });
      byName.set(created.name, created);
    }

    return byName;
  }

  private async ensureDefaultClasses(schoolId: string) {
    const levels = await this.ensureClassLevels(schoolId);
    let displayOrder = 1;
    for (const [level, section, shortName, capacity] of defaultNigerianClasses) {
      const classLevel = levels.get(level);
      if (!classLevel) continue;
      const data = {
        classLevelId: classLevel.id,
        name: level,
        arm: section,
        section,
        shortName,
        category: categoryFromSection(classLevel.schoolSection),
        capacity,
        displayOrder,
        isActive: true
      };
      const existing = await prisma.classRoom.findFirst({
        where: { schoolId, name: level, arm: section, deletedAt: null },
        select: { id: true, displayOrder: true, isActive: true }
      });

      if (existing) {
        await prisma.classRoom.update({
          where: { id: existing.id },
          data: {
            displayOrder: existing.displayOrder || displayOrder,
            isActive: existing.isActive,
            shortName: shortName ?? undefined,
            category: data.category
          }
        });
      } else {
        await prisma.classRoom.create({
          data: {
            schoolId,
            ...data,
            room: `Block ${data.category.startsWith("Senior") ? "C" : "A"} Room ${displayOrder}`
          }
        });
      }
      displayOrder += 1;
    }
  }

  private async ensureSkillDefinitions(schoolId: string) {
    const count = await prisma.skillDefinition.count({ where: { schoolId } });
    if (count > 0) return;
    await prisma.skillDefinition.createMany({
      data: skillDefinitions.map(([category, name], index) => ({
        schoolId,
        category,
        name,
        displayOrder: index + 1
      })),
      skipDuplicates: true
    });
  }

  private async assertClassScope(session: SessionPayload, classId: string) {
    const classRoom = await prisma.classRoom.findFirst({
      where: { id: classId, schoolId: session.schoolId, deletedAt: null },
      include: {
        classLevel: true,
        classTeacher: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        assistantClassTeacher: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } }
      }
    });
    if (!classRoom) throw new NotFoundException("Class not found.");
    if (session.role === "CLASS_TEACHER" && classRoom.classTeacherId !== session.userId) {
      throw new ForbiddenException("You can only open your assigned form class.");
    }
    return classRoom;
  }

  private shapeClass(classRoom: ClassShapeInput) {
    const category = normalizeCategory(classRoom.category, classRoom.classLevel.schoolSection);
    const section = classRoom.section ?? classRoom.arm;
    const name = displayName(classRoom.name, classRoom.arm);
    return {
      id: classRoom.id,
      name,
      shortName: classRoom.shortName ?? name.replace(/\s+/g, "").slice(0, 5).toUpperCase(),
      level: classRoom.classLevel.name,
      section,
      category,
      arm: classRoom.arm ? (["Science", "Arts", "Commercial"].includes(classRoom.arm) ? classRoom.arm : `Section ${classRoom.arm}`) : section,
      capacity: classRoom.capacity,
      room: classRoom.room,
      studentCount: classRoom._count?.students ?? 0,
      student_count: classRoom._count?.students ?? 0,
      displayOrder: classRoom.displayOrder || classRoom.classLevel.order,
      display_order: classRoom.displayOrder || classRoom.classLevel.order,
      isActive: classRoom.isActive,
      is_active: classRoom.isActive,
      classTeacher: classRoom.classTeacher
        ? {
            id: classRoom.classTeacher.id,
            name: `${classRoom.classTeacher.firstName} ${classRoom.classTeacher.lastName}`,
            email: classRoom.classTeacher.email,
            phone: classRoom.classTeacher.phone
          }
        : null,
      class_teacher: classRoom.classTeacher
        ? {
            id: classRoom.classTeacher.id,
            name: `${classRoom.classTeacher.firstName} ${classRoom.classTeacher.lastName}`,
            email: classRoom.classTeacher.email,
            phone: classRoom.classTeacher.phone,
            avatar: null
          }
        : null,
      assistantClassTeacher: classRoom.assistantClassTeacher
        ? {
            id: classRoom.assistantClassTeacher.id,
            name: `${classRoom.assistantClassTeacher.firstName} ${classRoom.assistantClassTeacher.lastName}`,
            email: classRoom.assistantClassTeacher.email,
            phone: classRoom.assistantClassTeacher.phone
          }
        : null,
      assistant_class_teacher: classRoom.assistantClassTeacher
        ? {
            id: classRoom.assistantClassTeacher.id,
            name: `${classRoom.assistantClassTeacher.firstName} ${classRoom.assistantClassTeacher.lastName}`,
            email: classRoom.assistantClassTeacher.email,
            phone: classRoom.assistantClassTeacher.phone,
            avatar: null
          }
        : null
    };
  }

  async listClasses(session: SessionPayload, query: Record<string, string | undefined>) {
    await this.ensureDefaultClasses(session.schoolId);
    const andFilters: Prisma.ClassRoomWhereInput[] = [];
    if (query.search) {
      andFilters.push({
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { arm: { contains: query.search, mode: "insensitive" } },
          { section: { contains: query.search, mode: "insensitive" } },
          { shortName: { contains: query.search, mode: "insensitive" } },
          { classLevel: { name: { contains: query.search, mode: "insensitive" } } }
        ]
      });
    }
    if (query.category && query.category !== "all") {
      andFilters.push({
        OR: [
          { category: query.category },
          { category: { in: sectionsForCategory(query.category) } },
          { classLevel: { schoolSection: { in: sectionsForCategory(query.category) } } }
        ]
      });
    }
    if (session.role === "SUBJECT_TEACHER" || session.role === "TEACHER") {
      andFilters.push({ OR: [{ classSubjects: { some: { teacherId: session.userId } } }, { classTeacherId: session.userId }] });
    }
    const where: Prisma.ClassRoomWhereInput = {
      schoolId: session.schoolId,
      deletedAt: null,
      ...(query.is_active === "true" || query.isActive === "true" ? { isActive: true } : {}),
      ...(query.is_active === "false" || query.isActive === "false" ? { isActive: false } : {}),
      ...(query.level ? { classLevel: { name: query.level } } : {}),
      ...(query.has_teacher === "yes" ? { classTeacherId: { not: null } } : {}),
      ...(query.has_teacher === "no" ? { classTeacherId: null } : {}),
      ...(session.role === "CLASS_TEACHER" ? { classTeacherId: session.userId } : {}),
      ...(andFilters.length > 0 ? { AND: andFilters } : {})
    };

    const classes = await prisma.classRoom.findMany({
      where,
      include: {
        classLevel: true,
        classTeacher: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        assistantClassTeacher: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        _count: { select: { students: { where: { status: StudentStatus.ACTIVE } } } }
      },
      orderBy: [{ displayOrder: "asc" }, { classLevel: { order: "asc" } }, { category: "asc" }, { name: "asc" }, { arm: "asc" }]
    });

    const data = classes.map((classRoom) => this.shapeClass(classRoom));
    const categoryOrder = ["Early Years", "Primary", "Junior Secondary", "Senior Secondary"] as const;
    const grouped = categoryOrder.reduce<Record<string, typeof data>>((acc, category) => {
      const items = data.filter((item) => item.category === category);
      if (items.length > 0) acc[category] = items;
      return acc;
    }, {});
    const other = data.filter((item) => !categoryOrder.includes(item.category as (typeof categoryOrder)[number]));
    if (other.length > 0) grouped.Other = other;

    return {
      data,
      grouped,
      total: data.length,
      page: 1,
      pageSize: data.length,
      totalPages: 1
    };
  }

  async listTeacherOptions(session: SessionPayload, query: Record<string, string | undefined>) {
    const search = query.search?.trim();
    const users = await prisma.user.findMany({
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
      include: {
        classesLed: { select: { id: true, name: true, arm: true }, where: { deletedAt: null }, take: 1 },
        staffProfile: { include: { department: true } }
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 200
    });

    return users.map((user) => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      departmentName: user.staffProfile?.department?.name ?? null,
      currentClass: user.classesLed[0]?.id ?? null,
      currentClassName: user.classesLed[0] ? formatNigeriaClassName(`${user.classesLed[0].name} - ${user.classesLed[0].arm}`) : null
    }));
  }

  async getClassDetail(session: SessionPayload, classId: string) {
    const classRoom = await this.assertClassScope(session, classId);
    const { academicSession, term } = await this.currentContext(session.schoolId);
    const [studentCount, subjects, timetableCount, examCount, resultGroup, attendance] = await Promise.all([
      prisma.student.count({ where: { schoolId: session.schoolId, currentClassId: classId, status: StudentStatus.ACTIVE } }),
      prisma.classSubject.findMany({
        where: { schoolId: session.schoolId, classId },
        include: { subject: true }
      }),
      prisma.timetableEntry.count({ where: { schoolId: session.schoolId, classId, ...(term?.id ? { termId: term.id } : {}) } }),
      prisma.examTimetableEntry.count({ where: { schoolId: session.schoolId, classId, ...(term?.id ? { termId: term.id } : {}) } }),
      prisma.resultSheet.groupBy({
        by: ["status"],
        where: { schoolId: session.schoolId, classId, ...(term?.id ? { termId: term.id } : {}) },
        _count: { _all: true }
      }),
      prisma.studentAttendance.findMany({
        where: { schoolId: session.schoolId, classId, subjectId: null, ...(term?.id ? { termId: term.id } : {}) },
        select: { status: true }
      })
    ]);
    const teacherIds = subjects.flatMap((item) => (item.teacherId ? [item.teacherId] : []));
    const teachers = teacherIds.length
      ? await prisma.user.findMany({ where: { schoolId: session.schoolId, id: { in: teacherIds } }, select: { id: true, firstName: true, lastName: true } })
      : [];
    const teachersById = new Map(teachers.map((teacher) => [teacher.id, teacher]));
    const submitted = resultGroup
      .filter((item) => ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "PUBLISHED"].includes(item.status))
      .reduce((sum, item) => sum + item._count._all, 0);
    const attendancePercent = attendance.length
      ? Math.round((attendance.filter((item) => item.status !== "ABSENT").length / attendance.length) * 100)
      : null;

    return {
      ...this.shapeClass({ ...classRoom, _count: { students: studentCount } }),
      academicYear: academicSession,
      academic_year: academicSession,
      currentTerm: term,
      current_term: term,
      subjects: subjects.map((item) => {
        const teacher = item.teacherId ? teachersById.get(item.teacherId) : null;
        return {
          id: item.subject.id,
          name: item.subject.name,
          code: item.subject.code,
          teacherId: teacher?.id ?? null,
          teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : null,
          teacher_name: teacher ? `${teacher.firstName} ${teacher.lastName}` : null
        };
      }),
      timetable: {
        totalSlots: timetableCount,
        total_slots: timetableCount,
        publishedSlots: timetableCount,
        published_slots: timetableCount,
        examSlots: examCount,
        isSetUp: timetableCount > 0,
        is_set_up: timetableCount > 0,
        isPublished: timetableCount > 0,
        is_published: timetableCount > 0
      },
      results: {
        totalSubjects: subjects.length,
        total_subjects: subjects.length,
        submittedSubjects: submitted,
        submitted_subjects: submitted,
        progressPercent: subjects.length ? Math.min(100, Math.round((submitted / Math.max(1, studentCount * subjects.length)) * 100)) : 0,
        progress_percent: subjects.length ? Math.min(100, Math.round((submitted / Math.max(1, studentCount * subjects.length)) * 100)) : 0
      },
      attendance: {
        averagePercent: attendancePercent,
        average_percent: attendancePercent,
        totalRecords: attendance.length,
        total_records: attendance.length
      }
    };
  }

  async listClassMembers(session: SessionPayload, classId: string, query: Record<string, string | undefined>) {
    await this.assertClassScope(session, classId);
    const { page, pageSize, skip } = pagination(query);
    const where: Prisma.StudentWhereInput = {
      schoolId: session.schoolId,
      currentClassId: classId,
      ...(query.status ? { status: query.status as StudentStatus } : {}),
      ...(query.gender ? { gender: query.gender.toUpperCase() as "MALE" | "FEMALE" | "OTHER" } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" } },
              { lastName: { contains: query.search, mode: "insensitive" } },
              { admissionNumber: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };
    const [total, students] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        include: { guardians: { include: { guardian: true }, where: { isPrimary: true }, take: 1 } },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip,
        take: pageSize
      })
    ]);

    return {
      data: students.map((student, index) => {
        const guardian = student.guardians[0]?.guardian;
        return {
          sn: skip + index + 1,
          id: student.id,
          firstName: student.firstName,
          first_name: student.firstName,
          lastName: student.lastName,
          last_name: student.lastName,
          middleName: student.middleName,
          middle_name: student.middleName,
          admissionNumber: student.admissionNumber,
          admission_number: student.admissionNumber,
          gender: student.gender,
          photo: null,
          status: student.status,
          admissionDate: student.admissionDate.toISOString(),
          admission_date: student.admissionDate.toISOString(),
          parentName: guardian ? `${guardian.firstName} ${guardian.lastName}` : null,
          parent_name: guardian ? `${guardian.firstName} ${guardian.lastName}` : null,
          parentPhone: guardian?.phone ?? null,
          parent_phone: guardian?.phone ?? null
        };
      }),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  async getClassResults(session: SessionPayload, classId: string, query: Record<string, string | undefined>) {
    await this.assertClassScope(session, classId);
    const { term } = await this.currentContext(session.schoolId);
    const termId = query.termId ?? query.term_id ?? term?.id;
    const [students, subjects, scoreEntries, resultSheets] = await Promise.all([
      prisma.student.findMany({
        where: { schoolId: session.schoolId, currentClassId: classId, status: StudentStatus.ACTIVE },
        select: { id: true, firstName: true, lastName: true, admissionNumber: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
      }),
      prisma.classSubject.findMany({ where: { schoolId: session.schoolId, classId }, include: { subject: true } }),
      prisma.scoreEntry.findMany({ where: { schoolId: session.schoolId, ...(termId ? { resultSheet: { termId } } : {}), student: { currentClassId: classId } } }),
      prisma.resultSheet.findMany({ where: { schoolId: session.schoolId, classId, ...(termId ? { termId } : {}) } })
    ]);

    const subjectViews = subjects.map((item) => ({ id: item.subject.id, name: item.subject.name, code: item.subject.code }));
    const resultByStudent = new Map(resultSheets.map((sheet) => [sheet.studentId, sheet]));

    const grid = students.map((student) => {
      const subjectScores = subjectViews.map((subject) => {
        const entries = scoreEntries.filter((entry) => entry.studentId === student.id && entry.subjectId === subject.id);
        const total = entries.length ? Math.round(entries.reduce((sum, entry) => sum + entry.score, 0) * 10) / 10 : null;
        return {
          subjectId: subject.id,
          subject_id: subject.id,
          subjectName: subject.name,
          subject_name: subject.name,
          subjectCode: subject.code,
          subject_code: subject.code,
          totalScore: total,
          total_score: total,
          grade: gradeFromScore(total),
          isSubmitted: Boolean(resultByStudent.get(student.id)?.submittedAt),
          is_submitted: Boolean(resultByStudent.get(student.id)?.submittedAt)
        };
      });
      const completed = subjectScores.filter((score) => score.totalScore !== null);
      const totalScore = completed.reduce((sum, score) => sum + (score.totalScore ?? 0), 0);
      const average = completed.length ? Math.round((totalScore / completed.length) * 10) / 10 : null;
      return {
        studentId: student.id,
        student_id: student.id,
        studentName: `${student.lastName} ${student.firstName}`,
        student_name: `${student.lastName} ${student.firstName}`,
        admissionNumber: student.admissionNumber,
        admission_number: student.admissionNumber,
        subjects: subjectScores,
        totalScore,
        total_score: totalScore,
        average,
        grade: gradeFromScore(average)
      };
    });
    const ranked = [...grid].sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
    ranked.forEach((student, index) => {
      const match = grid.find((item) => item.studentId === student.studentId);
      if (match) Object.assign(match, { position: index + 1 });
    });

    return { students: grid, subjects: subjectViews, termId };
  }

  async getClassAttendance(session: SessionPayload, classId: string, query: Record<string, string | undefined>) {
    await this.assertClassScope(session, classId);
    const { term } = await this.currentContext(session.schoolId);
    const termId = query.termId ?? query.term_id ?? term?.id;
    const month = query.month ? Number(query.month) : undefined;
    const records = await prisma.studentAttendance.findMany({
      where: {
        schoolId: session.schoolId,
        classId,
        subjectId: null,
        ...(termId ? { termId } : {}),
        ...(month ? { date: { gte: new Date(Date.UTC(new Date().getUTCFullYear(), month - 1, 1)), lt: new Date(Date.UTC(new Date().getUTCFullYear(), month, 1)) } } : {})
      },
      include: { student: true },
      orderBy: [{ date: "asc" }, { student: { lastName: "asc" } }]
    });
    const grouped = new Map<string, typeof records>();
    for (const record of records) grouped.set(record.studentId, [...(grouped.get(record.studentId) ?? []), record]);
    const summary = Array.from(grouped.values()).map((items, index) => {
      const first = items[0];
      const present = items.filter((item) => item.status === "PRESENT").length;
      const late = items.filter((item) => item.status === "LATE").length;
      const absent = items.filter((item) => item.status === "ABSENT").length;
      const excused = items.filter((item) => item.status === "EXCUSED").length;
      const percentage = items.length ? Math.round(((present + late + excused) / items.length) * 1000) / 10 : 0;
      return {
        sn: index + 1,
        studentId: first.studentId,
        student_id: first.studentId,
        studentName: `${first.student.lastName} ${first.student.firstName}`,
        student_name: `${first.student.lastName} ${first.student.firstName}`,
        admissionNumber: first.student.admissionNumber,
        admission_number: first.student.admissionNumber,
        totalDays: items.length,
        total_days: items.length,
        present,
        late,
        absent,
        excused,
        percentage,
        status: percentage >= 75 ? "good" : "at_risk"
      };
    });

    return {
      summary,
      daily: records.map((record) => ({
        date: record.date.toISOString(),
        studentId: record.studentId,
        student_id: record.studentId,
        status: record.status.toLowerCase()
      }))
    };
  }

  async getClassSkills(session: SessionPayload, classId: string, query: Record<string, string | undefined>) {
    const classRoom = await this.assertClassScope(session, classId);
    await this.ensureSkillDefinitions(session.schoolId);
    const { term } = await this.currentContext(session.schoolId);
    const termId = query.termId ?? query.term_id ?? term?.id;
    const [definitions, ratings] = await Promise.all([
      prisma.skillDefinition.findMany({ where: { schoolId: session.schoolId, isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
      termId
        ? prisma.studentSkill.findMany({
            where: { schoolId: session.schoolId, classId, termId },
            include: { student: true, skill: true }
          })
        : Promise.resolve([])
    ]);
    return {
      classId,
      className: displayName(classRoom.name, classRoom.arm),
      termId,
      definitions,
      ratings: ratings.map((rating) => ({
        studentId: rating.studentId,
        studentName: `${rating.student.firstName} ${rating.student.lastName}`,
        admissionNumber: rating.student.admissionNumber,
        skillId: rating.skillId,
        skillName: rating.skill.name,
        skillCategory: rating.skill.category,
        rating: rating.rating,
        remark: rating.remark,
        assessedBy: rating.assessedById
      }))
    };
  }

  private async classLevelFor(schoolId: string, level: string) {
    const normalized = normalizeNigeriaClassValue(level);
    const option = normalized ? nigeriaClassOptions.find((item) => item.value === normalized) : undefined;
    const labels = option ? getNigeriaClassLookupNames(option.value) : [level];
    const existing = await prisma.classLevel.findFirst({
      where: { schoolId, OR: labels.map((name) => ({ name })) }
    });
    if (existing) return existing;
    if (!option) throw new BadRequestException("Select a valid Nigerian class level.");
    return prisma.classLevel.create({
      data: {
        schoolId,
        name: option.label,
        section: schoolCategoryFromSection(option.section),
        schoolSection: option.section,
        order: option.order
      }
    });
  }

  async createClass(session: SessionPayload, payload: unknown) {
    const parsed = classPayloadSchema.parse(payload);
    const level = await this.classLevelFor(session.schoolId, parsed.level);
    const created = await prisma.classRoom.create({
      data: {
        schoolId: session.schoolId,
        classLevelId: level.id,
        name: parsed.level,
        arm: parsed.section || parsed.arm || "A",
        shortName: parsed.shortName || null,
        section: parsed.section || null,
        category: parsed.category,
        capacity: parsed.capacity,
        room: parsed.room || null,
        displayOrder: parsed.displayOrder || level.order
      }
    });
    await this.audit(session, AuditAction.CREATE, created.id, { className: parsed.name });
    return this.getClassDetail(session, created.id);
  }

  async updateClass(session: SessionPayload, classId: string, payload: unknown) {
    await this.assertClassScope(session, classId);
    const parsed = classPayloadSchema.partial().parse(payload);
    const level = parsed.level ? await this.classLevelFor(session.schoolId, parsed.level) : null;
    await prisma.classRoom.update({
      where: { id: classId },
      data: {
        ...(level ? { classLevelId: level.id, name: parsed.level } : {}),
        ...(parsed.shortName !== undefined ? { shortName: parsed.shortName || null } : {}),
        ...(parsed.section !== undefined ? { section: parsed.section || null, arm: parsed.section || "A" } : {}),
        ...(parsed.category ? { category: parsed.category } : {}),
        ...(parsed.capacity ? { capacity: parsed.capacity } : {}),
        ...(parsed.room !== undefined ? { room: parsed.room || null } : {}),
        ...(parsed.displayOrder !== undefined ? { displayOrder: parsed.displayOrder } : {})
      }
    });
    await this.audit(session, AuditAction.UPDATE, classId, parsed as Prisma.InputJsonObject);
    return this.getClassDetail(session, classId);
  }

  async assignTeacher(session: SessionPayload, classId: string, payload: unknown) {
    const classRoom = await this.assertClassScope(session, classId);
    const parsed = assignTeacherSchema.parse(payload);
    if (parsed.classTeacherId && parsed.assistantClassTeacherId && parsed.classTeacherId === parsed.assistantClassTeacherId) {
      throw new BadRequestException("The form teacher and assistant form teacher must be different people.");
    }
    const ids = [parsed.classTeacherId, parsed.assistantClassTeacherId].filter(Boolean) as string[];
    if (ids.length) {
      const found = await prisma.user.count({
        where: {
          schoolId: session.schoolId,
          id: { in: ids },
          deletedAt: null,
          role: { in: [UserRole.TEACHER, UserRole.CLASS_TEACHER, UserRole.SUBJECT_TEACHER, UserRole.HEAD_OF_DEPARTMENT] }
        }
      });
      if (found !== ids.length) throw new BadRequestException("One or more selected teachers were not found in this school.");
    }
    if (parsed.classTeacherId) {
      const existing = await prisma.classRoom.findFirst({
        where: { schoolId: session.schoolId, classTeacherId: parsed.classTeacherId, id: { not: classId }, deletedAt: null }
      });
      if (existing) throw new BadRequestException(`This teacher is already the form teacher of ${displayName(existing.name, existing.arm)}.`);
    }

    const { academicSession, term } = await this.currentContext(session.schoolId);
    await prisma.classRoom.update({
      where: { id: classId },
      data: {
        classTeacherId: parsed.classTeacherId || null,
        assistantClassTeacherId: parsed.assistantClassTeacherId || null
      }
    });
    if (academicSession && term) {
      await prisma.classAcademicAssignment.upsert({
        where: {
          classId_academicSessionId_termId: {
            classId,
            academicSessionId: academicSession.id,
            termId: term.id
          }
        },
        update: {
          classTeacherId: parsed.classTeacherId || null,
          assistantClassTeacherId: parsed.assistantClassTeacherId || null
        },
        create: {
          schoolId: session.schoolId,
          classId,
          academicSessionId: academicSession.id,
          termId: term.id,
          classTeacherId: parsed.classTeacherId || null,
          assistantClassTeacherId: parsed.assistantClassTeacherId || null
        }
      });
    }
    await this.audit(session, AuditAction.UPDATE, classId, {
      previousClassTeacherId: classRoom.classTeacherId,
      classTeacherId: parsed.classTeacherId,
      assistantClassTeacherId: parsed.assistantClassTeacherId
    });
    return this.getClassDetail(session, classId);
  }

  async deleteClass(session: SessionPayload, classId: string) {
    await this.assertClassScope(session, classId);
    const activeStudents = await prisma.student.count({
      where: { schoolId: session.schoolId, currentClassId: classId, status: StudentStatus.ACTIVE }
    });
    if (activeStudents > 0) {
      throw new BadRequestException("This class has active students. Move the students before archiving the class.");
    }
    await prisma.classRoom.update({ where: { id: classId }, data: { deletedAt: new Date(), isActive: false } });
    await this.audit(session, AuditAction.DELETE, classId);
    return { id: classId, archived: true };
  }
}
