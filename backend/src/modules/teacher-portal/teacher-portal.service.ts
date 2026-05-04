import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { calculateSubjectTotals, resolveGradeLabel } from "../../../../src/lib/domain/grading";
import { canTeacherManageAssignedSubject, canUseTeacherPortal } from "../../../../src/lib/domain/teacher-portal";
import {
  AnnouncementView,
  PortalTimetableEntry,
  SchoolContextView,
  StudentPortalNotificationView,
  TeacherAssignmentTaskView,
  TeacherAttendanceEntryView,
  TeacherAttendanceWorkspaceView,
  TeacherClassPortalView,
  TeacherClassStudentView,
  TeacherPortalView,
  TeacherScoreEntryView
} from "../../../../src/lib/domain/types";
import { formatNigeriaClassName } from "../../../../src/lib/school-options";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const teacherAttendanceSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1).optional(),
  studentId: z.string().min(1),
  date: z.coerce.date().default(() => new Date()),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
  reason: z.string().max(500).optional()
});

const teacherDailyRegisterSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1).optional(),
  date: z.coerce.date().default(() => new Date()),
  entries: z.array(
    z.object({
      studentId: z.string().min(1),
      status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
      reason: z.string().max(500).optional(),
    }),
  ).min(1),
});

const teacherScoreSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  studentId: z.string().min(1),
  continuousAssessment: z.coerce.number().min(0).max(40),
  exam: z.coerce.number().min(0).max(60),
  teacherComment: z.string().max(1000).optional()
});

const teacherAssignmentSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  title: z.string().min(5).max(160),
  description: z.string().max(3000).optional(),
  dueAt: z.coerce.date(),
  attachmentUrl: z.string().url().optional().or(z.literal("")),
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]).default("PUBLISHED")
});

function formatClassName(classRoom?: { name: string; arm?: string | null } | null) {
  if (!classRoom) return "Unassigned";
  return formatNigeriaClassName(classRoom.arm ? `${classRoom.name} - ${classRoom.arm}` : classRoom.name);
}

