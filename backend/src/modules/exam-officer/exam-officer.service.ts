import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import {
  ExamOfficerDashboardView,
  ExamOfficerExamView,
  ExamOfficerPublicationView,
  ExamOfficerQuestionBankView,
  ExamOfficerScoreStatusView,
  ExamOfficerTimetableEntryView,
} from "../../../../src/lib/domain/types";
import { prisma } from "../../../../src/lib/db/prisma";
import { formatNigeriaClassName } from "../../../../src/lib/school-options";

const examOfficerRoles = new Set(["EXAM_OFFICER", "EXAMINATION_OFFICER"]);

const examTimetableEntrySchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  termId: z.string().optional(),
  examDate: z.coerce.date(),
  startsAt: z.string().regex(/^\d{2}:\d{2}$/),
  endsAt: z.string().regex(/^\d{2}:\d{2}$/),
  venue: z.string().max(120).optional(),
  invigilatorIds: z.array(z.string().min(1)).optional().default([]),
});

function assertExamOfficer(session: SessionPayload) {
  if (!examOfficerRoles.has(session.role)) {
    throw new ForbiddenException("Only exam officers can access this module.");
  }
}

function timeOverlaps(startA: string, endA: string, startB: string, endB: string) {
  return startA < endB && endA > startB;
}

