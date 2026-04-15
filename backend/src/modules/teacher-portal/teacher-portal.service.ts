import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { getDemoTeacherPortalByEmail } from "../../../../src/lib/demo/data";
import { calculateSubjectTotals, resolveGradeLabel } from "../../../../src/lib/domain/grading";
import { canTeacherManageAssignedSubject } from "../../../../src/lib/domain/teacher-portal";
import {
  AnnouncementView,
  PortalTimetableEntry,
  StudentPortalNotificationView,
  TeacherAssignmentTaskView,
  TeacherAttendanceEntryView,
  TeacherClassPortalView,
  TeacherClassStudentView,
  TeacherPortalView,
  TeacherScoreEntryView
} from "../../../../src/lib/domain/types";
import { formatNigeriaClassName } from "../../../../src/lib/school-options";
import { env } from "../../../../src/lib/utils/env";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const teacherAttendanceSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  studentId: z.string().min(1),
  date: z.coerce.date().default(() => new Date()),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
  reason: z.string().max(500).optional()
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

@Injectable()
export class TeacherPortalService {
  private assertTeacherSession(session: SessionPayload) {
    if (session.role !== "TEACHER") {
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
    const assignments = await this.getTeacherAssignments(session);
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
    student: { firstName: string; middleName?: string | null; lastName: string };
    classRoom: { name: string; arm?: string | null };
    subject?: { name: string } | null;
  }): TeacherAttendanceEntryView {
    return {
      id: record.id,
      studentId: record.studentId,
      studentName: formatStudentName(record.student),
      classId: record.classId,
      className: formatClassName(record.classRoom),
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
    if (env.DEMO_MODE) {
      return getDemoTeacherPortalByEmail(session.email).assignedClasses;
    }

    const [assignments, term] = await Promise.all([this.getTeacherAssignments(session), this.currentTerm(session.schoolId)]);
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

    return assignments.map((assignment) => {
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
  }

  async getTeacherTimetable(session: SessionPayload): Promise<PortalTimetableEntry[]> {
    this.assertTeacherSession(session);
    if (env.DEMO_MODE) {
      return getDemoTeacherPortalByEmail(session.email).weeklyTimetable;
    }

    const timetable = await prisma.timetableEntry.findMany({
      where: { schoolId: session.schoolId, teacherId: session.userId },
      include: { classRoom: true, subject: true },
      orderBy: [{ dayOfWeek: "asc" }, { startsAt: "asc" }]
    });

    return timetable.map((item) => ({
      id: item.id,
      day: dayNames[item.dayOfWeek] ?? `Day ${item.dayOfWeek}`,
      time: `${item.startsAt} - ${item.endsAt}`,
      subject: item.subject.name,
      venue: item.venue ?? "Classroom",
      className: formatClassName(item.classRoom),
      teacherName: session.name
    }));
  }

  async listAttendance(session: SessionPayload): Promise<TeacherAttendanceEntryView[]> {
    this.assertTeacherSession(session);
    if (env.DEMO_MODE) {
      const portal = getDemoTeacherPortalByEmail(session.email);
      return portal.assignedClasses.slice(0, 3).map((assignment, index) => ({
        id: `demo-att-${index + 1}`,
        studentId: `demo-student-${index + 1}`,
        studentName: ["Daniel Yusuf", "Amarachi Obi", "Ibrahim Salisu"][index] ?? "Demo Student",
        classId: assignment.classId ?? `demo-class-${index + 1}`,
        className: assignment.className,
        subjectId: assignment.subjectId ?? `demo-subject-${index + 1}`,
        subject: assignment.subject,
        status: index === 2 ? "ABSENT" : "PRESENT",
        date: new Date().toISOString(),
        reason: index === 2 ? "Parent reported illness" : undefined
      }));
    }

    const assignments = await this.getTeacherAssignments(session);
    const assignedPairs = new Set(assignments.map((item) => `${item.classId}:${item.subjectId}`));
    const records = await prisma.studentAttendance.findMany({
      where: {
        schoolId: session.schoolId,
        markedById: session.userId,
        classId: { in: assignments.map((item) => item.classId) }
      },
      include: { student: true, classRoom: true },
      orderBy: { date: "desc" },
      take: 100
    });
    const subjects = await prisma.subject.findMany({
      where: { schoolId: session.schoolId, id: { in: records.flatMap((item) => (item.subjectId ? [item.subjectId] : [])) } }
    });
    const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));

    return records
      .filter((record) => !record.subjectId || assignedPairs.has(`${record.classId}:${record.subjectId}`))
      .map((record) => this.mapAttendanceRecord({ ...record, subject: record.subjectId ? subjectsById.get(record.subjectId) : null }));
  }

  async markAttendance(session: SessionPayload, payload: unknown): Promise<TeacherAttendanceEntryView> {
    this.assertTeacherSession(session);
    const parsed = teacherAttendanceSchema.parse(payload);

    if (env.DEMO_MODE) {
      const portal = getDemoTeacherPortalByEmail(session.email);
      const assignment = portal.assignedClasses.find((item) => item.classId === parsed.classId || item.subjectId === parsed.subjectId);
      return {
        id: randomUUID(),
        studentId: parsed.studentId,
        studentName: "Demo learner",
        classId: parsed.classId,
        className: assignment?.className ?? "Demo class",
        subjectId: parsed.subjectId,
        subject: assignment?.subject ?? "Demo subject",
        status: parsed.status,
        date: normalizeAttendanceDate(parsed.date).toISOString(),
        reason: parsed.reason
      };
    }

    const [assignment, term, student] = await Promise.all([
      this.assertAssignedClassSubject(session, parsed.classId, parsed.subjectId),
      this.currentTerm(session.schoolId),
      prisma.student.findFirst({ where: { id: parsed.studentId, schoolId: session.schoolId, currentClassId: parsed.classId } })
    ]);

    if (!student) {
      throw new BadRequestException("Selected student is not enrolled in the selected class.");
    }

    const record = await prisma.studentAttendance.upsert({
      where: {
        studentId_termId_date_subjectId: {
          studentId: parsed.studentId,
          termId: term.id,
          date: normalizeAttendanceDate(parsed.date),
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
        date: normalizeAttendanceDate(parsed.date),
        status: parsed.status,
        reason: parsed.reason
      },
      include: { student: true, classRoom: true }
    });

    return this.mapAttendanceRecord({ ...record, subject: assignment.subject });
  }

  async listScores(session: SessionPayload): Promise<TeacherScoreEntryView[]> {
    this.assertTeacherSession(session);
    if (env.DEMO_MODE) {
      return getDemoTeacherPortalByEmail(session.email).assignedClasses.map((assignment, index) => {
        const ca = 28 + index;
        const exam = 44 + index;
        const total = ca + exam;
        return {
          id: `demo-score-${index + 1}`,
          studentId: `demo-student-${index + 1}`,
          studentName: ["Daniel Yusuf", "Amarachi Obi", "Ibrahim Salisu"][index] ?? "Demo Student",
          classId: assignment.classId ?? `demo-class-${index + 1}`,
          className: assignment.className,
          subjectId: assignment.subjectId ?? `demo-subject-${index + 1}`,
          subject: assignment.subject,
          continuousAssessment: ca,
          exam,
          total,
          grade: resolveGradeLabel(total).label,
          published: false,
          recordedAt: new Date().toISOString()
        };
      });
    }

    const assignments = await this.getTeacherAssignments(session);
    const assignedPairs = new Set(assignments.map((item) => `${item.classId}:${item.subjectId}`));
    const scores = await prisma.scoreEntry.findMany({
      where: { schoolId: session.schoolId, enteredById: session.userId },
      include: {
        student: true,
        subject: true,
        assessmentComponent: true,
        resultSheet: { include: { classRoom: true } }
      },
      orderBy: { recordedAt: "desc" },
      take: 200
    });

    const grouped = new Map<string, TeacherScoreEntryView>();
    for (const score of scores) {
      const pair = `${score.resultSheet.classId}:${score.subjectId}`;
      if (!assignedPairs.has(pair)) continue;
      const key = `${score.resultSheetId}:${score.subjectId}`;
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

    return Array.from(grouped.values());
  }

  async enterAssessmentScores(session: SessionPayload, payload: unknown): Promise<TeacherScoreEntryView> {
    this.assertTeacherSession(session);
    const parsed = teacherScoreSchema.parse(payload);
    const total = parsed.continuousAssessment + parsed.exam;
    const grade = resolveGradeLabel(total).label;

    if (env.DEMO_MODE) {
      const portal = getDemoTeacherPortalByEmail(session.email);
      const assignment = portal.assignedClasses.find((item) => item.classId === parsed.classId || item.subjectId === parsed.subjectId);
      return {
        id: randomUUID(),
        studentId: parsed.studentId,
        studentName: "Demo learner",
        classId: parsed.classId,
        className: assignment?.className ?? "Demo class",
        subjectId: parsed.subjectId,
        subject: assignment?.subject ?? "Demo subject",
        continuousAssessment: parsed.continuousAssessment,
        exam: parsed.exam,
        total,
        grade,
        published: false,
        recordedAt: new Date().toISOString(),
        teacherComment: parsed.teacherComment
      };
    }

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
    if (env.DEMO_MODE) {
      return getDemoTeacherPortalByEmail(session.email).assignedClasses.map((assignment, index) => ({
        id: `demo-task-${index + 1}`,
        classId: assignment.classId ?? `demo-class-${index + 1}`,
        className: assignment.className,
        subjectId: assignment.subjectId ?? `demo-subject-${index + 1}`,
        subject: assignment.subject,
        title: `${assignment.subject} weekly practice`,
        description: assignment.nextAction,
        dueAt: new Date(Date.now() + (index + 1) * 86400000).toISOString(),
        status: "PUBLISHED",
        submissionsCount: Math.max(assignment.learners - assignment.pendingScores, 0)
      }));
    }

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

    if (env.DEMO_MODE) {
      const portal = getDemoTeacherPortalByEmail(session.email);
      const assignment = portal.assignedClasses.find((item) => item.classId === parsed.classId || item.subjectId === parsed.subjectId);
      return {
        id: randomUUID(),
        classId: parsed.classId,
        className: assignment?.className ?? "Demo class",
        subjectId: parsed.subjectId,
        subject: assignment?.subject ?? "Demo subject",
        title: parsed.title,
        description: parsed.description,
        dueAt: parsed.dueAt.toISOString(),
        status: parsed.status,
        attachmentUrl: parsed.attachmentUrl || undefined,
        submissionsCount: 0
      };
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
    if (env.DEMO_MODE) {
      return getDemoTeacherPortalByEmail(session.email).recentActivity.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.detail,
        audience: "Teachers",
        channel: "IN_APP",
        publishedAt: new Date().toISOString()
      }));
    }

    const announcements = await prisma.announcement.findMany({
      where: { schoolId: session.schoolId },
      orderBy: { publishedAt: "desc" },
      take: 50
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
    if (env.DEMO_MODE) {
      return getDemoTeacherPortalByEmail(session.email).recentActivity.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.detail,
        channel: "IN_APP",
        status: "SENT",
        sentAt: new Date().toISOString()
      }));
    }

    const notifications = await prisma.notificationLog.findMany({
      where: {
        schoolId: session.schoolId,
        OR: [{ userId: session.userId }, { userId: null }]
      },
      orderBy: { sentAt: "desc" },
      take: 50
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
    if (env.DEMO_MODE) {
      const portal = getDemoTeacherPortalByEmail(session.email);
      return {
        ...portal,
        students: portal.assignedClasses.map((assignment, index) => ({
          studentId: `demo-student-${index + 1}`,
          admissionNumber: `DEMO/2026/${String(index + 1).padStart(4, "0")}`,
          studentName: ["Daniel Yusuf", "Amarachi Obi", "Ibrahim Salisu"][index] ?? "Demo Student",
          classId: assignment.classId ?? `demo-class-${index + 1}`,
          className: assignment.className
        })),
        attendanceHistory: await this.listAttendance(session),
        scoreSheets: await this.listScores(session),
        assignments: await this.listTeacherAssignmentTasks(session),
        announcements: portal.recentActivity.map((item) => ({ id: item.id, title: item.title, detail: item.detail, time: item.time })),
        notifications: await this.listTeacherNotifications(session)
      };
    }

    const [assignments, timetable, attendanceHistory, scoreSheets, tasks, announcements, notifications, students] = await Promise.all([
      this.listTeacherAssignments(session),
      this.getTeacherTimetable(session),
      this.listAttendance(session),
      this.listScores(session),
      this.listTeacherAssignmentTasks(session),
      this.listTeacherAnnouncements(session),
      this.listTeacherNotifications(session),
      this.getAssignmentStudentList(session)
    ]);
    const subjectCount = new Set(assignments.map((item) => item.subjectId)).size;
    const classCount = new Set(assignments.map((item) => item.classId)).size;
    const pendingScores = assignments.reduce((sum, item) => sum + item.pendingScores, 0);
    const today = normalizeAttendanceDate(new Date());
    const [curriculumTopics, staffAttendanceToday, pendingTraining] = await Promise.all([
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
      prisma.staffAttendance.findUnique({
        where: { schoolId_userId_date: { schoolId: session.schoolId, userId: session.userId, date: today } },
        select: { checkInAt: true, status: true }
      }),
      prisma.trainingParticipant.count({
        where: { schoolId: session.schoolId, userId: session.userId, status: { not: "COMPLETED" }, trainingProgram: { mandatory: true, archivedAt: null } }
      }).catch((error: unknown) => {
        if (isSchemaDriftError(error)) return 0;
        throw error;
      })
    ]);
    const curriculumComplete = curriculumTopics.filter((item) => item.progressStatus === "COMPLETED" || item.progressStatus === "TAUGHT").length;
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
        ...attendanceHistory.slice(0, 3).map((item) => ({
          id: item.id,
          title: `${item.status} attendance recorded`,
          detail: `${item.studentName} in ${item.className}${item.subject ? ` (${item.subject})` : ""}.`,
          time: item.date
        })),
        ...scoreSheets.slice(0, 3).map((item) => ({
          id: item.id,
          title: `${item.subject} score entry`,
          detail: `${item.studentName} scored ${item.total} (${item.grade}).`,
          time: item.recordedAt ?? new Date().toISOString()
        }))
      ].slice(0, 6)
    };
  }
}