function formatStudentName(student: { firstName: string; middleName?: string | null; lastName: string }) {
  return [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
}

function normalizeAttendanceDate(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function ensureAttendanceDateIsNotFuture(date: Date) {
  const normalized = normalizeAttendanceDate(date);
  const today = normalizeAttendanceDate(new Date());
  if (normalized.getTime() > today.getTime()) {
    throw new BadRequestException("Attendance can only be marked for today or an earlier date.");
  }
  return normalized;
}

function isTeacherAudience(audience: string) {
  const normalized = audience.toLowerCase();
  return (
    normalized.includes("teacher") ||
    normalized.includes("staff") ||
    normalized.includes("school") ||
    normalized.includes("all")
  );
}

function isSchemaDriftError(error: unknown) {
  return error instanceof Error && /does not exist in the current database|column .* does not exist/i.test(error.message);
}

function formatDashboardError(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

@Injectable()
export class TeacherPortalService {
  private async resolveDashboardSection<T>(
    label: string,
    task: Promise<T>,
    fallback: T,
  ): Promise<T> {
    try {
      return await task;
    } catch (error) {
      console.error(`[teacher-portal.dashboard] ${label} fallback: ${formatDashboardError(error)}`);
      return fallback;
    }
  }

  private assertTeacherSession(session: SessionPayload) {
    if (!canUseTeacherPortal(session.role)) {
      throw new ForbiddenException("Teacher portal data is only available to teacher accounts.");
    }
  }

  private async currentTerm(schoolId: string) {
    const term = await prisma.term.findFirst({
      where: { schoolId, isCurrent: true },
      include: { academicSession: true }
    });
    if (!term) {
      throw new NotFoundException("No active term is configured for this school.");
    }
    return term;
  }

  private async getSchoolContext(session: SessionPayload): Promise<SchoolContextView> {
    const school = await prisma.school.findUniqueOrThrow({
      where: { id: session.schoolId },
      include: {
        academicSessions: {
          where: { isCurrent: true },
          include: { terms: { where: { isCurrent: true } } },
          orderBy: { startDate: "desc" },
          take: 1,
        },
      },
    });

    return {
      schoolName: school.name,
      currentSession: school.academicSessions[0]?.name ?? "No active session",
      currentTerm: school.academicSessions[0]?.terms[0]?.name ?? "No active term",
    };
  }

  private async assertAssignedClassSubject(session: SessionPayload, classId: string, subjectId: string) {
    this.assertTeacherSession(session);
    const assignment = await prisma.classSubject.findFirst({
      where: { schoolId: session.schoolId, classId, subjectId },
      include: { classRoom: true, subject: true }
    });

    if (
      !assignment ||
      !canTeacherManageAssignedSubject({
        role: session.role,
        teacherId: session.userId,
        assignedTeacherId: assignment.teacherId
      })
    ) {
      throw new ForbiddenException("You can only manage classes and subjects assigned to you.");
    }

    return assignment;
  }

  private async assertAssignedClassTeacher(session: SessionPayload, classId: string) {
    this.assertTeacherSession(session);
    const classRoom = await prisma.classRoom.findFirst({
      where: {
        schoolId: session.schoolId,
        id: classId,
        deletedAt: null,
        isActive: true,
      },
    });

    if (
      !classRoom ||
      (classRoom.classTeacherId !== session.userId &&
        classRoom.assistantClassTeacherId !== session.userId)
    ) {
      throw new ForbiddenException("You can only submit attendance for classes assigned to you.");
    }

    return classRoom;
  }

  private async getClassTeacherClasses(session: SessionPayload) {
    this.assertTeacherSession(session);

    return prisma.classRoom.findMany({
      where: {
        schoolId: session.schoolId,
        OR: [{ classTeacherId: session.userId }, { assistantClassTeacherId: session.userId }],
        deletedAt: null,
        isActive: true,
      },
      include: {
        students: {
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        },
      },
      orderBy: [{ name: "asc" }, { arm: "asc" }],
    });
  }

  private async getTeacherAssignments(session: SessionPayload) {
    this.assertTeacherSession(session);
    return prisma.classSubject.findMany({
      where: { schoolId: session.schoolId, teacherId: session.userId },
      include: {
        classRoom: { include: { students: { orderBy: [{ lastName: "asc" }, { firstName: "asc" }] } } },
        subject: true
      },
      orderBy: [{ classRoom: { name: "asc" } }, { subject: { name: "asc" } }]
    });
  }

  private async getAssignmentStudentList(session: SessionPayload): Promise<TeacherClassStudentView[]> {
    const [assignments, classTeacherClasses] = await Promise.all([
      this.getTeacherAssignments(session),
      this.getClassTeacherClasses(session),
    ]);
    const studentsByClass = new Map<string, TeacherClassStudentView>();

    for (const assignment of assignments) {
      const className = formatClassName(assignment.classRoom);
      for (const student of assignment.classRoom.students) {
        studentsByClass.set(`${student.id}:${assignment.classId}`, {
          studentId: student.id,
          admissionNumber: student.admissionNumber,
          studentName: formatStudentName(student),
          classId: assignment.classId,
          className
        });
      }
    }

    for (const classRoom of classTeacherClasses) {
      const className = formatClassName(classRoom);
      for (const student of classRoom.students) {
        studentsByClass.set(`${student.id}:${classRoom.id}`, {
          studentId: student.id,
          admissionNumber: student.admissionNumber,
          studentName: formatStudentName(student),
          classId: classRoom.id,
          className,
        });
      }
    }

    return Array.from(studentsByClass.values());
  }

  private mapAttendanceRecord(record: {
    id: string;
    studentId: string;
    classId: string;
    subjectId?: string | null;
    status: string;
    date: Date;
    reason?: string | null;
    student: { firstName: string; middleName?: string | null; lastName: string; admissionNumber?: string };
    classRoom: { name: string; arm?: string | null; classLevel?: { name: string } | null };
    subject?: { name: string } | null;
  }): TeacherAttendanceEntryView {
    return {
      id: record.id,
      studentId: record.studentId,
      studentName: formatStudentName(record.student),
      admissionNumber: record.student.admissionNumber,
      classId: record.classId,
      className: formatClassName(record.classRoom),
      classLevel: record.classRoom.classLevel?.name,
      subjectId: record.subjectId ?? undefined,
      subject: record.subject?.name,
      status: record.status as TeacherAttendanceEntryView["status"],
      date: record.date.toISOString(),
      reason: record.reason ?? undefined
    };
  }

  private mapAssignmentTask(task: {
    id: string;
    classId: string;
    subjectId: string;
    title: string;
    description?: string | null;
    dueAt: Date;
    status: string;
    attachmentUrl?: string | null;
    classRoom: { name: string; arm?: string | null };
    subject: { name: string };
    _count?: { submissions: number };
  }): TeacherAssignmentTaskView {
    return {
      id: task.id,
      classId: task.classId,
      className: formatClassName(task.classRoom),
      subjectId: task.subjectId,
      subject: task.subject.name,
      title: task.title,
      description: task.description ?? undefined,
      dueAt: task.dueAt.toISOString(),
      status: task.status as TeacherAssignmentTaskView["status"],
      attachmentUrl: task.attachmentUrl ?? undefined,
      submissionsCount: task._count?.submissions ?? 0
    };
  }

  async listTeacherAssignments(session: SessionPayload): Promise<TeacherClassPortalView[]> {
    this.assertTeacherSession(session);

    const [assignments, classTeacherClasses, term] = await Promise.all([
      this.getTeacherAssignments(session),
      this.getClassTeacherClasses(session),
      this.currentTerm(session.schoolId),
    ]);
    const publishedSheets = await prisma.resultSheet.findMany({
      where: {
        schoolId: session.schoolId,
        termId: term.id,
        classId: { in: assignments.map((item) => item.classId) },
        status: "PUBLISHED",
        publishedAt: { not: null }
      },
      select: { studentId: true, classId: true }
    });
    const publishedKeys = new Set(publishedSheets.map((item) => `${item.classId}:${item.studentId}`));

    const subjectAssignments = assignments.map((assignment) => {
      const learners = assignment.classRoom.students.length;
      const publishedCount = assignment.classRoom.students.filter((student) =>
        publishedKeys.has(`${assignment.classId}:${student.id}`)
      ).length;

      return {
        classId: assignment.classId,
        subjectId: assignment.subjectId,
        className: formatClassName(assignment.classRoom),
        subject: assignment.subject.name,
        learners,
        pendingScores: Math.max(learners - publishedCount, 0),
        nextAction: learners === publishedCount ? "Review published score sheet" : "Complete attendance and score entry"
      };
    });

    const classTeacherAssignments = classTeacherClasses.map((classRoom) => ({
        classId: classRoom.id,
        className: formatClassName(classRoom),
        subject: "Class register",
        learners: classRoom.students.length,
        pendingScores: 0,
        nextAction: "Take daily class attendance",
      } satisfies TeacherClassPortalView));

    return [...subjectAssignments, ...classTeacherAssignments];
  }

  async getTeacherTimetable(session: SessionPayload): Promise<PortalTimetableEntry[]> {
    this.assertTeacherSession(session);

    const timetable = await prisma.timetableEntry.findMany({
      where: { schoolId: session.schoolId, teacherId: session.userId },
      include: { classRoom: true, subject: true },
      orderBy: [{ dayOfWeek: "asc" }, { startsAt: "asc" }]
    });

    return timetable.map((item) => ({
      id: item.id,
      day: dayNames[item.dayOfWeek] ?? `Day ${item.dayOfWeek}`,
      time: `${item.startsAt} - ${item.endsAt}`,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      classId: item.classId,
      subjectId: item.subjectId ?? undefined,
      subject: item.subject?.name ?? "Free Period",
      venue: item.venue ?? "Classroom",
      className: formatClassName(item.classRoom),
      teacherName: session.name
    }));
  }

  async getAttendanceWorkspace(session: SessionPayload): Promise<TeacherAttendanceWorkspaceView> {
    this.assertTeacherSession(session);
    const [classTeacherClasses, teachingAssignments, term, schoolContext] = await Promise.all([
      this.getClassTeacherClasses(session),
      this.getTeacherAssignments(session),
      this.currentTerm(session.schoolId),
      this.getSchoolContext(session),
    ]);
    const classTeacherIds = new Set(classTeacherClasses.map((item) => item.id));
    const assignmentPairs = new Set(
      teachingAssignments.map((item) => `${item.classId}:${item.subjectId}`),
    );
    const subjectNameById = new Map(
      teachingAssignments.map((item) => [item.subjectId, item.subject.name]),
    );
    const classIds = new Set([
      ...classTeacherClasses.map((item) => item.id),
      ...teachingAssignments.map((item) => item.classId),
    ]);
    const subjectIds = [...new Set(teachingAssignments.map((item) => item.subjectId))];
    const records = await prisma.studentAttendance.findMany({
      where: {
        schoolId: session.schoolId,
        classId: { in: [...classIds] },
        termId: term.id,
        OR: [
          { subjectId: null, classId: { in: [...classTeacherIds] } },
          ...(subjectIds.length ? [{ subjectId: { in: subjectIds } }] : []),
        ],
      },
      include: { student: true, classRoom: { include: { classLevel: true } } },
      orderBy: [{ date: "desc" }, { student: { lastName: "asc" } }],
    });

    return {
      ...schoolContext,
      records: records
        .filter((record) => {
          if (!record.subjectId) return classTeacherIds.has(record.classId);
          return assignmentPairs.has(`${record.classId}:${record.subjectId}`);
        })
        .map((record) =>
          this.mapAttendanceRecord({
            ...record,
            subject: record.subjectId
              ? { name: subjectNameById.get(record.subjectId) ?? "Assigned subject" }
              : null,
          }),
        ),
    };
  }

  async markAttendance(session: SessionPayload, payload: unknown): Promise<TeacherAttendanceEntryView> {
    this.assertTeacherSession(session);
    const parsed = teacherAttendanceSchema.parse(payload);

    const [term, student] = await Promise.all([
      this.currentTerm(session.schoolId),
      prisma.student.findFirst({ where: { id: parsed.studentId, schoolId: session.schoolId, currentClassId: parsed.classId } })
    ]);

    const subjectAssignment = parsed.subjectId
      ? await this.assertAssignedClassSubject(session, parsed.classId, parsed.subjectId)
      : null;

    if (!parsed.subjectId) {
      await this.assertAssignedClassTeacher(session, parsed.classId);
    }

    if (!student) {
      throw new BadRequestException("Selected student is not enrolled in the selected class.");
    }

    const normalizedDate = ensureAttendanceDateIsNotFuture(parsed.date);

    if (!parsed.subjectId) {
      const existing = await prisma.studentAttendance.findFirst({
        where: {
          schoolId: session.schoolId,
          studentId: parsed.studentId,
          classId: parsed.classId,
          termId: term.id,
          date: normalizedDate,
          subjectId: null,
        },
      });

      const record = existing
        ? await prisma.studentAttendance.update({
            where: { id: existing.id },
            data: {
              markedById: session.userId,
              status: parsed.status,
              reason: parsed.reason,
            },
            include: { student: true, classRoom: true },
          })
        : await prisma.studentAttendance.create({
            data: {
              schoolId: session.schoolId,
              studentId: parsed.studentId,
              classId: parsed.classId,
              termId: term.id,
              markedById: session.userId,
              subjectId: null,
              date: normalizedDate,
              status: parsed.status,
              reason: parsed.reason,
            },
            include: { student: true, classRoom: true },
          });

      return this.mapAttendanceRecord({ ...record, subject: null });
    }

    const record = await prisma.studentAttendance.upsert({
      where: {
        studentId_termId_date_subjectId: {
          studentId: parsed.studentId,
          termId: term.id,
          date: normalizedDate,
          subjectId: parsed.subjectId
        }
      },
      update: {
        markedById: session.userId,
        status: parsed.status,
        reason: parsed.reason
      },
      create: {
        schoolId: session.schoolId,
        studentId: parsed.studentId,
        classId: parsed.classId,
        termId: term.id,
        markedById: session.userId,
        subjectId: parsed.subjectId,
        date: normalizedDate,
        status: parsed.status,
        reason: parsed.reason
      },
      include: { student: true, classRoom: true }
    });

    return this.mapAttendanceRecord({ ...record, subject: subjectAssignment?.subject ?? null });
  }

  async submitDailyRegister(session: SessionPayload, payload: unknown): Promise<TeacherAttendanceEntryView[]> {
    this.assertTeacherSession(session);
    const parsed = teacherDailyRegisterSchema.parse(payload);
    const normalizedDate = ensureAttendanceDateIsNotFuture(parsed.date);
    const [term, students] = await Promise.all([
      this.currentTerm(session.schoolId),
      prisma.student.findMany({
        where: {
          schoolId: session.schoolId,
          currentClassId: parsed.classId,
          id: { in: parsed.entries.map((entry) => entry.studentId) },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
    ]);

    const subjectAssignment = parsed.subjectId
      ? await this.assertAssignedClassSubject(session, parsed.classId, parsed.subjectId)
      : null;

    const classRoom = subjectAssignment
      ? subjectAssignment.classRoom
      : await this.assertAssignedClassTeacher(session, parsed.classId);

    if (students.length !== parsed.entries.length) {
      throw new BadRequestException("One or more selected students are not enrolled in the assigned class.");
    }
    const studentById = new Map(students.map((student) => [student.id, student]));
    const saved: TeacherAttendanceEntryView[] = [];

    for (const entry of parsed.entries) {
      const existing = await prisma.studentAttendance.findFirst({
        where: {
          schoolId: session.schoolId,
          studentId: entry.studentId,
          classId: parsed.classId,
          termId: term.id,
          date: normalizedDate,
          subjectId: parsed.subjectId ?? null,
        },
      });

      const record = existing
        ? await prisma.studentAttendance.update({
            where: { id: existing.id },
            data: {
              markedById: session.userId,
              status: entry.status,
              reason: entry.reason,
            },
            include: { student: true, classRoom: true },
          })
        : await prisma.studentAttendance.create({
            data: {
              schoolId: session.schoolId,
              studentId: entry.studentId,
              classId: parsed.classId,
              termId: term.id,
              markedById: session.userId,
              subjectId: parsed.subjectId ?? null,
              date: normalizedDate,
              status: entry.status,
              reason: entry.reason,
            },
            include: { student: true, classRoom: true },
          });

      saved.push(
        this.mapAttendanceRecord({
          ...record,
          student: studentById.get(entry.studentId) ?? record.student,
          classRoom,
          subject: subjectAssignment?.subject ?? null,
        }),
      );
    }

    return saved;
  }

  async listScores(session: SessionPayload): Promise<TeacherScoreEntryView[]> {
    this.assertTeacherSession(session);

    const [assignments, term] = await Promise.all([
      this.getTeacherAssignments(session),
      this.currentTerm(session.schoolId),
    ]);
    if (assignments.length === 0) return [];

    const assignedPairs = new Set(assignments.map((item) => `${item.classId}:${item.subjectId}`));
    const classIds = [...new Set(assignments.map((item) => item.classId))];
    const subjectIds = [...new Set(assignments.map((item) => item.subjectId))];
    const scoreEntries = await prisma.scoreEntry.findMany({
      where: {
        schoolId: session.schoolId,
        subjectId: { in: subjectIds },
        resultSheet: {
          classId: { in: classIds },
          termId: term.id,
        },
      },
      include: {
        student: true,
        subject: true,
        assessmentComponent: true,
        resultSheet: { include: { classRoom: true } },
      },
      orderBy: [{ resultSheet: { classId: "asc" } }, { subjectId: "asc" }, { student: { lastName: "asc" } }, { recordedAt: "desc" }],
    });

    const grouped = new Map<string, TeacherScoreEntryView>();
    for (const score of scoreEntries) {
      const pair = `${score.resultSheet.classId}:${score.subjectId}`;
      if (!assignedPairs.has(pair)) continue;
      const key = `${score.studentId}:${score.resultSheet.classId}:${score.subjectId}`;
      const entry =
        grouped.get(key) ??
        ({
          id: key,
          studentId: score.studentId,
          studentName: formatStudentName(score.student),
          classId: score.resultSheet.classId,
          className: formatClassName(score.resultSheet.classRoom),
          subjectId: score.subjectId,
          subject: score.subject.name,
          continuousAssessment: 0,
          exam: 0,
          total: 0,
          grade: "F9",
          published: Boolean(score.resultSheet.publishedAt),
          recordedAt: score.recordedAt.toISOString(),
          teacherComment: score.resultSheet.teacherComment ?? undefined
        } satisfies TeacherScoreEntryView);

      if (score.assessmentComponent.code === "CA") entry.continuousAssessment = score.score;
      if (score.assessmentComponent.code === "EXAM") entry.exam = score.score;
      entry.total = entry.continuousAssessment + entry.exam;
      entry.grade = resolveGradeLabel(entry.total).label;
      grouped.set(key, entry);
    }

    return assignments.flatMap((assignment) =>
      assignment.classRoom.students.map((student) => {
        const key = `${student.id}:${assignment.classId}:${assignment.subjectId}`;
        return (
          grouped.get(key) ??
          ({
            id: key,
            studentId: student.id,
            studentName: formatStudentName(student),
            classId: assignment.classId,
            className: formatClassName(assignment.classRoom),
            subjectId: assignment.subjectId,
            subject: assignment.subject.name,
            continuousAssessment: 0,
            exam: 0,
            total: 0,
            grade: resolveGradeLabel(0).label,
            published: false,
            teacherComment: undefined,
          } satisfies TeacherScoreEntryView)
        );
      }),
    );
  }

  async enterAssessmentScores(session: SessionPayload, payload: unknown): Promise<TeacherScoreEntryView> {
    this.assertTeacherSession(session);
    const parsed = teacherScoreSchema.parse(payload);
    const total = parsed.continuousAssessment + parsed.exam;
    const grade = resolveGradeLabel(total).label;

    const [assignment, term, student] = await Promise.all([
      this.assertAssignedClassSubject(session, parsed.classId, parsed.subjectId),
      this.currentTerm(session.schoolId),
      prisma.student.findFirst({ where: { id: parsed.studentId, schoolId: session.schoolId, currentClassId: parsed.classId } })
    ]);

    if (!student) {
      throw new BadRequestException("Selected student is not enrolled in the selected class.");
    }

    const existingSheet = await prisma.resultSheet.findUnique({
      where: { studentId_termId: { studentId: parsed.studentId, termId: term.id } }
    });

    if (
      existingSheet?.publishedAt ||
      existingSheet?.lockedAt ||
      ["UNDER_REVIEW", "APPROVED", "PUBLISHED"].includes(existingSheet?.status ?? "")
    ) {
      throw new ForbiddenException("Reviewed, approved, published, or locked result sheets cannot be edited by teachers.");
    }

    const [caComponent, examComponent] = await Promise.all([
      prisma.assessmentComponent.upsert({
        where: { schoolId_code: { schoolId: session.schoolId, code: "CA" } },
        update: { name: "Continuous Assessment", weight: 40, maxScore: 40, order: 1, isActive: true },
        create: {
          schoolId: session.schoolId,
          termId: term.id,
          name: "Continuous Assessment",
          code: "CA",
          weight: 40,
          maxScore: 40,
          order: 1,
          isActive: true
        }
      }),
      prisma.assessmentComponent.upsert({
        where: { schoolId_code: { schoolId: session.schoolId, code: "EXAM" } },
        update: { name: "Exam", weight: 60, maxScore: 60, order: 2, isActive: true },
        create: {
          schoolId: session.schoolId,
          termId: term.id,
          name: "Exam",
          code: "EXAM",
          weight: 60,
          maxScore: 60,
          order: 2,
          isActive: true
        }
      })
    ]);

    const resultSheet = await prisma.resultSheet.upsert({
      where: { studentId_termId: { studentId: parsed.studentId, termId: term.id } },
      update: {
        classId: parsed.classId,
        totalScore: total,
        averageScore: total,
        grade,
        teacherComment: parsed.teacherComment
      },
      create: {
        schoolId: session.schoolId,
        studentId: parsed.studentId,
        termId: term.id,
        classId: parsed.classId,
        createdById: session.userId,
        totalScore: total,
        averageScore: total,
        grade,
        teacherComment: parsed.teacherComment
      }
    });

    await prisma.scoreEntry.deleteMany({
      where: {
        schoolId: session.schoolId,
        resultSheetId: resultSheet.id,
        subjectId: parsed.subjectId
      }
    });

    await prisma.scoreEntry.createMany({
      data: [
        {
          schoolId: session.schoolId,
          studentId: parsed.studentId,
          resultSheetId: resultSheet.id,
          subjectId: parsed.subjectId,
          assessmentComponentId: caComponent.id,
          enteredById: session.userId,
          score: parsed.continuousAssessment,
          maxScore: caComponent.maxScore,
          isDraft: true
        },
        {
          schoolId: session.schoolId,
          studentId: parsed.studentId,
          resultSheetId: resultSheet.id,
          subjectId: parsed.subjectId,
          assessmentComponentId: examComponent.id,
          enteredById: session.userId,
          score: parsed.exam,
          maxScore: examComponent.maxScore,
          isDraft: true
        }
      ]
    });

    const allEntries = await prisma.scoreEntry.findMany({
      where: { schoolId: session.schoolId, resultSheetId: resultSheet.id },
      select: { subjectId: true, score: true, assessmentComponent: { select: { code: true } } }
    });
    const summary = calculateSubjectTotals(allEntries);
    await prisma.resultSheet.update({
      where: { id: resultSheet.id },
      data: {
        totalScore: summary.totalScore || total,
        averageScore: summary.averageScore || total,
        grade: resolveGradeLabel(summary.averageScore || total).label
      }
    });

    return {
      id: resultSheet.id,
      studentId: parsed.studentId,
      studentName: formatStudentName(student),
      classId: parsed.classId,
      className: formatClassName(assignment.classRoom),
      subjectId: parsed.subjectId,
      subject: assignment.subject.name,
      continuousAssessment: parsed.continuousAssessment,
      exam: parsed.exam,
      total,
      grade,
      published: false,
      recordedAt: new Date().toISOString(),
      teacherComment: parsed.teacherComment
    };
  }

  async listTeacherAssignmentTasks(session: SessionPayload): Promise<TeacherAssignmentTaskView[]> {
    this.assertTeacherSession(session);

    const tasks = await prisma.assignment.findMany({
      where: { schoolId: session.schoolId, teacherId: session.userId },
      include: { classRoom: true, subject: true, _count: { select: { submissions: true } } },
      orderBy: { dueAt: "asc" },
      take: 100
    });

    return tasks.map((task) => this.mapAssignmentTask(task));
  }

  async createAssignment(session: SessionPayload, payload: unknown): Promise<TeacherAssignmentTaskView> {
    this.assertTeacherSession(session);
    const parsed = teacherAssignmentSchema.parse(payload);

    if (parsed.dueAt.getTime() < Date.now() - 86400000) {
      throw new BadRequestException("Assignment due date cannot be in the past.");
    }

    const assignment = await this.assertAssignedClassSubject(session, parsed.classId, parsed.subjectId);
    const task = await prisma.assignment.create({
      data: {
        schoolId: session.schoolId,
        classId: parsed.classId,
        subjectId: parsed.subjectId,
        teacherId: session.userId,
        title: parsed.title,
        description: parsed.description,
        dueAt: parsed.dueAt,
        attachmentUrl: parsed.attachmentUrl || undefined,
        status: parsed.status
      },
      include: { classRoom: true, subject: true, _count: { select: { submissions: true } } }
    });

    return this.mapAssignmentTask({
      ...task,
      classRoom: assignment.classRoom,
      subject: assignment.subject
    });
  }

  async listTeacherAnnouncements(session: SessionPayload): Promise<AnnouncementView[]> {
    this.assertTeacherSession(session);

    const announcements = await prisma.announcement.findMany({
      where: { schoolId: session.schoolId },
      orderBy: { publishedAt: "desc" },
      take: 50
    }).catch((error: unknown) => {
      if (isSchemaDriftError(error)) return [];
      throw error;
    });

    return announcements.filter((item) => isTeacherAudience(item.audience)).map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      audience: item.audience,
      channel: item.channel,
      publishedAt: item.publishedAt.toISOString()
    }));
  }

  async listTeacherNotifications(session: SessionPayload): Promise<StudentPortalNotificationView[]> {
    this.assertTeacherSession(session);

    const notifications = await prisma.notificationLog.findMany({
      where: {
        schoolId: session.schoolId,
        OR: [{ userId: session.userId }, { userId: null }]
      },
      orderBy: { sentAt: "desc" },
      take: 50
    }).catch((error: unknown) => {
      if (isSchemaDriftError(error)) return [];
      throw error;
    });

    return notifications.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      channel: item.channel,
      status: item.status,
      sentAt: item.sentAt?.toISOString()
    }));
  }

  async getTeacherDashboard(session: SessionPayload): Promise<TeacherPortalView> {
    this.assertTeacherSession(session);
    const [assignments, timetable, attendanceWorkspace, scoreSheets, tasks, announcements, notifications, students] = await Promise.all([
      this.resolveDashboardSection("assignedClasses", this.listTeacherAssignments(session), [] as TeacherClassPortalView[]),
      this.resolveDashboardSection("weeklyTimetable", this.getTeacherTimetable(session), [] as PortalTimetableEntry[]),
      this.resolveDashboardSection(
        "attendanceWorkspace",
        this.getAttendanceWorkspace(session),
        {
          schoolName: "",
          currentSession: "",
          currentTerm: "",
          records: [],
        } as TeacherAttendanceWorkspaceView,
      ),
      this.resolveDashboardSection("scoreSheets", this.listScores(session), [] as TeacherScoreEntryView[]),
      this.resolveDashboardSection("assignmentTasks", this.listTeacherAssignmentTasks(session), [] as TeacherAssignmentTaskView[]),
      this.resolveDashboardSection("announcements", this.listTeacherAnnouncements(session), [] as AnnouncementView[]),
      this.resolveDashboardSection("notifications", this.listTeacherNotifications(session), [] as StudentPortalNotificationView[]),
      this.resolveDashboardSection("students", this.getAssignmentStudentList(session), [] as TeacherClassStudentView[]),
    ]);
    const attendanceHistory = attendanceWorkspace.records;
    const subjectCount = new Set(assignments.map((item) => item.subjectId).filter(Boolean)).size;
    const classCount = new Set(assignments.map((item) => item.classId)).size;
    const pendingScores = assignments.reduce((sum: number, item: TeacherClassPortalView) => sum + item.pendingScores, 0);
    const today = normalizeAttendanceDate(new Date());
    const [curriculumTopics, staffAttendanceToday, pendingTraining] = await Promise.all([
      this.resolveDashboardSection(
        "curriculumTopics",
        prisma.curriculumTopic.findMany({
          where: {
            schoolId: session.schoolId,
            OR: [
              { teacherId: session.userId },
              { classRoom: { classSubjects: { some: { teacherId: session.userId } } } }
            ]
          },
          select: { progressStatus: true }
        }),
        [] as Array<{ progressStatus: string }>,
      ),
      this.resolveDashboardSection(
        "staffAttendanceToday",
        prisma.staffAttendance.findUnique({
          where: { schoolId_userId_date: { schoolId: session.schoolId, userId: session.userId, date: today } },
          select: { checkInAt: true, status: true }
        }),
        null as { checkInAt: Date | null; status: string } | null,
      ),
      this.resolveDashboardSection(
        "pendingTraining",
        prisma.trainingParticipant.count({
          where: { schoolId: session.schoolId, userId: session.userId, status: { not: "COMPLETED" }, trainingProgram: { mandatory: true, archivedAt: null } }
        }).catch((error: unknown) => {
          if (isSchemaDriftError(error)) return 0;
          throw error;
        }),
        0,
      ),
    ]);
    const curriculumComplete = curriculumTopics.filter((item: { progressStatus: string }) => item.progressStatus === "COMPLETED" || item.progressStatus === "TAUGHT").length;
    const curriculumCoverage = curriculumTopics.length === 0 ? 0 : Number(((curriculumComplete / curriculumTopics.length) * 100).toFixed(1));

    return {
      teacherId: session.userId,
      teacherName: session.name,
      headline: "Manage your classes, attendance, assignments, and assessment workload",
      stats: [
        { label: "Assigned classes", value: String(classCount) },
        { label: "Assigned subjects", value: String(subjectCount) },
        { label: "Pending scores", value: String(pendingScores) },
        { label: "Scheme coverage", value: `${curriculumCoverage}%` },
        { label: "Clock status", value: staffAttendanceToday?.checkInAt ? staffAttendanceToday.status : "Not clocked in" },
        { label: "Pending training", value: String(pendingTraining) }
      ],
      weeklyTimetable: timetable,
      assignedClasses: assignments,
      students,
      attendanceHistory,
      scoreSheets,
      assignments: tasks,
      announcements: announcements.map((item) => ({
        id: item.id,
        title: item.title,
        detail: item.body,
        time: item.publishedAt
      })),
      notifications,
      recentActivity: [
        ...attendanceHistory.slice(0, 3).map((item: TeacherAttendanceEntryView) => ({
          id: item.id,
          title: `${item.status} attendance recorded`,
          detail: `${item.studentName} in ${item.className}${item.subject ? ` (${item.subject})` : ""}.`,
          time: item.date
        })),
        ...scoreSheets.slice(0, 3).map((item: TeacherScoreEntryView) => ({
          id: item.id,
          title: `${item.subject} score entry`,
          detail: `${item.studentName} scored ${item.total} (${item.grade}).`,
          time: item.recordedAt ?? new Date().toISOString()
        }))
      ].slice(0, 6)
    };
  }
}