function sameDay(left: Date, right: Date) {
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

function classLabel(classRoom?: { name: string; arm?: string | null } | null) {
  if (!classRoom) return "Unassigned";
  return formatNigeriaClassName(
    classRoom.arm ? `${classRoom.name} - ${classRoom.arm}` : classRoom.name,
  );
}

function safePreview(value: string) {
  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
}

function userDisplayName(
  user?:
    | {
        firstName: string;
        middleName?: string | null;
        lastName: string;
      }
    | null,
) {
  if (!user) return undefined;
  return [user.firstName, user.middleName, user.lastName]
    .filter(Boolean)
    .join(" ");
}

function statusFromProgress(entered: number, total: number): ExamOfficerScoreStatusView["status"] {
  if (total === 0 || entered === 0) return "NOT_STARTED";
  if (entered >= total) return "COMPLETE";
  return "IN_PROGRESS";
}

@Injectable()
export class ExamOfficerService {
  private async audit(
    session: SessionPayload,
    action: AuditAction,
    entityType: string,
    entityId: string,
    options?: {
      oldValue?: Record<string, unknown>;
      newValue?: Record<string, unknown>;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    await prisma.auditLog.create({
      data: {
        schoolId: session.schoolId,
        actorId: session.userId,
        action,
        entityType,
        entityId,
        oldValue: options?.oldValue as Prisma.InputJsonValue | undefined,
        newValue: options?.newValue as Prisma.InputJsonValue | undefined,
        metadata: options?.metadata,
      },
    });
  }

  private async currentAcademicContext(schoolId: string) {
    const currentTerm = await prisma.term.findFirst({
      where: { schoolId, isCurrent: true },
      include: { academicSession: true },
      orderBy: { order: "asc" },
    });

    return {
      currentTerm,
      currentSession: currentTerm?.academicSession ?? null,
    };
  }

  private async loadExamAssessments(schoolId: string) {
    return prisma.academicAssessment.findMany({
      where: {
        schoolId,
        assessmentType: "EXAMINATION",
      },
      include: {
        term: { include: { academicSession: true } },
        classRoom: true,
        subject: true,
        teacher: true,
        candidates: true,
      },
      orderBy: [{ assessmentDate: "desc" }, { createdAt: "desc" }],
      take: 300,
    });
  }

  private mapExamAssessment(
    assessment: Awaited<ReturnType<ExamOfficerService["loadExamAssessments"]>>[number],
  ): ExamOfficerExamView {
    const enteredCount = assessment.candidates.filter(
      (candidate) =>
        candidate.score !== null ||
        candidate.attendanceState === "ABSENT" ||
        candidate.attendanceState === "EXCUSED",
    ).length;
    const candidateCount = assessment.candidates.length;

    return {
      id: assessment.id,
      title: assessment.title,
      subject: assessment.subject.name,
      className: classLabel(assessment.classRoom),
      session: assessment.term.academicSession?.name,
      term: assessment.term.name,
      assessmentDate: assessment.assessmentDate.toISOString(),
      status: assessment.status,
      submissionMode: assessment.submissionMode,
      candidateCount,
      enteredCount,
      completionRate:
        candidateCount > 0
          ? Math.round((enteredCount / candidateCount) * 100)
          : 0,
      teacherName: userDisplayName(assessment.teacher),
    };
  }

  private mapScoreStatus(exam: ExamOfficerExamView): ExamOfficerScoreStatusView {
    return {
      assessmentId: exam.id,
      examTitle: exam.title,
      subject: exam.subject,
      className: exam.className,
      session: exam.session,
      term: exam.term,
      entered: exam.enteredCount,
      total: exam.candidateCount,
      completionRate: exam.completionRate,
      status: statusFromProgress(exam.enteredCount, exam.candidateCount),
      assessmentDate: exam.assessmentDate,
    };
  }

  private async loadTimetableEntries(schoolId: string) {
    const entries = await prisma.examTimetableEntry.findMany({
      where: { schoolId },
      include: {
        term: { include: { academicSession: true } },
        classRoom: true,
        subject: true,
        InvigilationAssignment: {
          include: {
            staff: {
              include: {
                user: true,
              },
            },
          },
        },
      },
      orderBy: [{ examDate: "asc" }, { startsAt: "asc" }],
      take: 400,
    });

    const classIds = Array.from(new Set(entries.map((entry) => entry.classId)));
    const studentCounts = classIds.length
      ? await prisma.student.groupBy({
          by: ["currentClassId"],
          where: {
            schoolId,
            status: "ACTIVE",
            currentClassId: { in: classIds },
          },
          _count: { currentClassId: true },
        })
      : [];
    const countMap = new Map(
      studentCounts.map((item) => [item.currentClassId ?? "", item._count.currentClassId]),
    );

    return entries.map<ExamOfficerTimetableEntryView>((entry) => ({
      id: entry.id,
      classId: entry.classId,
      className: classLabel(entry.classRoom),
      subjectId: entry.subjectId,
      subject: entry.subject.name,
      session: entry.term?.academicSession?.name,
      term: entry.term?.name,
      examDate: entry.examDate.toISOString(),
      startsAt: entry.startsAt,
      endsAt: entry.endsAt,
      venue: entry.venue ?? undefined,
      candidateCount: countMap.get(entry.classId) ?? 0,
      invigilators: entry.InvigilationAssignment.map((assignment) => ({
        id: assignment.id,
        staffId: assignment.staffId,
        staffName:
          userDisplayName(assignment.staff.user) ??
          assignment.staff.employeeNo ??
          "Assigned staff",
        hall: assignment.hall,
        status: assignment.status,
      })),
    }));
  }

  private commentsReadyCount(data: Prisma.JsonValue | null | undefined) {
    const rows =
      data && typeof data === "object" && !Array.isArray(data) && Array.isArray((data as { rows?: unknown }).rows)
        ? ((data as { rows: Array<Record<string, unknown>> }).rows ?? [])
        : [];

    return rows.filter(
      (row) =>
        Boolean(row.classTeacherRemark) ||
        Boolean(row.principalRemark),
    ).length;
  }

  async getDashboard(session: SessionPayload): Promise<ExamOfficerDashboardView> {
    assertExamOfficer(session);
    const schoolId = session.schoolId;
    const [{ currentSession, currentTerm }, examAssessments, broadsheets, timetable, recentActivity] =
      await Promise.all([
        this.currentAcademicContext(schoolId),
        this.loadExamAssessments(schoolId),
        prisma.broadsheet.findMany({
          where: { schoolId },
          orderBy: { updatedAt: "desc" },
          take: 120,
        }),
        this.loadTimetableEntries(schoolId),
        prisma.auditLog.findMany({
          where: {
            schoolId,
            entityType: {
              in: [
                "AcademicAssessment",
                "Broadsheet",
                "ReportCard",
                "ExamTimetableEntry",
                "InvigilationAssignment",
                "QuestionBankItem",
              ],
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
      ]);

    const exams = examAssessments.map((item) => this.mapExamAssessment(item));
    const scoreEntryStatus = exams.map((item) => this.mapScoreStatus(item));
    const totalScoresExpected = exams.reduce(
      (sum, item) => sum + item.candidateCount,
      0,
    );
    const totalScoresEntered = exams.reduce(
      (sum, item) => sum + item.enteredCount,
      0,
    );

    const now = new Date();
    const inSevenDays = new Date(now);
    inSevenDays.setDate(now.getDate() + 7);
    const upcomingTimetable = timetable.filter((item) => {
      const date = new Date(item.examDate);
      return date >= now && date <= inSevenDays;
    });

    const currentTermBroadsheets = broadsheets.filter(
      (sheet) => !currentTerm || sheet.termId === currentTerm.id,
    );

    return {
      currentSession: currentSession?.name ?? undefined,
      currentTerm: currentTerm?.name ?? undefined,
      metrics: {
        activeExams: exams.filter((item) =>
          ["ACTIVE", "APPROVED", "PUBLISHED", "MARKED"].includes(item.status),
        ).length,
        totalScoresEntered,
        totalScoresExpected,
        publishedClasses: currentTermBroadsheets.filter(
          (sheet) => sheet.status === "PUBLISHED",
        ).length,
        totalPublicationTargets: currentTermBroadsheets.length,
        upcomingExams: upcomingTimetable.length,
      },
      scoreEntryStatus: scoreEntryStatus.slice(0, 10),
      upcomingTimetable: upcomingTimetable.slice(0, 10),
      recentActivity: recentActivity.map((item) => ({
        id: item.id,
        action: item.action,
        entityType: item.entityType,
        detail:
          typeof item.metadata === "object" && item.metadata && "note" in item.metadata
            ? String((item.metadata as Record<string, unknown>).note)
            : `${item.action} ${item.entityType}`,
        createdAt: item.createdAt.toISOString(),
      })),
      quickLinks: [
        { label: "Create New Exam", href: "/portals/exam-officer/exams" },
        { label: "Enter Scores", href: "/portals/exam-officer/score-entry-status" },
        { label: "View Broadsheets", href: "/academics/results/broadsheets" },
        { label: "Publish Results", href: "/portals/exam-officer/publication" },
        { label: "Question Bank", href: "/portals/exam-officer/question-bank" },
      ],
    };
  }

  async listExams(
    session: SessionPayload,
    query: Record<string, string | undefined> = {},
  ): Promise<ExamOfficerExamView[]> {
    assertExamOfficer(session);
    const exams = (await this.loadExamAssessments(session.schoolId))
      .map((item) => this.mapExamAssessment(item))
      .filter((item) =>
        query.status ? item.status === query.status : true,
      )
      .filter((item) => (query.term ? item.term === query.term : true))
      .filter((item) =>
        query.session ? item.session === query.session : true,
      );

    return exams;
  }

  async scoreEntryStatus(session: SessionPayload): Promise<ExamOfficerScoreStatusView[]> {
    assertExamOfficer(session);
    const exams = (await this.loadExamAssessments(session.schoolId)).map((item) =>
      this.mapExamAssessment(item),
    );
    return exams.map((item) => this.mapScoreStatus(item));
  }

  async listTimetable(session: SessionPayload): Promise<ExamOfficerTimetableEntryView[]> {
    assertExamOfficer(session);
    return this.loadTimetableEntries(session.schoolId);
  }

  async createTimetableEntry(session: SessionPayload, payload: unknown) {
    assertExamOfficer(session);
    const parsed = examTimetableEntrySchema.parse(payload);

    if (parsed.endsAt <= parsed.startsAt) {
      throw new BadRequestException("End time must be later than start time.");
    }

    const classRoom = await prisma.classRoom.findFirst({
      where: { id: parsed.classId, schoolId: session.schoolId },
      select: { id: true, name: true, arm: true },
    });
    if (!classRoom) {
      throw new NotFoundException("Class not found.");
    }

    const subject = await prisma.subject.findFirst({
      where: { id: parsed.subjectId, schoolId: session.schoolId },
      select: { id: true, name: true },
    });
    if (!subject) {
      throw new NotFoundException("Subject not found.");
    }

    const existingEntries = await prisma.examTimetableEntry.findMany({
      where: {
        schoolId: session.schoolId,
        classId: parsed.classId,
        examDate: {
          gte: new Date(parsed.examDate.toISOString().slice(0, 10)),
          lt: new Date(
            new Date(parsed.examDate.toISOString().slice(0, 10)).getTime() +
              24 * 60 * 60 * 1000,
          ),
        },
      },
      include: { classRoom: true, subject: true },
    });

    const classConflict = existingEntries.find((entry) =>
      timeOverlaps(parsed.startsAt, parsed.endsAt, entry.startsAt, entry.endsAt),
    );
    if (classConflict) {
      throw new BadRequestException(
        `Conflict detected: ${classLabel(classConflict.classRoom)} already has ${classConflict.subject.name} scheduled for ${classConflict.startsAt}-${classConflict.endsAt}.`,
      );
    }

    if (parsed.invigilatorIds.length > 0) {
      const invigilatorConflicts = await prisma.invigilationAssignment.findMany({
        where: {
          schoolId: session.schoolId,
          staffId: { in: parsed.invigilatorIds },
          startsAt: {
            lt: new Date(`${parsed.examDate.toISOString().slice(0, 10)}T${parsed.endsAt}:00.000Z`),
          },
          endsAt: {
            gt: new Date(`${parsed.examDate.toISOString().slice(0, 10)}T${parsed.startsAt}:00.000Z`),
          },
        },
        include: {
          staff: { include: { user: true } },
        },
      });

      if (invigilatorConflicts.length > 0) {
        const names = invigilatorConflicts
          .map((item) => userDisplayName(item.staff.user) ?? item.staff.employeeNo)
          .filter(Boolean)
          .join(", ");
        throw new BadRequestException(
          `Invigilator conflict detected for: ${names}.`,
        );
      }
    }

    const entry = await prisma.examTimetableEntry.create({
      data: {
        schoolId: session.schoolId,
        termId: parsed.termId,
        classId: parsed.classId,
        subjectId: parsed.subjectId,
        examDate: parsed.examDate,
        startsAt: parsed.startsAt,
        endsAt: parsed.endsAt,
        venue: parsed.venue,
      },
    });

    if (parsed.invigilatorIds.length > 0) {
      await prisma.invigilationAssignment.createMany({
        data: parsed.invigilatorIds.map((staffId) => ({
          schoolId: session.schoolId,
          examTimetableEntryId: entry.id,
          staffId,
          hall: parsed.venue ?? "Main Hall",
          startsAt: new Date(`${parsed.examDate.toISOString().slice(0, 10)}T${parsed.startsAt}:00.000Z`),
          endsAt: new Date(`${parsed.examDate.toISOString().slice(0, 10)}T${parsed.endsAt}:00.000Z`),
          status: "ASSIGNED",
        })),
        skipDuplicates: true,
      });
    }

    await this.audit(session, "CREATE", "ExamTimetableEntry", entry.id, {
      newValue: {
        classId: parsed.classId,
        subjectId: parsed.subjectId,
        examDate: parsed.examDate.toISOString(),
        startsAt: parsed.startsAt,
        endsAt: parsed.endsAt,
        venue: parsed.venue ?? null,
      },
    });

    return entry;
  }

  async updateTimetableEntry(
    session: SessionPayload,
    timetableId: string,
    payload: unknown,
  ) {
    assertExamOfficer(session);
    const parsed = examTimetableEntrySchema.parse(payload);
    const existing = await prisma.examTimetableEntry.findFirst({
      where: { id: timetableId, schoolId: session.schoolId },
    });
    if (!existing) throw new NotFoundException("Timetable entry not found.");

    const updated = await prisma.examTimetableEntry.update({
      where: { id: timetableId },
      data: {
        classId: parsed.classId,
        subjectId: parsed.subjectId,
        termId: parsed.termId,
        examDate: parsed.examDate,
        startsAt: parsed.startsAt,
        endsAt: parsed.endsAt,
        venue: parsed.venue,
      },
    });

    await prisma.invigilationAssignment.deleteMany({
      where: { examTimetableEntryId: timetableId, schoolId: session.schoolId },
    });
    if (parsed.invigilatorIds.length > 0) {
      await prisma.invigilationAssignment.createMany({
        data: parsed.invigilatorIds.map((staffId) => ({
          schoolId: session.schoolId,
          examTimetableEntryId: timetableId,
          staffId,
          hall: parsed.venue ?? "Main Hall",
          startsAt: new Date(`${parsed.examDate.toISOString().slice(0, 10)}T${parsed.startsAt}:00.000Z`),
          endsAt: new Date(`${parsed.examDate.toISOString().slice(0, 10)}T${parsed.endsAt}:00.000Z`),
          status: "ASSIGNED",
        })),
      });
    }

    await this.audit(session, "UPDATE", "ExamTimetableEntry", timetableId, {
      oldValue: {
        classId: existing.classId,
        subjectId: existing.subjectId,
        examDate: existing.examDate.toISOString(),
        startsAt: existing.startsAt,
        endsAt: existing.endsAt,
        venue: existing.venue,
      },
      newValue: {
        classId: updated.classId,
        subjectId: updated.subjectId,
        examDate: updated.examDate.toISOString(),
        startsAt: updated.startsAt,
        endsAt: updated.endsAt,
        venue: updated.venue,
      },
    });

    return updated;
  }

  async deleteTimetableEntry(session: SessionPayload, timetableId: string) {
    assertExamOfficer(session);
    const existing = await prisma.examTimetableEntry.findFirst({
      where: { id: timetableId, schoolId: session.schoolId },
    });
    if (!existing) throw new NotFoundException("Timetable entry not found.");

    await prisma.invigilationAssignment.deleteMany({
      where: { schoolId: session.schoolId, examTimetableEntryId: timetableId },
    });
    await prisma.examTimetableEntry.delete({ where: { id: timetableId } });

    await this.audit(session, "DELETE", "ExamTimetableEntry", timetableId, {
      oldValue: {
        classId: existing.classId,
        subjectId: existing.subjectId,
        examDate: existing.examDate.toISOString(),
        startsAt: existing.startsAt,
        endsAt: existing.endsAt,
      },
    });

    return { id: timetableId, deleted: true };
  }

  async listPublicationStatus(
    session: SessionPayload,
  ): Promise<ExamOfficerPublicationView[]> {
    assertExamOfficer(session);
    const broadsheets = await prisma.broadsheet.findMany({
      where: { schoolId: session.schoolId },
      include: {
        classRoom: true,
        term: { include: { academicSession: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 160,
    });

    return broadsheets.map((item) => {
      const metrics =
        item.data && typeof item.data === "object" && !Array.isArray(item.data)
          ? ((item.data as Record<string, unknown>).metrics as Record<string, unknown> | undefined)
          : undefined;

      return {
        broadsheetId: item.id,
        classId: item.classId,
        className: classLabel(item.classRoom),
        session: item.term.academicSession?.name,
        term: item.term.name,
        status: item.status,
        approvalStage: item.approvalStage,
        publishedAt: item.publishedAt?.toISOString(),
        lockedAt: item.lockedAt?.toISOString(),
        missingWarnings: Array.isArray(item.missingScoreWarnings)
          ? item.missingScoreWarnings.length
          : 0,
        studentCount:
          typeof metrics?.studentCount === "number" ? metrics.studentCount : 0,
        completeStudents:
          typeof metrics?.completeStudents === "number"
            ? metrics.completeStudents
            : 0,
        commentsReady: this.commentsReadyCount(item.data),
      };
    });
  }

  async listQuestionBank(
    session: SessionPayload,
  ): Promise<ExamOfficerQuestionBankView[]> {
    assertExamOfficer(session);
    const items = await prisma.questionBankItem.findMany({
      where: { schoolId: session.schoolId, deletedAt: null },
      include: {
        classRoom: true,
        subject: true,
        teacher: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return items.map((item) => ({
      id: item.id,
      subject: item.subject.name,
      className: item.classRoom ? classLabel(item.classRoom) : undefined,
      assessmentType: item.assessmentType,
      difficulty: item.difficulty,
      status: item.status,
      questionPreview: safePreview(item.question),
      createdAt: item.createdAt.toISOString(),
      teacherName: userDisplayName(item.teacher),
    }));
  }
}
