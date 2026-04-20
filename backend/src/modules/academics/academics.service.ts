import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { z } from "zod";
import { AuditAction, UserRole } from "@prisma/client";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { getDemoStore } from "../../../../src/lib/demo/data";
import {
  canAdvanceAcademicApproval,
  canTransitionResult,
  calculateSubjectTotals,
  getNextAcademicApprovalStage,
  nigerianTermGradeBands,
  resolveGradeLabel,
  ResultWorkflowStatus,
  validateSectionAssessmentWeights,
  waecGradeBands
} from "../../../../src/lib/domain/grading";
import {
  AcademicAssessmentView,
  AssessmentCandidateView,
  AssessmentComponentView,
  BroadsheetView,
  GradeRecordView,
  GradingSchemeView,
  ReportCardView,
  ResultAnalyticsView,
  ResultApprovalView,
  SectionAssessmentComponentView,
  SubjectView
} from "../../../../src/lib/domain/types";
import { formatNigeriaClassName, normalizeNigeriaClassValue } from "../../../../src/lib/school-options";
import { env } from "../../../../src/lib/utils/env";

const nigeriaClassInputSchema = z
  .string()
  .min(2)
  .refine((value) => Boolean(normalizeNigeriaClassValue(value)), "Select a valid Nigerian class.");

export const gradeSchema = z.object({
  studentId: z.string().optional(),
  studentName: z.string().min(2).optional(),
  classId: z.string().optional(),
  className: nigeriaClassInputSchema.optional(),
  subjectId: z.string().optional(),
  subject: z.string().min(2).optional(),
  continuousAssessment: z.coerce.number().min(0).max(40),
  exam: z.coerce.number().min(0).max(60),
  teacherComment: z.string().max(1000).optional(),
  principalComment: z.string().max(1000).optional()
});

const gradingSchemeSchema = z.object({
  name: z.string().min(3).max(120),
  description: z.string().max(500).optional(),
  isActive: z.coerce.boolean().default(true),
  rankingEnabled: z.coerce.boolean().default(true),
  passMark: z.coerce.number().min(0).max(100).default(40),
  bandsJson: z.string().optional()
});

const assessmentComponentSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20),
  weight: z.coerce.number().min(1).max(100),
  maxScore: z.coerce.number().min(1).max(100),
  order: z.coerce.number().int().min(1).default(1),
  termId: z.string().optional(),
  isActive: z.coerce.boolean().default(true)
});

const resultActionSchema = z.object({
  resultSheetId: z.string().min(1),
  note: z.string().max(1000).optional(),
  principalComment: z.string().max(1000).optional()
});

const publishResultsSchema = z.object({
  termId: z.string().optional(),
  classId: z.string().optional(),
  note: z.string().max(1000).optional()
});

const compileResultsSchema = z.object({
  termId: z.string().optional(),
  classId: z.string().optional()
});

const schoolSectionSchema = z.enum(["CRECHE", "NURSERY", "PRIMARY", "JUNIOR_SECONDARY", "SENIOR_SECONDARY"]);
const assessmentTypeSchema = z.enum(["ASSIGNMENT", "CLASSWORK", "QUIZ", "TEST", "MID_TERM_TEST", "PRACTICAL", "PROJECT", "EXAMINATION"]);
const assessmentStatusSchema = z.enum(["DRAFT", "ACTIVE", "CLOSED", "MARKED", "APPROVED", "PUBLISHED"]);
const submissionModeSchema = z.enum(["PAPER", "CBT", "PRACTICAL", "ORAL"]);
const attendanceStateSchema = z.enum(["PRESENT", "ABSENT", "EXCUSED", "MALPRACTICE_PENDING_REVIEW"]);
const scoreFlagSchema = z.enum(["NONE", "ABSENT", "INCOMPLETE", "WITHHELD", "MALPRACTICE"]);
const approvalActionSchema = z.enum(["SUBMIT", "APPROVE", "REJECT", "REQUEST_CORRECTION", "COMPILE", "PUBLISH", "UNLOCK"]);

const sectionAssessmentComponentSchema = z.object({
  section: schoolSectionSchema,
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(30),
  type: assessmentTypeSchema,
  weight: z.coerce.number().min(0).max(100),
  maxScore: z.coerce.number().min(1).max(100),
  order: z.coerce.number().int().min(1).default(1),
  termId: z.string().optional(),
  academicSessionId: z.string().optional(),
  isActive: z.coerce.boolean().default(true)
});

const academicAssessmentSchema = z.object({
  title: z.string().min(3).max(160),
  termId: z.string().optional(),
  academicSessionId: z.string().optional(),
  classId: z.string().optional(),
  className: nigeriaClassInputSchema.optional(),
  arm: z.string().max(30).optional(),
  subjectId: z.string().optional(),
  subject: z.string().min(2).max(120).optional(),
  teacherId: z.string().optional(),
  assessmentType: assessmentTypeSchema,
  maxScore: z.coerce.number().min(1).max(100),
  weight: z.coerce.number().min(0).max(100),
  assessmentDate: z.coerce.date(),
  submissionMode: submissionModeSchema,
  status: assessmentStatusSchema.default("DRAFT")
});

const subjectSchema = z.object({
  name: z.string().min(2).max(140),
  code: z.string().min(2).max(40),
  waecCode: z.string().max(10).optional().or(z.literal("")),
  necoCode: z.string().max(10).optional().or(z.literal("")),
  departmentId: z.string().optional().nullable(),
  description: z.string().max(1000).optional().or(z.literal("")),
  section: schoolSectionSchema.optional(),
  applicableClassLevelsJson: z.string().optional(),
  classLevels: z.array(z.string()).optional(),
  isWaecSubject: z.coerce.boolean().default(false),
  isCore: z.coerce.boolean().default(false),
  isOptional: z.coerce.boolean().default(false),
  religionSpecific: z.coerce.boolean().default(false),
  subjectCombination: z.string().max(30).optional().or(z.literal("")),
  periodsPerWeek: z.coerce.number().int().min(1).max(30).default(3),
  requiresLab: z.coerce.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).default(0),
  trackSpecific: z.string().max(60).optional(),
  tradeSubject: z.coerce.boolean().default(false),
  status: z.string().max(40).default("ACTIVE")
});

const subjectUpdateSchema = subjectSchema.partial();

const assignSubjectTeacherSchema = z.object({
  classId: z.string().optional(),
  class_id: z.string().optional(),
  teacherId: z.string().optional().nullable(),
  teacher_id: z.string().optional().nullable(),
  applyToAllArms: z.coerce.boolean().default(false),
  apply_to_all_arms: z.coerce.boolean().optional(),
  reason: z.string().max(500).optional().nullable()
});

const assessmentScoresSchema = z.object({
  assessmentId: z.string().min(1),
  scores: z.array(
    z.object({
      studentId: z.string().min(1),
      score: z.coerce.number().min(0).optional(),
      attendanceState: attendanceStateSchema.default("PRESENT"),
      scoreFlag: scoreFlagSchema.default("NONE"),
      comment: z.string().max(1000).optional()
    })
  ).min(1)
});

const broadsheetCompileSchema = z.object({
  termId: z.string().optional(),
  classId: z.string().min(1),
  rankingEnabled: z.coerce.boolean().default(true)
});

const broadsheetActionSchema = z.object({
  broadsheetId: z.string().min(1),
  action: approvalActionSchema,
  note: z.string().max(1000).optional()
});

function toSubjectCode(name: string) {
  return name
    .split(" ")
    .map((segment) => segment.slice(0, 3).toUpperCase())
    .join("");
}

function formatClassName(classRoom?: { name: string; arm?: string | null } | null) {
  if (!classRoom) return "Unassigned";
  return formatNigeriaClassName(classRoom.arm ? `${classRoom.name} - ${classRoom.arm}` : classRoom.name);
}

function formatStudentName(student: { firstName: string; middleName?: string | null; lastName: string }) {
  return [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
}

function assertAcademicApprover(session: SessionPayload) {
  if (
    ![
      "SUPER_ADMIN",
      "SCHOOL_OWNER",
      "PROPRIETOR",
      "ADMINISTRATOR",
      "PRINCIPAL",
      "HEAD_TEACHER",
      "VICE_PRINCIPAL_ACADEMICS",
      "ADMIN_OFFICER",
      "EXAM_OFFICER",
      "HEAD_OF_DEPARTMENT",
      "CLASS_TEACHER"
    ].includes(session.role)
  ) {
    throw new ForbiddenException("Only academic approvers can review or publish results.");
  }
}

function assertAssessmentManager(session: SessionPayload) {
  if (
    ![
      "SUPER_ADMIN",
      "SCHOOL_OWNER",
      "PROPRIETOR",
      "ADMINISTRATOR",
      "PRINCIPAL",
      "HEAD_TEACHER",
      "VICE_PRINCIPAL_ACADEMICS",
      "ADMIN_OFFICER",
      "EXAM_OFFICER",
      "ICT_CBT_ADMIN"
    ].includes(session.role)
  ) {
    throw new ForbiddenException("Only school academic leaders or exam officers can manage assessment setup.");
  }
}

function assertSubjectManager(session: SessionPayload) {
  if (
    ![
      "SUPER_ADMIN",
      "SCHOOL_OWNER",
      "PROPRIETOR",
      "ADMINISTRATOR",
      "PRINCIPAL",
      "HEAD_TEACHER",
      "VICE_PRINCIPAL_ACADEMICS",
      "ADMIN_OFFICER",
      "EXAM_OFFICER",
      "HEAD_OF_DEPARTMENT"
    ].includes(session.role)
  ) {
    throw new ForbiddenException("Only academic leaders can manage subjects.");
  }
}

function assertFinalAcademicApprover(session: SessionPayload) {
  if (!["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL", "HEAD_TEACHER"].includes(session.role)) {
    throw new ForbiddenException("Only the Principal, Head Teacher, Proprietor, or Super Admin can give final result approval.");
  }
}

function isFinalAcademicApprover(session: SessionPayload) {
  return ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL", "HEAD_TEACHER"].includes(session.role);
}

function canTeacherScoreRole(role: string) {
  return role === "TEACHER" || role === "SUBJECT_TEACHER" || role === "CLASS_TEACHER";
}

function parseBands(input?: string) {
  if (!input) {
    return waecGradeBands.map((band, index) => ({
      label: band.label,
      minScore: band.min,
      maxScore: band.max,
      remark: band.remark,
      gpa: band.gpa,
      order: index + 1
    }));
  }

  const parsed = JSON.parse(input) as Array<{
    label: string;
    minScore: number;
    maxScore: number;
    remark: string;
    gpa?: number;
    order?: number;
  }>;

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new BadRequestException("bandsJson must be a non-empty grade-band array.");
  }

  return parsed.map((band, index) => ({
    label: band.label,
    minScore: Number(band.minScore),
    maxScore: Number(band.maxScore),
    remark: band.remark,
    gpa: band.gpa,
    order: band.order ?? index + 1
  }));
}

function parseClassLevelsJson(input?: string) {
  if (!input) return [];
  const parsed = JSON.parse(input) as unknown;
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
    throw new BadRequestException("applicableClassLevelsJson must be a JSON string array.");
  }
  const normalized = parsed.map((item) => normalizeNigeriaClassValue(item));
  if (normalized.some((item) => !item)) {
    throw new BadRequestException("Applicable classes must use valid Nigerian class values.");
  }
  return Array.from(new Set(normalized)) as string[];
}

@Injectable()
export class AcademicsService {
  private async currentTerm(schoolId: string) {
    const term = await prisma.term.findFirst({ where: { schoolId, isCurrent: true } });
    if (!term) throw new NotFoundException("No active term is configured for this school.");
    return term;
  }

  private async auditSubject(session: SessionPayload, action: AuditAction, subjectId: string, metadata?: Record<string, unknown>) {
    await prisma.auditLog.create({
      data: {
        schoolId: session.schoolId,
        actorId: session.userId,
        action,
        entityType: "subject",
        entityId: subjectId,
        metadata: metadata as never
      }
    });
  }

  private async activeScheme(schoolId: string) {
    return prisma.gradingScheme.findFirst({
      where: { schoolId, isActive: true },
      include: { bands: { orderBy: { order: "asc" } } }
    });
  }

  private async notifyAcademicWorkflow(params: {
    schoolId: string;
    userId?: string | null;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  }) {
    if (env.DEMO_MODE) return;
    await prisma.notificationLog.create({
      data: {
        schoolId: params.schoolId,
        userId: params.userId,
        channel: "IN_APP",
        title: params.title,
        body: params.body,
        status: "QUEUED",
        sentAt: new Date(),
        metadata: params.metadata as never
      }
    });
  }

  private async assertTeacherCanScore(session: SessionPayload, classId: string, subjectId: string) {
    if (!canTeacherScoreRole(session.role)) return;

    const assignment = await prisma.classSubject.findFirst({
      where: {
        schoolId: session.schoolId,
        classId,
        subjectId,
        teacherId: session.userId
      }
    });

    if (!assignment) {
      throw new ForbiddenException("Teachers can enter scores only for assigned classes and subjects.");
    }
  }

  private async resolveStudentAndSubject(
    schoolId: string,
    payload: z.infer<typeof gradeSchema>
  ) {
    const student = payload.studentId
      ? await prisma.student.findFirst({
          where: { id: payload.studentId, schoolId },
          include: { currentClass: true }
        })
      : payload.studentName
        ? await prisma.student.findFirst({
            where: {
              schoolId,
              OR: payload.studentName
                .split(" ")
                .filter(Boolean)
                .map((part) => ({
                  OR: [
                    { firstName: { contains: part, mode: "insensitive" as const } },
                    { lastName: { contains: part, mode: "insensitive" as const } }
                  ]
                }))
            },
            include: { currentClass: true }
          })
        : null;

    if (!student?.currentClassId) {
      throw new BadRequestException("A valid enrolled student and class are required.");
    }

    let subject = payload.subjectId ? await prisma.subject.findFirst({ where: { id: payload.subjectId, schoolId } }) : null;

    if (!subject && payload.subject) {
      subject =
        (await prisma.subject.findFirst({
          where: { schoolId, name: { equals: payload.subject, mode: "insensitive" } }
        })) ??
        (await prisma.subject.upsert({
          where: { schoolId_code: { schoolId, code: toSubjectCode(payload.subject) } },
          update: { name: payload.subject },
          create: { schoolId, name: payload.subject, code: toSubjectCode(payload.subject) }
        }));
    }

    if (!subject) {
      throw new BadRequestException("A valid subject is required.");
    }

    return { student, subject, classId: payload.classId ?? student.currentClassId };
  }

  private async resolveClassAndSubject(
    schoolId: string,
    payload: Pick<z.infer<typeof academicAssessmentSchema>, "classId" | "className" | "subjectId" | "subject">
  ) {
    const classRoom = payload.classId
      ? await prisma.classRoom.findFirst({ where: { id: payload.classId, schoolId }, include: { classLevel: true } })
      : payload.className
        ? await prisma.classRoom.findFirst({
            where: { schoolId, name: { equals: normalizeNigeriaClassValue(payload.className) ?? payload.className, mode: "insensitive" } },
            include: { classLevel: true }
          })
        : null;

    if (!classRoom) {
      throw new BadRequestException("A valid class is required for this assessment.");
    }

    let subject = payload.subjectId ? await prisma.subject.findFirst({ where: { id: payload.subjectId, schoolId } }) : null;
    if (!subject && payload.subject) {
      subject =
        (await prisma.subject.findFirst({ where: { schoolId, name: { equals: payload.subject, mode: "insensitive" } } })) ??
        (await prisma.subject.upsert({
          where: { schoolId_code: { schoolId, code: toSubjectCode(payload.subject) } },
          update: { name: payload.subject },
          create: { schoolId, name: payload.subject, code: toSubjectCode(payload.subject) }
        }));
    }

    if (!subject) {
      throw new BadRequestException("A valid subject is required for this assessment.");
    }

    return { classRoom, subject };
  }

  private mapAssessment(assessment: {
    id: string;
    title: string;
    maxScore: number;
    weight: number;
    assessmentDate: Date;
    assessmentType: string;
    submissionMode: string;
    status: string;
    arm: string | null;
    teacher?: { id: string; firstName: string; lastName: string } | null;
    term: { name: string; academicSession?: { name: string } | null };
    classRoom: { id: string; name: string; arm?: string | null };
    subject: { id: string; name: string };
    candidates?: Array<{
      id: string;
      studentId: string;
      attendanceState: string;
      score: number | null;
      scoreFlag: string;
      comment: string | null;
      enteredAt: Date | null;
      student: { firstName: string; middleName?: string | null; lastName: string; admissionNumber: string };
      enteredBy?: { firstName: string; lastName: string } | null;
      lastEditedBy?: { firstName: string; lastName: string } | null;
    }>;
    _count?: { candidates: number };
  }): AcademicAssessmentView {
    const candidates: AssessmentCandidateView[] | undefined = assessment.candidates?.map((candidate) => ({
      id: candidate.id,
      studentId: candidate.studentId,
      studentName: formatStudentName(candidate.student),
      admissionNumber: candidate.student.admissionNumber,
      attendanceState: candidate.attendanceState as AssessmentCandidateView["attendanceState"],
      score: candidate.score ?? undefined,
      scoreFlag: candidate.scoreFlag as AssessmentCandidateView["scoreFlag"],
      comment: candidate.comment ?? undefined,
      enteredBy: candidate.enteredBy ? `${candidate.enteredBy.firstName} ${candidate.enteredBy.lastName}` : undefined,
      enteredAt: candidate.enteredAt?.toISOString(),
      lastEditedBy: candidate.lastEditedBy ? `${candidate.lastEditedBy.firstName} ${candidate.lastEditedBy.lastName}` : undefined
    }));

    return {
      id: assessment.id,
      title: assessment.title,
      term: assessment.term.name,
      session: assessment.term.academicSession?.name,
      classId: assessment.classRoom.id,
      className: formatClassName(assessment.classRoom),
      arm: assessment.arm ?? assessment.classRoom.arm ?? undefined,
      subjectId: assessment.subject.id,
      subject: assessment.subject.name,
      teacherId: assessment.teacher?.id,
      teacherName: assessment.teacher ? `${assessment.teacher.firstName} ${assessment.teacher.lastName}` : undefined,
      assessmentType: assessment.assessmentType as AcademicAssessmentView["assessmentType"],
      maxScore: assessment.maxScore,
      weight: assessment.weight,
      assessmentDate: assessment.assessmentDate.toISOString(),
      submissionMode: assessment.submissionMode as AcademicAssessmentView["submissionMode"],
      status: assessment.status as AcademicAssessmentView["status"],
      candidateCount: candidates?.length ?? assessment._count?.candidates ?? 0,
      enteredCount: candidates?.filter((candidate) => candidate.score !== undefined).length ?? 0,
      candidates
    };
  }

  private mapBroadsheet(broadsheet: {
    id: string;
    status: string;
    approvalStage: string;
    rankingEnabled: boolean;
    missingScoreWarnings: unknown;
    data: unknown;
    publishedAt: Date | null;
    lockedAt: Date | null;
    classRoom: { id: string; name: string; arm?: string | null };
    term: { name: string; academicSession?: { name: string } | null };
    approvals: Array<{
      id: string;
      stage: string;
      action: string;
      note: string | null;
      createdAt: Date;
      actor: { firstName: string; lastName: string };
    }>;
  }): BroadsheetView {
    const data = broadsheet.data as { rows?: BroadsheetView["rows"] };
    const warnings = Array.isArray(broadsheet.missingScoreWarnings) ? broadsheet.missingScoreWarnings : [];
    return {
      id: broadsheet.id,
      classId: broadsheet.classRoom.id,
      className: formatClassName(broadsheet.classRoom),
      term: broadsheet.term.name,
      session: broadsheet.term.academicSession?.name,
      status: broadsheet.status as BroadsheetView["status"],
      approvalStage: broadsheet.approvalStage as BroadsheetView["approvalStage"],
      rankingEnabled: broadsheet.rankingEnabled,
      missingScoreWarnings: warnings.map(String),
      rows: data.rows ?? [],
      approvals: broadsheet.approvals.map((approval) => ({
        id: approval.id,
        actorName: `${approval.actor.firstName} ${approval.actor.lastName}`,
        stage: approval.stage as BroadsheetView["approvalStage"],
        action: approval.action as BroadsheetView["approvals"][number]["action"],
        note: approval.note ?? undefined,
        createdAt: approval.createdAt.toISOString()
      })),
      publishedAt: broadsheet.publishedAt?.toISOString(),
      lockedAt: broadsheet.lockedAt?.toISOString()
    };
  }

  private mapSubject(subject: {
    id: string;
    name: string;
    code: string;
    departmentId?: string | null;
    department?: { name: string } | null;
    description?: string | null;
    waecCode?: string | null;
    necoCode?: string | null;
    isWaecSubject?: boolean;
    section: string | null;
    applicableClassLevels: unknown;
    subjectCombination?: string | null;
    periodsPerWeek?: number;
    requiresLab?: boolean;
    sortOrder?: number;
    isActive?: boolean;
    isCore: boolean;
    isOptional: boolean;
    religionSpecific: boolean;
    trackSpecific: string | null;
    tradeSubject: boolean;
    status: string;
    classSubjects?: Array<{ classId: string; teacherId: string | null }>;
  }): SubjectView {
    const classSubjects = subject.classSubjects ?? [];
    return {
      id: subject.id,
      name: subject.name,
      code: subject.code,
      departmentId: subject.departmentId ?? undefined,
      departmentName: subject.department?.name,
      description: subject.description ?? undefined,
      waecCode: subject.waecCode ?? undefined,
      necoCode: subject.necoCode ?? undefined,
      isWaecSubject: subject.isWaecSubject ?? false,
      section: subject.section as SubjectView["section"],
      applicableClassLevels: Array.isArray(subject.applicableClassLevels) ? subject.applicableClassLevels.map(String) : [],
      subjectCombination: subject.subjectCombination ?? undefined,
      periodsPerWeek: subject.periodsPerWeek ?? 3,
      requiresLab: subject.requiresLab ?? false,
      sortOrder: subject.sortOrder ?? 0,
      isActive: subject.isActive ?? subject.status === "ACTIVE",
      isCore: subject.isCore,
      isOptional: subject.isOptional,
      religionSpecific: subject.religionSpecific,
      trackSpecific: subject.trackSpecific ?? undefined,
      tradeSubject: subject.tradeSubject,
      status: subject.status,
      classCount: new Set(classSubjects.map((assignment) => assignment.classId)).size,
      teacherCount: new Set(classSubjects.flatMap((assignment) => (assignment.teacherId ? [assignment.teacherId] : []))).size
    };
  }

  private resolveBand(score: number, scheme?: Awaited<ReturnType<AcademicsService["activeScheme"]>>) {
    if (!scheme?.bands.length) return resolveGradeLabel(score);
    return (
      scheme.bands.find((band) => score >= band.minScore && score <= band.maxScore) ?? {
        label: "N/A",
        remark: "Not graded"
      }
    );
  }

  private async ensureComponents(schoolId: string, termId: string) {
    const [caComponent, examComponent] = await Promise.all([
      prisma.assessmentComponent.upsert({
        where: { schoolId_code: { schoolId, code: "CA" } },
        update: { name: "Continuous Assessment", weight: 40, maxScore: 40, order: 1, isActive: true },
        create: {
          schoolId,
          termId,
          name: "Continuous Assessment",
          code: "CA",
          weight: 40,
          maxScore: 40,
          order: 1,
          isActive: true
        }
      }),
      prisma.assessmentComponent.upsert({
        where: { schoolId_code: { schoolId, code: "EXAM" } },
        update: { name: "Exam", weight: 60, maxScore: 60, order: 2, isActive: true },
        create: {
          schoolId,
          termId,
          name: "Exam",
          code: "EXAM",
          weight: 60,
          maxScore: 60,
          order: 2,
          isActive: true
        }
      })
    ]);

    return { caComponent, examComponent };
  }

  private async recordApproval(params: {
    schoolId: string;
    resultSheetId: string;
    actorId: string;
    action: "SUBMIT" | "REVIEW" | "APPROVE" | "REJECT" | "RETURN" | "PUBLISH" | "UNPUBLISH";
    fromStatus?: ResultWorkflowStatus;
    toStatus: ResultWorkflowStatus;
    note?: string;
  }) {
    await prisma.resultApproval.create({
      data: {
        schoolId: params.schoolId,
        resultSheetId: params.resultSheetId,
        actorId: params.actorId,
        action: params.action,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        note: params.note
      }
    });
  }

  private async setResultStatus(
    session: SessionPayload,
    resultSheetId: string,
    toStatus: ResultWorkflowStatus,
    action: "SUBMIT" | "REVIEW" | "APPROVE" | "REJECT" | "RETURN" | "PUBLISH" | "UNPUBLISH",
    note?: string,
    extra?: { principalComment?: string }
  ) {
    const sheet = await prisma.resultSheet.findFirst({
      where: { id: resultSheetId, schoolId: session.schoolId }
    });
    if (!sheet) throw new NotFoundException("Result sheet not found.");
    const fromStatus = sheet.status as ResultWorkflowStatus;

    if (!canTransitionResult(fromStatus, toStatus) && fromStatus !== toStatus) {
      throw new BadRequestException(`Cannot move result from ${fromStatus} to ${toStatus}.`);
    }

    const now = new Date();
    const updated = await prisma.resultSheet.update({
      where: { id: resultSheetId },
      data: {
        status: toStatus,
        submittedAt: toStatus === "SUBMITTED" ? now : sheet.submittedAt,
        reviewedAt: toStatus === "UNDER_REVIEW" || toStatus === "APPROVED" || toStatus === "REJECTED" ? now : sheet.reviewedAt,
        approvedAt: toStatus === "APPROVED" ? now : sheet.approvedAt,
        rejectedAt: toStatus === "REJECTED" ? now : sheet.rejectedAt,
        lockedAt: toStatus === "PUBLISHED" ? now : toStatus === "APPROVED" ? null : sheet.lockedAt,
        publishedAt: toStatus === "PUBLISHED" ? now : toStatus === "APPROVED" && action === "UNPUBLISH" ? null : sheet.publishedAt,
        principalComment: extra?.principalComment ?? sheet.principalComment
      },
      include: { student: true, classRoom: true, scoreEntries: { include: { subject: true, assessmentComponent: true } } }
    });

    await this.recordApproval({
      schoolId: session.schoolId,
      resultSheetId,
      actorId: session.userId,
      action,
      fromStatus,
      toStatus,
      note
    });

    return this.mapResultSheet(updated);
  }

  private mapResultSheet(sheet: {
    id: string;
    studentId: string;
    classId: string;
    totalScore: number;
    averageScore: number;
    grade: string | null;
    position: number | null;
    teacherComment: string | null;
    principalComment: string | null;
    status: string;
    publishedAt: Date | null;
    student: { firstName: string; middleName?: string | null; lastName: string };
    classRoom: { name: string; arm?: string | null };
    scoreEntries: Array<{
      subjectId: string;
      score: number;
      subject: { name: string };
      assessmentComponent: { code: string };
    }>;
  }): GradeRecordView {
    const firstScore = sheet.scoreEntries[0];
    const ca = sheet.scoreEntries
      .filter((entry) => entry.assessmentComponent.code === "CA")
      .reduce((sum, entry) => sum + entry.score, 0);
    const exam = sheet.scoreEntries
      .filter((entry) => entry.assessmentComponent.code === "EXAM")
      .reduce((sum, entry) => sum + entry.score, 0);
    const total = ca + exam || Number(sheet.totalScore);
    const band = resolveGradeLabel(total);

    return {
      id: sheet.id,
      studentId: sheet.studentId,
      studentName: formatStudentName(sheet.student),
      classId: sheet.classId,
      subjectId: firstScore?.subjectId,
      className: formatClassName(sheet.classRoom),
      subject: firstScore?.subject.name ?? "Compiled result",
      continuousAssessment: ca,
      exam,
      total,
      grade: sheet.grade ?? band.label,
      remark: band.remark,
      position: sheet.position ?? undefined,
      status: sheet.status as GradeRecordView["status"],
      published: Boolean(sheet.publishedAt),
      teacherComment: sheet.teacherComment ?? undefined,
      principalComment: sheet.principalComment ?? undefined
    };
  }

  async listGrades(session: SessionPayload) {
    if (env.DEMO_MODE) {
      return getDemoStore().grades;
    }

    const scores = await prisma.scoreEntry.findMany({
      where: {
        schoolId: session.schoolId,
        ...(session.role === "TEACHER" ? { enteredById: session.userId } : {})
      },
      include: {
        student: true,
        subject: true,
        assessmentComponent: true,
        resultSheet: { include: { classRoom: true } }
      },
      orderBy: { recordedAt: "desc" },
      take: 200
    });

    const grouped = new Map<string, GradeRecordView>();

    for (const score of scores) {
      const key = `${score.resultSheetId}-${score.subjectId}`;
      const entry =
        grouped.get(key) ??
        ({
          id: score.resultSheetId,
          studentId: score.studentId,
          studentName: formatStudentName(score.student),
          classId: score.resultSheet.classId,
          subjectId: score.subjectId,
          className: formatClassName(score.resultSheet.classRoom),
          subject: score.subject.name,
          continuousAssessment: 0,
          exam: 0,
          total: 0,
          grade: "F9",
          status: score.resultSheet.status as GradeRecordView["status"],
          published: Boolean(score.resultSheet.publishedAt),
          teacherComment: score.resultSheet.teacherComment ?? undefined,
          principalComment: score.resultSheet.principalComment ?? undefined
        } satisfies GradeRecordView);

      if (score.assessmentComponent.code === "CA") entry.continuousAssessment = score.score;
      if (score.assessmentComponent.code === "EXAM") entry.exam = score.score;

      entry.total = entry.continuousAssessment + entry.exam;
      const band = resolveGradeLabel(entry.total);
      entry.grade = band.label;
      entry.remark = band.remark;
      grouped.set(key, entry);
    }

    return Array.from(grouped.values());
  }

  async upsertGrade(session: SessionPayload, payload: unknown, draft = true) {
    const parsed = gradeSchema.parse(payload);
    const total = parsed.continuousAssessment + parsed.exam;
    const grade = resolveGradeLabel(total).label;

    if (env.DEMO_MODE) {
      const record: GradeRecordView = {
        id: randomUUID(),
        studentId: parsed.studentId ?? randomUUID(),
        studentName: parsed.studentName ?? "Demo student",
        className: parsed.className ? formatNigeriaClassName(parsed.className) : "Demo class",
        subject: parsed.subject ?? "Demo subject",
        continuousAssessment: parsed.continuousAssessment,
        exam: parsed.exam,
        total,
        grade,
        status: draft ? "DRAFT" : "SUBMITTED",
        published: false
      };
      getDemoStore().grades.unshift(record);
      return record;
    }

    const [term, scheme] = await Promise.all([this.currentTerm(session.schoolId), this.activeScheme(session.schoolId)]);
    const { student, subject, classId } = await this.resolveStudentAndSubject(session.schoolId, parsed);
    await this.assertTeacherCanScore(session, classId, subject.id);
    const { caComponent, examComponent } = await this.ensureComponents(session.schoolId, term.id);

    const existingSheet = await prisma.resultSheet.findUnique({
      where: { studentId_termId: { studentId: student.id, termId: term.id } }
    });
    if (
      existingSheet?.publishedAt ||
      existingSheet?.lockedAt ||
      ["UNDER_REVIEW", "APPROVED", "PUBLISHED"].includes(existingSheet?.status ?? "")
    ) {
      throw new ForbiddenException("Reviewed, approved, published, or locked result sheets cannot be edited without a return/unpublish workflow.");
    }

    const band = this.resolveBand(total, scheme);
    const resultSheet = await prisma.resultSheet.upsert({
      where: { studentId_termId: { studentId: student.id, termId: term.id } },
      update: {
        classId,
        totalScore: total,
        averageScore: total,
        grade: band.label,
        teacherComment: parsed.teacherComment,
        principalComment: parsed.principalComment,
        gradingSchemeId: scheme?.id,
        status: draft ? "DRAFT" : "SUBMITTED",
        submittedAt: draft ? undefined : new Date()
      },
      create: {
        schoolId: session.schoolId,
        studentId: student.id,
        termId: term.id,
        classId,
        createdById: session.userId,
        totalScore: total,
        averageScore: total,
        grade: band.label,
        teacherComment: parsed.teacherComment,
        principalComment: parsed.principalComment,
        gradingSchemeId: scheme?.id,
        status: draft ? "DRAFT" : "SUBMITTED",
        submittedAt: draft ? undefined : new Date()
      }
    });

    await prisma.scoreEntry.deleteMany({
      where: { schoolId: session.schoolId, resultSheetId: resultSheet.id, subjectId: subject.id }
    });
    await prisma.scoreEntry.createMany({
      data: [
        {
          schoolId: session.schoolId,
          studentId: student.id,
          resultSheetId: resultSheet.id,
          subjectId: subject.id,
          assessmentComponentId: caComponent.id,
          enteredById: session.userId,
          score: parsed.continuousAssessment,
          maxScore: caComponent.maxScore,
          isDraft: draft,
          submittedAt: draft ? undefined : new Date()
        },
        {
          schoolId: session.schoolId,
          studentId: student.id,
          resultSheetId: resultSheet.id,
          subjectId: subject.id,
          assessmentComponentId: examComponent.id,
          enteredById: session.userId,
          score: parsed.exam,
          maxScore: examComponent.maxScore,
          isDraft: draft,
          submittedAt: draft ? undefined : new Date()
        }
      ]
    });

    const allEntries = await prisma.scoreEntry.findMany({
      where: { schoolId: session.schoolId, resultSheetId: resultSheet.id },
      select: { subjectId: true, score: true, assessmentComponent: { select: { code: true } } }
    });
    const summary = calculateSubjectTotals(allEntries);
    const summaryBand = this.resolveBand(summary.averageScore || total, scheme);
    await prisma.resultSheet.update({
      where: { id: resultSheet.id },
      data: {
        totalScore: summary.totalScore || total,
        averageScore: summary.averageScore || total,
        grade: summaryBand.label
      }
    });

    if (!draft) {
      await this.recordApproval({
        schoolId: session.schoolId,
        resultSheetId: resultSheet.id,
        actorId: session.userId,
        action: "SUBMIT",
        fromStatus: existingSheet?.status as ResultWorkflowStatus | undefined,
        toStatus: "SUBMITTED",
        note: "Score sheet submitted for review."
      });
    }

    const saved = await prisma.resultSheet.findUniqueOrThrow({
      where: { id: resultSheet.id },
      include: { student: true, classRoom: true, scoreEntries: { include: { subject: true, assessmentComponent: true } } }
    });

    return this.mapResultSheet(saved);
  }

  async createGradingScheme(session: SessionPayload, payload: unknown): Promise<GradingSchemeView> {
    assertAcademicApprover(session);
    const parsed = gradingSchemeSchema.parse(payload);
    const bands = parseBands(parsed.bandsJson);

    if (parsed.isActive) {
      await prisma.gradingScheme.updateMany({ where: { schoolId: session.schoolId }, data: { isActive: false } });
    }

    const scheme = await prisma.gradingScheme.create({
      data: {
        schoolId: session.schoolId,
        name: parsed.name,
        description: parsed.description,
        isActive: parsed.isActive,
        rankingEnabled: parsed.rankingEnabled,
        passMark: parsed.passMark,
        bands: { create: bands.map((band) => ({ schoolId: session.schoolId, ...band })) }
      },
      include: { bands: { orderBy: { order: "asc" } } }
    });

    return {
      id: scheme.id,
      name: scheme.name,
      description: scheme.description ?? undefined,
      isActive: scheme.isActive,
      rankingEnabled: scheme.rankingEnabled,
      passMark: scheme.passMark,
      bands: scheme.bands.map((band) => ({
        id: band.id,
        label: band.label,
        minScore: band.minScore,
        maxScore: band.maxScore,
        remark: band.remark,
        gpa: band.gpa ?? undefined,
        order: band.order
      }))
    };
  }

  async listGradingSchemes(session: SessionPayload): Promise<GradingSchemeView[]> {
    if (env.DEMO_MODE) {
      return [
        {
          id: "demo-waec",
          name: "WAEC/NECO Default",
          isActive: true,
          rankingEnabled: true,
          passMark: 40,
          bands: waecGradeBands.map((band, index) => ({
            label: band.label,
            minScore: band.min,
            maxScore: band.max,
            remark: band.remark,
            order: index + 1
          }))
        }
      ];
    }

    const schemes = await prisma.gradingScheme.findMany({
      where: { schoolId: session.schoolId },
      include: { bands: { orderBy: { order: "asc" } } },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }]
    });
    return schemes.map((scheme) => ({
      id: scheme.id,
      name: scheme.name,
      description: scheme.description ?? undefined,
      isActive: scheme.isActive,
      rankingEnabled: scheme.rankingEnabled,
      passMark: scheme.passMark,
      bands: scheme.bands.map((band) => ({
        id: band.id,
        label: band.label,
        minScore: band.minScore,
        maxScore: band.maxScore,
        remark: band.remark,
        gpa: band.gpa ?? undefined,
        order: band.order
      }))
    }));
  }

  async createAssessmentComponent(session: SessionPayload, payload: unknown): Promise<AssessmentComponentView> {
    assertAcademicApprover(session);
    const parsed = assessmentComponentSchema.parse(payload);
    const termId = parsed.termId ?? (await this.currentTerm(session.schoolId)).id;
    const component = await prisma.assessmentComponent.upsert({
      where: { schoolId_code: { schoolId: session.schoolId, code: parsed.code.toUpperCase() } },
      update: {
        name: parsed.name,
        termId,
        weight: parsed.weight,
        maxScore: parsed.maxScore,
        order: parsed.order,
        isActive: parsed.isActive
      },
      create: {
        schoolId: session.schoolId,
        termId,
        name: parsed.name,
        code: parsed.code.toUpperCase(),
        weight: parsed.weight,
        maxScore: parsed.maxScore,
        order: parsed.order,
        isActive: parsed.isActive
      }
    });

    return component;
  }

  async listAssessmentComponents(session: SessionPayload): Promise<AssessmentComponentView[]> {
    if (env.DEMO_MODE) {
      return [
        { id: "ca", name: "Continuous Assessment", code: "CA", weight: 40, maxScore: 40, order: 1, isActive: true },
        { id: "exam", name: "Exam", code: "EXAM", weight: 60, maxScore: 60, order: 2, isActive: true }
      ];
    }

    const components = await prisma.assessmentComponent.findMany({
      where: { schoolId: session.schoolId },
      orderBy: { order: "asc" }
    });
    return components;
  }

  async listSubjects(session: SessionPayload): Promise<SubjectView[]> {
    const staffProfile = session.role === "HEAD_OF_DEPARTMENT"
      ? await prisma.staffProfile.findUnique({ where: { userId: session.userId }, select: { departmentId: true } })
      : null;
    const subjects = await prisma.subject.findMany({
      where: {
        schoolId: session.schoolId,
        deletedAt: null,
        isActive: true,
        ...(staffProfile?.departmentId ? { departmentId: staffProfile.departmentId } : {})
      },
      include: {
        department: { select: { name: true } },
        classSubjects: { where: { isActive: true }, select: { classId: true, teacherId: true } }
      },
      orderBy: [{ section: "asc" }, { sortOrder: "asc" }, { name: "asc" }]
    });
    return subjects.map((subject) => this.mapSubject(subject));
  }

  async createSubject(session: SessionPayload, payload: unknown): Promise<SubjectView> {
    assertSubjectManager(session);
    const parsed = subjectSchema.parse(payload);
    const applicableClassLevels = parsed.classLevels?.length
      ? Array.from(new Set(parsed.classLevels.flatMap((level) => normalizeNigeriaClassValue(level) ?? [])))
      : parseClassLevelsJson(parsed.applicableClassLevelsJson);
    if (env.DEMO_MODE) {
      return {
        id: randomUUID(),
        name: parsed.name,
        code: parsed.code.toUpperCase(),
        waecCode: parsed.waecCode || undefined,
        necoCode: parsed.necoCode || undefined,
        isWaecSubject: parsed.isWaecSubject,
        periodsPerWeek: parsed.periodsPerWeek,
        requiresLab: parsed.requiresLab,
        section: parsed.section,
        applicableClassLevels,
        isCore: parsed.isCore,
        isOptional: parsed.isOptional,
        religionSpecific: parsed.religionSpecific,
        trackSpecific: parsed.trackSpecific,
        tradeSubject: parsed.tradeSubject,
        status: parsed.status
      };
    }

    const code = parsed.code.toUpperCase().trim();
    const existing = await prisma.subject.findFirst({ where: { schoolId: session.schoolId, code, deletedAt: null } });
    if (existing) throw new ConflictException(`A subject with code ${code} already exists.`);

    const subject = await prisma.subject.create({
      data: {
        schoolId: session.schoolId,
        name: parsed.name.trim(),
        code,
        waecCode: parsed.waecCode?.toUpperCase().trim() || null,
        necoCode: parsed.necoCode?.toUpperCase().trim() || null,
        departmentId: parsed.departmentId || null,
        description: parsed.description || null,
        section: parsed.section,
        applicableClassLevels,
        isWaecSubject: parsed.isWaecSubject,
        subjectCombination: parsed.subjectCombination || null,
        periodsPerWeek: parsed.periodsPerWeek,
        requiresLab: parsed.requiresLab,
        sortOrder: parsed.sortOrder,
        isActive: parsed.status !== "INACTIVE",
        isCore: parsed.isCore,
        isOptional: parsed.isOptional,
        religionSpecific: parsed.religionSpecific,
        trackSpecific: parsed.trackSpecific,
        tradeSubject: parsed.tradeSubject,
        status: parsed.status
      }
    });

    if (applicableClassLevels.length > 0) {
      const classes = await prisma.classRoom.findMany({
        where: { schoolId: session.schoolId, deletedAt: null },
        include: { classLevel: true }
      });
      const matchingClasses = classes.filter((classRoom) => applicableClassLevels.includes(normalizeNigeriaClassValue(classRoom.classLevel.name) ?? ""));
      if (matchingClasses.length > 0) {
        await prisma.classSubject.createMany({
          data: matchingClasses.map((classRoom) => ({
            schoolId: session.schoolId,
            classId: classRoom.id,
            subjectId: subject.id,
            assignedById: session.userId,
            isActive: true
          })),
          skipDuplicates: true
        });
      }
    }

    await this.auditSubject(session, AuditAction.CREATE, subject.id, { name: subject.name, code: subject.code, applicableClassLevels });
    return this.mapSubject(subject);
  }

  async getSubject(session: SessionPayload, subjectId: string) {
    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, schoolId: session.schoolId, deletedAt: null },
      include: {
        department: { select: { name: true } },
        classSubjects: { include: { classRoom: { include: { classLevel: true } } } }
      }
    });
    if (!subject) throw new NotFoundException("Subject not found.");

    const teacherIds = subject.classSubjects.flatMap((assignment) => (assignment.teacherId ? [assignment.teacherId] : []));
    const teachers = teacherIds.length
      ? new Map((await prisma.user.findMany({ where: { schoolId: session.schoolId, id: { in: teacherIds } }, select: { id: true, firstName: true, lastName: true, email: true } })).map((teacher) => [teacher.id, teacher]))
      : new Map<string, { id: string; firstName: string; lastName: string; email: string }>();
    const history = await prisma.subjectTeacherHistory.findMany({
      where: { schoolId: session.schoolId, subjectId },
      orderBy: { assignedAt: "desc" },
      take: 50
    });

    return {
      ...this.mapSubject(subject),
      classAssignments: subject.classSubjects.map((assignment) => {
        const teacher = assignment.teacherId ? teachers.get(assignment.teacherId) : null;
        return {
          id: assignment.id,
          classId: assignment.classId,
          className: formatNigeriaClassName(`${assignment.classRoom.classLevel.name} - ${assignment.classRoom.arm}`),
          teacherId: assignment.teacherId,
          teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : null,
          teacherEmail: teacher?.email ?? null,
          isActive: assignment.isActive,
          assignedAt: assignment.assignedAt
        };
      }),
      teacherHistory: history
    };
  }

  async updateSubject(session: SessionPayload, subjectId: string, payload: unknown): Promise<SubjectView> {
    assertSubjectManager(session);
    const parsed = subjectUpdateSchema.parse(payload);
    const subject = await prisma.subject.findFirst({ where: { id: subjectId, schoolId: session.schoolId, deletedAt: null } });
    if (!subject) throw new NotFoundException("Subject not found.");

    if (parsed.code && parsed.code.toUpperCase().trim() !== subject.code) {
      const duplicate = await prisma.subject.findFirst({
        where: { schoolId: session.schoolId, code: parsed.code.toUpperCase().trim(), id: { not: subjectId }, deletedAt: null }
      });
      if (duplicate) throw new ConflictException(`Another subject with code ${parsed.code.toUpperCase()} already exists.`);
    }

    const applicableClassLevels = parsed.classLevels?.length
      ? Array.from(new Set(parsed.classLevels.flatMap((level) => normalizeNigeriaClassValue(level) ?? [])))
      : parsed.applicableClassLevelsJson
        ? parseClassLevelsJson(parsed.applicableClassLevelsJson)
        : undefined;

    const updated = await prisma.subject.update({
      where: { id: subjectId },
      data: {
        ...(parsed.name ? { name: parsed.name.trim() } : {}),
        ...(parsed.code ? { code: parsed.code.toUpperCase().trim() } : {}),
        ...(parsed.waecCode !== undefined ? { waecCode: parsed.waecCode?.toUpperCase().trim() || null } : {}),
        ...(parsed.necoCode !== undefined ? { necoCode: parsed.necoCode?.toUpperCase().trim() || null } : {}),
        ...(parsed.departmentId !== undefined ? { departmentId: parsed.departmentId || null } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description || null } : {}),
        ...(parsed.section !== undefined ? { section: parsed.section } : {}),
        ...(applicableClassLevels ? { applicableClassLevels } : {}),
        ...(parsed.isWaecSubject !== undefined ? { isWaecSubject: parsed.isWaecSubject } : {}),
        ...(parsed.subjectCombination !== undefined ? { subjectCombination: parsed.subjectCombination || null } : {}),
        ...(parsed.periodsPerWeek !== undefined ? { periodsPerWeek: parsed.periodsPerWeek } : {}),
        ...(parsed.requiresLab !== undefined ? { requiresLab: parsed.requiresLab } : {}),
        ...(parsed.sortOrder !== undefined ? { sortOrder: parsed.sortOrder } : {}),
        ...(parsed.isCore !== undefined ? { isCore: parsed.isCore } : {}),
        ...(parsed.isOptional !== undefined ? { isOptional: parsed.isOptional } : {}),
        ...(parsed.religionSpecific !== undefined ? { religionSpecific: parsed.religionSpecific } : {}),
        ...(parsed.trackSpecific !== undefined ? { trackSpecific: parsed.trackSpecific || null } : {}),
        ...(parsed.tradeSubject !== undefined ? { tradeSubject: parsed.tradeSubject } : {}),
        ...(parsed.status !== undefined ? { status: parsed.status, isActive: parsed.status !== "INACTIVE" } : {})
      }
    });

    if (applicableClassLevels) {
      const classes = await prisma.classRoom.findMany({
        where: { schoolId: session.schoolId, deletedAt: null },
        include: { classLevel: true }
      });
      const matchingClasses = classes.filter((classRoom) => applicableClassLevels.includes(normalizeNigeriaClassValue(classRoom.classLevel.name) ?? ""));
      if (matchingClasses.length > 0) {
        await prisma.classSubject.createMany({
          data: matchingClasses.map((classRoom) => ({
            schoolId: session.schoolId,
            classId: classRoom.id,
            subjectId,
            assignedById: session.userId,
            isActive: true
          })),
          skipDuplicates: true
        });
      }
    }

    await this.auditSubject(session, AuditAction.UPDATE, subjectId, payload as Record<string, unknown>);
    return this.mapSubject(updated);
  }

  async deleteSubject(session: SessionPayload, subjectId: string) {
    assertSubjectManager(session);
    const subject = await prisma.subject.findFirst({ where: { id: subjectId, schoolId: session.schoolId, deletedAt: null } });
    if (!subject) throw new NotFoundException("Subject not found.");
    const scoreCount = await prisma.scoreEntry.count({ where: { subjectId } });
    if (scoreCount > 0) {
      throw new BadRequestException(`Cannot delete ${subject.name} because it has ${scoreCount} score record(s). Archive it instead.`);
    }
    await prisma.subject.update({
      where: { id: subjectId },
      data: { deletedAt: new Date(), isActive: false, status: "ARCHIVED" }
    });
    await prisma.classSubject.updateMany({ where: { schoolId: session.schoolId, subjectId }, data: { isActive: false } });
    await this.auditSubject(session, AuditAction.DELETE, subjectId, { name: subject.name });
    return { message: `${subject.name} has been archived.` };
  }

  async assignSubjectTeacher(session: SessionPayload, subjectId: string, payload: unknown) {
    assertSubjectManager(session);
    const parsed = assignSubjectTeacherSchema.parse(payload);
    const classId = parsed.classId ?? parsed.class_id;
    const teacherId = parsed.teacherId ?? parsed.teacher_id ?? null;
    const applyToAllArms = parsed.applyToAllArms || parsed.apply_to_all_arms || false;
    if (!classId) throw new BadRequestException("classId is required.");

    const [subject, selectedClass, term] = await Promise.all([
      prisma.subject.findFirst({ where: { id: subjectId, schoolId: session.schoolId, deletedAt: null } }),
      prisma.classRoom.findFirst({ where: { id: classId, schoolId: session.schoolId, deletedAt: null }, include: { classLevel: true } }),
      this.currentTerm(session.schoolId)
    ]);
    if (!subject) throw new NotFoundException("Subject not found.");
    if (!selectedClass) throw new NotFoundException("Class not found.");

    if (teacherId) {
      const teacher = await prisma.user.findFirst({ where: { id: teacherId, schoolId: session.schoolId, deletedAt: null, isActive: true } });
      if (!teacher) throw new BadRequestException("Selected teacher not found in this school.");
      const validRoles: UserRole[] = [UserRole.TEACHER, UserRole.CLASS_TEACHER, UserRole.SUBJECT_TEACHER, UserRole.HEAD_OF_DEPARTMENT, UserRole.VICE_PRINCIPAL_ACADEMICS, UserRole.PRINCIPAL];
      if (!validRoles.includes(teacher.role)) {
        throw new BadRequestException(`${teacher.firstName} ${teacher.lastName} does not have a teaching role.`);
      }
    }

    const targetClasses = applyToAllArms
      ? await prisma.classRoom.findMany({ where: { schoolId: session.schoolId, classLevelId: selectedClass.classLevelId, deletedAt: null } })
      : [selectedClass];

    for (const classRoom of targetClasses) {
      const existing = await prisma.classSubject.findUnique({ where: { classId_subjectId: { classId: classRoom.id, subjectId } } });
      if (existing?.teacherId) {
        await prisma.subjectTeacherHistory.updateMany({
          where: { schoolId: session.schoolId, subjectId, classId: classRoom.id, teacherId: existing.teacherId, unassignedAt: null },
          data: { unassignedAt: new Date(), reason: parsed.reason ?? "Teacher changed" }
        });
      }

      await prisma.classSubject.upsert({
        where: { classId_subjectId: { classId: classRoom.id, subjectId } },
        update: { teacherId, assignedById: session.userId, assignedAt: new Date(), isActive: true },
        create: { schoolId: session.schoolId, classId: classRoom.id, subjectId, teacherId, assignedById: session.userId, isActive: true }
      });

      if (teacherId) {
        await prisma.subjectTeacherHistory.create({
          data: {
            schoolId: session.schoolId,
            subjectId,
            classId: classRoom.id,
            teacherId,
            academicSessionId: term.academicSessionId,
            termId: term.id,
            assignedById: session.userId,
            reason: parsed.reason ?? null
          }
        });
      }

      await prisma.timetableEntry.updateMany({
        where: { schoolId: session.schoolId, classId: classRoom.id, subjectId, termId: term.id },
        data: { teacherId, updatedById: session.userId }
      });
    }

    await this.auditSubject(session, AuditAction.UPDATE, subjectId, {
      action: "assign_teacher",
      teacherId,
      classIds: targetClasses.map((classRoom) => classRoom.id),
      applyToAllArms
    });
    return { assignedClasses: targetClasses.length };
  }

  async createSectionAssessmentComponent(session: SessionPayload, payload: unknown): Promise<SectionAssessmentComponentView> {
    assertAssessmentManager(session);
    const parsed = sectionAssessmentComponentSchema.parse(payload);
    if (env.DEMO_MODE) {
      return {
        id: randomUUID(),
        section: parsed.section,
        name: parsed.name,
        code: parsed.code.toUpperCase(),
        type: parsed.type,
        weight: parsed.weight,
        maxScore: parsed.maxScore,
        order: parsed.order,
        isActive: parsed.isActive
      };
    }

    const term = parsed.termId ? null : await this.currentTerm(session.schoolId);
    const componentsForSection = await prisma.sectionAssessmentComponent.findMany({
      where: {
        schoolId: session.schoolId,
        section: parsed.section,
        termId: parsed.termId ?? term?.id,
        NOT: { code: parsed.code.toUpperCase() }
      }
    });
    const validation = validateSectionAssessmentWeights([
      ...componentsForSection.map((component) => ({ section: component.section, weight: component.weight, isActive: component.isActive })),
      { section: parsed.section, weight: parsed.weight, isActive: parsed.isActive }
    ]);
    if (!validation.ok) {
      throw new BadRequestException("Active assessment component weights must total 100% for each school section.");
    }

    const existingComponent = await prisma.sectionAssessmentComponent.findFirst({
      where: {
        schoolId: session.schoolId,
        academicSessionId: parsed.academicSessionId,
        termId: parsed.termId ?? term?.id,
        section: parsed.section,
        code: parsed.code.toUpperCase()
      }
    });
    const component = existingComponent
      ? await prisma.sectionAssessmentComponent.update({
          where: { id: existingComponent.id },
          data: {
            name: parsed.name,
            type: parsed.type,
            weight: parsed.weight,
            maxScore: parsed.maxScore,
            order: parsed.order,
            isActive: parsed.isActive
          }
        })
      : await prisma.sectionAssessmentComponent.create({
          data: {
            schoolId: session.schoolId,
            academicSessionId: parsed.academicSessionId,
            termId: parsed.termId ?? term?.id,
            section: parsed.section,
            name: parsed.name,
            code: parsed.code.toUpperCase(),
            type: parsed.type,
            weight: parsed.weight,
            maxScore: parsed.maxScore,
            order: parsed.order,
            isActive: parsed.isActive
          }
        });

    return component;
  }

  async listSectionAssessmentComponents(session: SessionPayload): Promise<SectionAssessmentComponentView[]> {
    if (env.DEMO_MODE) {
      return ["NURSERY", "PRIMARY", "JUNIOR_SECONDARY", "SENIOR_SECONDARY"].flatMap((section) => [
        { id: `${section}-ca`, section, name: "Continuous Assessment", code: "CA", type: "TEST", weight: 40, maxScore: 40, order: 1, isActive: true },
        { id: `${section}-exam`, section, name: "Terminal Examination", code: "EXAM", type: "EXAMINATION", weight: 60, maxScore: 60, order: 2, isActive: true }
      ]) as SectionAssessmentComponentView[];
    }

    return prisma.sectionAssessmentComponent.findMany({
      where: { schoolId: session.schoolId },
      orderBy: [{ section: "asc" }, { order: "asc" }]
    });
  }

  private assessmentComponentCode(assessment: { id: string; assessmentType: string }) {
    const prefix = assessment.assessmentType === "EXAMINATION" ? "EXAM" : "CA";
    return `${prefix}_${assessment.id.slice(-10).toUpperCase()}`;
  }

  async createAcademicAssessment(session: SessionPayload, payload: unknown): Promise<AcademicAssessmentView> {
    assertAssessmentManager(session);
    const parsed = academicAssessmentSchema.parse(payload);

    if (env.DEMO_MODE) {
      return {
        id: randomUUID(),
        title: parsed.title,
        term: "Second Term",
        session: "2025/2026",
        className: parsed.className ? formatNigeriaClassName(parsed.className) : "JSS 2 - Gold",
        arm: parsed.arm,
        subject: parsed.subject ?? "Mathematics",
        teacherId: parsed.teacherId,
        teacherName: "Boma Hart",
        assessmentType: parsed.assessmentType,
        maxScore: parsed.maxScore,
        weight: parsed.weight,
        assessmentDate: parsed.assessmentDate.toISOString(),
        submissionMode: parsed.submissionMode,
        status: parsed.status,
        candidateCount: 3,
        enteredCount: 0,
        candidates: []
      };
    }

    const term = parsed.termId
      ? await prisma.term.findFirst({ where: { id: parsed.termId, schoolId: session.schoolId }, include: { academicSession: true } })
      : await prisma.term.findFirst({ where: { schoolId: session.schoolId, isCurrent: true }, include: { academicSession: true } });
    if (!term) throw new NotFoundException("No valid term is configured for this assessment.");
    const { classRoom, subject } = await this.resolveClassAndSubject(session.schoolId, parsed);
    const teacher = parsed.teacherId
      ? await prisma.user.findFirst({ where: { id: parsed.teacherId, schoolId: session.schoolId } })
      : null;
    if (parsed.teacherId && !teacher) throw new BadRequestException("Selected teacher does not exist in this school.");

    const assessment = await prisma.academicAssessment.create({
      data: {
        schoolId: session.schoolId,
        academicSessionId: parsed.academicSessionId ?? term.academicSessionId,
        termId: term.id,
        classId: classRoom.id,
        subjectId: subject.id,
        teacherId: parsed.teacherId,
        createdById: session.userId,
        title: parsed.title,
        arm: parsed.arm ?? classRoom.arm,
        assessmentType: parsed.assessmentType,
        maxScore: parsed.maxScore,
        weight: parsed.weight,
        assessmentDate: parsed.assessmentDate,
        submissionMode: parsed.submissionMode,
        status: parsed.status
      },
      include: {
        term: { include: { academicSession: true } },
        classRoom: true,
        subject: true,
        teacher: true,
        _count: { select: { candidates: true } }
      }
    });

    await this.generateAssessmentCandidates(session, assessment.id);
    await this.notifyAcademicWorkflow({
      schoolId: session.schoolId,
      userId: parsed.teacherId,
      title: "Assessment assigned",
      body: `${assessment.title} has been created for ${formatClassName(assessment.classRoom)} ${assessment.subject.name}.`,
      metadata: { assessmentId: assessment.id, classId: assessment.classId, subjectId: assessment.subjectId }
    });
    const hydrated = await prisma.academicAssessment.findUniqueOrThrow({
      where: { id: assessment.id },
      include: {
        term: { include: { academicSession: true } },
        classRoom: true,
        subject: true,
        teacher: true,
        candidates: { include: { student: true, enteredBy: true, lastEditedBy: true }, orderBy: { student: { lastName: "asc" } } },
        _count: { select: { candidates: true } }
      }
    });
    return this.mapAssessment(hydrated);
  }

  async listAcademicAssessments(session: SessionPayload): Promise<AcademicAssessmentView[]> {
    if (env.DEMO_MODE) {
      return [
        {
          id: "asm_second_term_math",
          title: "Second Term Mathematics Test 2",
          term: "Second Term",
          session: "2025/2026",
          classId: "class_jss2_gold",
          className: "JSS 2 - Gold",
          arm: "Gold",
          subjectId: "subject_math",
          subject: "Mathematics",
          teacherId: "user_teacher",
          teacherName: "Boma Hart",
          assessmentType: "TEST",
          maxScore: 20,
          weight: 20,
          assessmentDate: new Date("2026-04-18T09:00:00.000Z").toISOString(),
          submissionMode: "PAPER",
          status: "ACTIVE",
          candidateCount: 3,
          enteredCount: 2
        }
      ];
    }

    const assessments = await prisma.academicAssessment.findMany({
      where: {
        schoolId: session.schoolId,
        ...(canTeacherScoreRole(session.role) ? { OR: [{ teacherId: session.userId }, { createdById: session.userId }] } : {})
      },
      include: {
        term: { include: { academicSession: true } },
        classRoom: true,
        subject: true,
        teacher: true,
        candidates: { include: { student: true, enteredBy: true, lastEditedBy: true } },
        _count: { select: { candidates: true } }
      },
      orderBy: [{ assessmentDate: "desc" }, { createdAt: "desc" }],
      take: 200
    });

    return assessments.map((assessment) => this.mapAssessment(assessment));
  }

  async getAcademicAssessment(session: SessionPayload, assessmentId: string): Promise<AcademicAssessmentView> {
    if (env.DEMO_MODE) {
      const assessment = (await this.listAcademicAssessments(session))[0];
      return {
        ...assessment,
        id: assessmentId,
        candidates: getDemoStore().students.slice(0, 3).map((student, index) => ({
          id: `candidate_${student.id}`,
          studentId: student.id,
          studentName: student.fullName,
          admissionNumber: student.admissionNumber,
          attendanceState: index === 2 ? "EXCUSED" : "PRESENT",
          score: index === 0 ? 16 : index === 1 ? 14 : undefined,
          scoreFlag: index === 2 ? "ABSENT" : "NONE",
          comment: index === 2 ? "Excused by sick bay note" : undefined
        }))
      };
    }

    const assessment = await prisma.academicAssessment.findFirst({
      where: { id: assessmentId, schoolId: session.schoolId },
      include: {
        term: { include: { academicSession: true } },
        classRoom: true,
        subject: true,
        teacher: true,
        candidates: {
          include: { student: true, enteredBy: true, lastEditedBy: true },
          orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }]
        },
        _count: { select: { candidates: true } }
      }
    });
    if (!assessment) throw new NotFoundException("Assessment not found.");
    if (canTeacherScoreRole(session.role) && assessment.teacherId && assessment.teacherId !== session.userId && assessment.createdById !== session.userId) {
      throw new ForbiddenException("Teachers can view only their assigned assessments.");
    }
    return this.mapAssessment(assessment);
  }

  async generateAssessmentCandidates(session: SessionPayload, assessmentId: string) {
    if (env.DEMO_MODE) return { generated: 3 };

    const assessment = await prisma.academicAssessment.findFirst({
      where: { id: assessmentId, schoolId: session.schoolId }
    });
    if (!assessment) throw new NotFoundException("Assessment not found.");

    const students = await prisma.student.findMany({
      where: { schoolId: session.schoolId, currentClassId: assessment.classId, status: "ACTIVE" },
      select: { id: true }
    });
    if (students.length === 0) return { generated: 0 };

    await prisma.assessmentCandidate.createMany({
      data: students.map((student) => ({
        schoolId: session.schoolId,
        assessmentId,
        studentId: student.id,
        attendanceState: "PRESENT",
        scoreFlag: "NONE"
      })),
      skipDuplicates: true
    });

    return { generated: students.length };
  }

  async recordAssessmentScores(session: SessionPayload, payload: unknown): Promise<AcademicAssessmentView> {
    const parsed = assessmentScoresSchema.parse(payload);
    if (env.DEMO_MODE) {
      return this.getAcademicAssessment(session, parsed.assessmentId);
    }

    const assessment = await prisma.academicAssessment.findFirst({
      where: { id: parsed.assessmentId, schoolId: session.schoolId },
      include: { classRoom: true, subject: true, term: true }
    });
    if (!assessment) throw new NotFoundException("Assessment not found.");
    await this.assertTeacherCanScore(session, assessment.classId, assessment.subjectId);

    if (["APPROVED", "PUBLISHED"].includes(assessment.status) && !isFinalAcademicApprover(session)) {
      throw new ForbiddenException("Approved or published assessments cannot be edited without a controlled correction workflow.");
    }

    const componentCode = this.assessmentComponentCode(assessment);
    const component = await prisma.assessmentComponent.upsert({
      where: { schoolId_code: { schoolId: session.schoolId, code: componentCode } },
      update: { name: assessment.title, weight: assessment.weight, maxScore: assessment.maxScore, isActive: true },
      create: {
        schoolId: session.schoolId,
        termId: assessment.termId,
        name: assessment.title,
        code: componentCode,
        weight: assessment.weight,
        maxScore: assessment.maxScore,
        order: assessment.assessmentType === "EXAMINATION" ? 99 : 10,
        isActive: true
      }
    });

    for (const score of parsed.scores) {
      if (score.score !== undefined && score.score > assessment.maxScore) {
        throw new BadRequestException(`Score for student ${score.studentId} cannot exceed ${assessment.maxScore}.`);
      }
      const student = await prisma.student.findFirst({
        where: { id: score.studentId, schoolId: session.schoolId, currentClassId: assessment.classId },
        include: { currentClass: true }
      });
      if (!student) throw new BadRequestException("Every score must belong to a student in the assessment class.");

      const resultSheet = await prisma.resultSheet.upsert({
        where: { studentId_termId: { studentId: student.id, termId: assessment.termId } },
        update: { classId: assessment.classId },
        create: {
          schoolId: session.schoolId,
          studentId: student.id,
          termId: assessment.termId,
          classId: assessment.classId,
          createdById: session.userId,
          totalScore: 0,
          averageScore: 0,
          status: "DRAFT"
        }
      });

      const existingScore = await prisma.scoreEntry.findFirst({
        where: {
          schoolId: session.schoolId,
          resultSheetId: resultSheet.id,
          subjectId: assessment.subjectId,
          assessmentComponentId: component.id
        }
      });
      const scoreValue = score.attendanceState === "PRESENT" && score.score !== undefined ? score.score : 0;
      const scoreEntry = existingScore
        ? await prisma.scoreEntry.update({
            where: { id: existingScore.id },
            data: {
              score: scoreValue,
              maxScore: assessment.maxScore,
              enteredById: session.userId,
              isDraft: true
            }
          })
        : await prisma.scoreEntry.create({
            data: {
              schoolId: session.schoolId,
              studentId: student.id,
              resultSheetId: resultSheet.id,
              subjectId: assessment.subjectId,
              assessmentComponentId: component.id,
              enteredById: session.userId,
              score: scoreValue,
              maxScore: assessment.maxScore,
              isDraft: true
            }
          });

      const candidate = await prisma.assessmentCandidate.upsert({
        where: { assessmentId_studentId: { assessmentId: assessment.id, studentId: student.id } },
        update: {
          scoreEntryId: scoreEntry.id,
          attendanceState: score.attendanceState,
          score: score.score,
          scoreFlag: score.scoreFlag,
          comment: score.comment,
          enteredById: session.userId,
          lastEditedById: session.userId,
          enteredAt: existingScore ? undefined : new Date()
        },
        create: {
          schoolId: session.schoolId,
          assessmentId: assessment.id,
          studentId: student.id,
          scoreEntryId: scoreEntry.id,
          attendanceState: score.attendanceState,
          score: score.score,
          scoreFlag: score.scoreFlag,
          comment: score.comment,
          enteredById: session.userId,
          lastEditedById: session.userId,
          enteredAt: new Date()
        }
      });
      await prisma.assessmentScoreAudit.create({
        data: {
          schoolId: session.schoolId,
          assessmentId: assessment.id,
          candidateId: candidate.id,
          scoreEntryId: scoreEntry.id,
          actorId: session.userId,
          previousScore: existingScore?.score,
          newScore: score.score,
          action: existingScore ? "SCORE_UPDATED" : "SCORE_ENTERED",
          note: score.comment
        }
      });

      const allEntries = await prisma.scoreEntry.findMany({
        where: { schoolId: session.schoolId, resultSheetId: resultSheet.id },
        include: { assessmentComponent: true }
      });
      const bySubject = new Map<string, number>();
      for (const entry of allEntries) {
        bySubject.set(entry.subjectId, (bySubject.get(entry.subjectId) ?? 0) + entry.score);
      }
      const totals = Array.from(bySubject.values());
      const totalScore = totals.reduce((sum, value) => sum + value, 0);
      const averageScore = totals.length ? Number((totalScore / totals.length).toFixed(2)) : 0;
      const band = resolveGradeLabel(averageScore || totalScore, nigerianTermGradeBands);
      await prisma.resultSheet.update({
        where: { id: resultSheet.id },
        data: { totalScore, averageScore, grade: band.label }
      });
    }

    const remaining = await prisma.assessmentCandidate.count({
      where: { assessmentId: assessment.id, score: null, attendanceState: "PRESENT" }
    });
    await prisma.academicAssessment.update({
      where: { id: assessment.id },
      data: { status: remaining === 0 ? "MARKED" : assessment.status }
    });
    if (remaining === 0) {
      await this.notifyAcademicWorkflow({
        schoolId: session.schoolId,
        title: "Scores ready for moderation",
        body: `${assessment.title} scores are complete and ready for HOD/class teacher review.`,
        metadata: { assessmentId: assessment.id, classId: assessment.classId, subjectId: assessment.subjectId }
      });
    }

    return this.getAcademicAssessment(session, assessment.id);
  }

  async compileBroadsheet(session: SessionPayload, payload: unknown): Promise<BroadsheetView> {
    assertAcademicApprover(session);
    const parsed = broadsheetCompileSchema.parse(payload);
    if (env.DEMO_MODE) {
      return {
        id: `broad_${parsed.classId}`,
        classId: parsed.classId,
        className: "JSS 2 - Gold",
        term: "Second Term",
        session: "2025/2026",
        status: "IN_REVIEW",
        approvalStage: "EXAM_OFFICER",
        rankingEnabled: parsed.rankingEnabled,
        missingScoreWarnings: [],
        rows: getDemoStore().grades.map((grade, index) => ({
          studentId: grade.studentId,
          studentName: grade.studentName,
          subjects: [{ subject: grade.subject, caTotal: grade.continuousAssessment, examTotal: grade.exam, total: grade.total, grade: grade.grade, remark: grade.remark }],
          total: grade.total,
          average: grade.total,
          position: index + 1,
          promotionStatus: grade.total >= 40 ? "Promoted / Good standing" : "Review required"
        })),
        approvals: []
      };
    }

    const term = parsed.termId
      ? await prisma.term.findFirst({ where: { id: parsed.termId, schoolId: session.schoolId }, include: { academicSession: true } })
      : await prisma.term.findFirst({ where: { schoolId: session.schoolId, isCurrent: true }, include: { academicSession: true } });
    if (!term) throw new NotFoundException("No valid term was found for broadsheet compilation.");

    const [classRoom, students, classSubjects, sheets] = await Promise.all([
      prisma.classRoom.findFirst({ where: { id: parsed.classId, schoolId: session.schoolId } }),
      prisma.student.findMany({
        where: { schoolId: session.schoolId, currentClassId: parsed.classId, status: "ACTIVE" },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
      }),
      prisma.classSubject.findMany({ where: { schoolId: session.schoolId, classId: parsed.classId }, include: { subject: true } }),
      prisma.resultSheet.findMany({
        where: { schoolId: session.schoolId, termId: term.id, classId: parsed.classId },
        include: { scoreEntries: { include: { subject: true, assessmentComponent: true } } }
      })
    ]);
    if (!classRoom) throw new NotFoundException("Class not found.");

    const sheetByStudent = new Map(sheets.map((sheet) => [sheet.studentId, sheet]));
    const warnings: string[] = [];
    const rows = students.map((student) => {
      const sheet = sheetByStudent.get(student.id);
      const subjects = classSubjects.map((classSubject) => {
        const entries = sheet?.scoreEntries.filter((entry) => entry.subjectId === classSubject.subjectId) ?? [];
        const caTotal = Number(entries.filter((entry) => !entry.assessmentComponent.code.startsWith("EXAM")).reduce((sum, entry) => sum + entry.score, 0).toFixed(2));
        const examTotal = Number(entries.filter((entry) => entry.assessmentComponent.code.startsWith("EXAM")).reduce((sum, entry) => sum + entry.score, 0).toFixed(2));
        const total = Number((caTotal + examTotal).toFixed(2));
        if (entries.length === 0) {
          warnings.push(`${formatStudentName(student)} is missing ${classSubject.subject.name}.`);
        }
        const band = resolveGradeLabel(total, nigerianTermGradeBands);
        return { subject: classSubject.subject.name, caTotal, examTotal, total, grade: band.label, remark: band.remark };
      });
      const total = Number(subjects.reduce((sum, subject) => sum + subject.total, 0).toFixed(2));
      const average = subjects.length ? Number((total / subjects.length).toFixed(2)) : 0;
      return {
        studentId: student.id,
        studentName: formatStudentName(student),
        admissionNumber: student.admissionNumber,
        subjects,
        total,
        average,
        attendance: "See attendance register",
        classTeacherRemark: sheet?.teacherComment ?? undefined,
        principalRemark: sheet?.principalComment ?? undefined,
        promotionStatus: average >= 40 ? "Promoted / Good standing" : "Review required"
      };
    });

    const rankedRows = parsed.rankingEnabled
      ? [...rows]
          .sort((left, right) => right.average - left.average)
          .map((row, index) => ({ ...row, position: index + 1 }))
      : rows;
    const data = { rows: rankedRows, generatedAt: new Date().toISOString() };
    const broadsheet = await prisma.broadsheet.upsert({
      where: { schoolId_termId_classId: { schoolId: session.schoolId, termId: term.id, classId: parsed.classId } },
      update: {
        academicSessionId: term.academicSessionId,
        compiledById: session.userId,
        status: warnings.length ? "DRAFT" : "IN_REVIEW",
        approvalStage: "EXAM_OFFICER",
        rankingEnabled: parsed.rankingEnabled,
        missingScoreWarnings: warnings,
        data
      },
      create: {
        schoolId: session.schoolId,
        academicSessionId: term.academicSessionId,
        termId: term.id,
        classId: parsed.classId,
        compiledById: session.userId,
        status: warnings.length ? "DRAFT" : "IN_REVIEW",
        approvalStage: "EXAM_OFFICER",
        rankingEnabled: parsed.rankingEnabled,
        missingScoreWarnings: warnings,
        data
      },
      include: { classRoom: true, term: { include: { academicSession: true } }, approvals: { include: { actor: true } } }
    });

    if (!warnings.length) {
      await prisma.broadsheetApprovalHistory.create({
        data: {
          schoolId: session.schoolId,
          broadsheetId: broadsheet.id,
          actorId: session.userId,
          stage: "EXAM_OFFICER",
          action: "COMPILE",
          note: "Broadsheet compiled with all required subject scores."
        }
      });
      await Promise.all(
        rankedRows.map((row) =>
          prisma.reportCard.upsert({
            where: { schoolId_studentId_termId: { schoolId: session.schoolId, studentId: row.studentId, termId: term.id } },
            update: { broadsheetId: broadsheet.id, classId: parsed.classId, generatedById: session.userId, status: "GENERATED", data: row },
            create: {
              schoolId: session.schoolId,
              broadsheetId: broadsheet.id,
              studentId: row.studentId,
              academicSessionId: term.academicSessionId,
              termId: term.id,
              classId: parsed.classId,
              generatedById: session.userId,
              status: "GENERATED",
              data: row
            }
          })
        )
      );
      await this.notifyAcademicWorkflow({
        schoolId: session.schoolId,
        title: "Broadsheet ready for review",
        body: `${formatClassName(classRoom)} broadsheet is ready for VP Academics and Principal review.`,
        metadata: { broadsheetId: broadsheet.id, classId: parsed.classId, termId: term.id }
      });
    }

    const hydrated = await prisma.broadsheet.findUniqueOrThrow({
      where: { id: broadsheet.id },
      include: { classRoom: true, term: { include: { academicSession: true } }, approvals: { include: { actor: true }, orderBy: { createdAt: "desc" } } }
    });
    return this.mapBroadsheet(hydrated);
  }

  async listBroadsheets(session: SessionPayload): Promise<BroadsheetView[]> {
    assertAcademicApprover(session);
    if (env.DEMO_MODE) {
      return [
        {
          id: "broad_jss2_gold",
          classId: "class_jss2_gold",
          className: "JSS 2 - Gold",
          term: "Second Term",
          session: "2025/2026",
          status: "IN_REVIEW",
          approvalStage: "VICE_PRINCIPAL_ACADEMICS",
          rankingEnabled: true,
          missingScoreWarnings: [],
          rows: [
            {
              studentId: "stu_1",
              studentName: "Daniel Yusuf",
              admissionNumber: "GFC/26/0001",
              subjects: [{ subject: "Mathematics", caTotal: 32, examTotal: 48, total: 80, grade: "A", remark: "Excellent" }],
              total: 80,
              average: 80,
              position: 1,
              attendance: "93%",
              promotionStatus: "Promoted / Good standing"
            }
          ],
          approvals: []
        }
      ];
    }

    const broadsheets = await prisma.broadsheet.findMany({
      where: { schoolId: session.schoolId },
      include: { classRoom: true, term: { include: { academicSession: true } }, approvals: { include: { actor: true }, orderBy: { createdAt: "desc" } } },
      orderBy: [{ updatedAt: "desc" }],
      take: 100
    });

    return broadsheets.map((broadsheet) => this.mapBroadsheet(broadsheet));
  }

  async getBroadsheet(session: SessionPayload, broadsheetId: string): Promise<BroadsheetView> {
    assertAcademicApprover(session);
    if (env.DEMO_MODE) {
      return { ...(await this.listBroadsheets(session))[0], id: broadsheetId };
    }

    const broadsheet = await prisma.broadsheet.findFirst({
      where: { id: broadsheetId, schoolId: session.schoolId },
      include: { classRoom: true, term: { include: { academicSession: true } }, approvals: { include: { actor: true }, orderBy: { createdAt: "desc" } } }
    });
    if (!broadsheet) throw new NotFoundException("Broadsheet not found.");
    return this.mapBroadsheet(broadsheet);
  }

  async reviewBroadsheet(session: SessionPayload, payload: unknown): Promise<BroadsheetView> {
    assertAcademicApprover(session);
    const parsed = broadsheetActionSchema.parse(payload);
    if (env.DEMO_MODE) {
      const broadsheet = await this.getBroadsheet(session, parsed.broadsheetId);
      return {
        ...broadsheet,
        status: parsed.action === "PUBLISH" ? "PUBLISHED" : broadsheet.status,
        approvalStage: parsed.action === "PUBLISH" ? "PUBLISHED" : getNextAcademicApprovalStage(broadsheet.approvalStage),
        approvals: [
          {
            id: randomUUID(),
            actorName: session.name,
            stage: broadsheet.approvalStage,
            action: parsed.action,
            note: parsed.note,
            createdAt: new Date().toISOString()
          },
          ...broadsheet.approvals
        ]
      };
    }

    const broadsheet = await prisma.broadsheet.findFirst({
      where: { id: parsed.broadsheetId, schoolId: session.schoolId }
    });
    if (!broadsheet) throw new NotFoundException("Broadsheet not found.");
    if (!canAdvanceAcademicApproval(broadsheet.approvalStage, parsed.action)) {
      throw new BadRequestException(`Cannot ${parsed.action.toLowerCase().replaceAll("_", " ")} from ${broadsheet.approvalStage}.`);
    }
    if (parsed.action === "PUBLISH" || (broadsheet.approvalStage === "PRINCIPAL" && parsed.action === "APPROVE")) {
      assertFinalAcademicApprover(session);
    }
    if (parsed.action === "PUBLISH" && broadsheet.status !== "APPROVED") {
      throw new BadRequestException("Broadsheet must be approved before publishing report cards.");
    }

    const now = new Date();
    const nextStage = parsed.action === "APPROVE" ? getNextAcademicApprovalStage(broadsheet.approvalStage) : broadsheet.approvalStage;
    const data =
      parsed.action === "REJECT" || parsed.action === "REQUEST_CORRECTION"
        ? { status: "CORRECTION_REQUESTED" as const }
        : parsed.action === "PUBLISH"
          ? { status: "PUBLISHED" as const, approvalStage: "PUBLISHED" as const, publishedAt: now, lockedAt: now }
          : parsed.action === "UNLOCK"
            ? { status: "APPROVED" as const, approvalStage: "PRINCIPAL" as const, lockedAt: null, publishedAt: null }
            : {
                status: nextStage === "PUBLISHED" ? ("APPROVED" as const) : ("IN_REVIEW" as const),
                approvalStage: nextStage,
                approvedAt: nextStage === "PUBLISHED" ? now : broadsheet.approvedAt
              };

    const updated = await prisma.broadsheet.update({
      where: { id: broadsheet.id },
      data,
      include: { classRoom: true, term: { include: { academicSession: true } }, approvals: { include: { actor: true }, orderBy: { createdAt: "desc" } } }
    });
    await prisma.broadsheetApprovalHistory.create({
      data: {
        schoolId: session.schoolId,
        broadsheetId: broadsheet.id,
        actorId: session.userId,
        stage: broadsheet.approvalStage,
        action: parsed.action,
        note: parsed.note
      }
    });
    if (parsed.action === "PUBLISH") {
      await prisma.reportCard.updateMany({
        where: { schoolId: session.schoolId, broadsheetId: broadsheet.id },
        data: { status: "PUBLISHED", publishedAt: now, lockedAt: now }
      });
      await prisma.resultSheet.updateMany({
        where: { schoolId: session.schoolId, termId: broadsheet.termId, classId: broadsheet.classId },
        data: { status: "PUBLISHED", publishedAt: now, lockedAt: now }
      });
    }
    await this.notifyAcademicWorkflow({
      schoolId: session.schoolId,
      title: parsed.action === "PUBLISH" ? "Results published" : "Broadsheet review updated",
      body: `Broadsheet ${parsed.action.toLowerCase().replaceAll("_", " ")} by ${session.name}.`,
      metadata: { broadsheetId: broadsheet.id, action: parsed.action, stage: broadsheet.approvalStage }
    });

    return this.mapBroadsheet({
      ...updated,
      approvals: await prisma.broadsheetApprovalHistory.findMany({
        where: { broadsheetId: broadsheet.id },
        include: { actor: true },
        orderBy: { createdAt: "desc" }
      })
    });
  }

  async listReportCards(session: SessionPayload): Promise<ReportCardView[]> {
    assertAcademicApprover(session);
    if (env.DEMO_MODE) {
      return getDemoStore().grades.map((grade) => ({
        id: `report_${grade.studentId}`,
        studentId: grade.studentId,
        studentName: grade.studentName,
        className: grade.className,
        term: "Second Term",
        session: "2025/2026",
        status: grade.published ? "PUBLISHED" : "GENERATED",
        total: grade.total,
        average: grade.total,
        grade: grade.grade,
        reportCardUrl: `/api/v1/reports/report-card/${grade.studentId}`
      }));
    }

    const cards = await prisma.reportCard.findMany({
      where: { schoolId: session.schoolId },
      include: { student: true, classRoom: true, term: { include: { academicSession: true } } },
      orderBy: [{ updatedAt: "desc" }],
      take: 200
    });
    return cards.map((card) => {
      const data = card.data as { total?: number; average?: number; subjects?: Array<{ grade?: string }> };
      return {
        id: card.id,
        studentId: card.studentId,
        studentName: formatStudentName(card.student),
        className: formatClassName(card.classRoom),
        term: card.term.name,
        session: card.term.academicSession?.name,
        status: card.status,
        total: Number(data.total ?? 0),
        average: Number(data.average ?? 0),
        grade: data.subjects?.[0]?.grade,
        reportCardUrl: `/api/v1/reports/report-card/${card.studentId}`,
        publishedAt: card.publishedAt?.toISOString()
      };
    });
  }

  async submitScoreSheet(session: SessionPayload, payload: unknown) {
    const parsed = resultActionSchema.parse(payload);
    const sheet = await prisma.resultSheet.findFirst({
      where: { id: parsed.resultSheetId, schoolId: session.schoolId },
      include: { scoreEntries: true }
    });
    if (!sheet) throw new NotFoundException("Result sheet not found.");
    if (sheet.scoreEntries.length === 0) throw new BadRequestException("Cannot submit a score sheet without scores.");
    if (session.role === "TEACHER" && sheet.createdById !== session.userId) {
      throw new ForbiddenException("Teachers can submit only score sheets they created.");
    }

    await prisma.scoreEntry.updateMany({
      where: { resultSheetId: sheet.id },
      data: { isDraft: false, submittedAt: new Date() }
    });
    return this.setResultStatus(session, parsed.resultSheetId, "SUBMITTED", "SUBMIT", parsed.note);
  }

  async approveScoreSheet(session: SessionPayload, payload: unknown) {
    assertAcademicApprover(session);
    const parsed = resultActionSchema.parse(payload);
    const sheet = await prisma.resultSheet.findFirst({ where: { id: parsed.resultSheetId, schoolId: session.schoolId } });
    if (!sheet) throw new NotFoundException("Result sheet not found.");
    const target: ResultWorkflowStatus = sheet.status === "SUBMITTED" ? "UNDER_REVIEW" : "APPROVED";
    if (target === "UNDER_REVIEW") {
      await this.setResultStatus(session, parsed.resultSheetId, "UNDER_REVIEW", "REVIEW", "Moved into review.");
    }
    return this.setResultStatus(session, parsed.resultSheetId, "APPROVED", "APPROVE", parsed.note, {
      principalComment: parsed.principalComment
    });
  }

  async rejectScoreSheet(session: SessionPayload, payload: unknown) {
    assertAcademicApprover(session);
    const parsed = resultActionSchema.parse(payload);
    return this.setResultStatus(session, parsed.resultSheetId, "RETURNED", "RETURN", parsed.note ?? "Returned for correction.");
  }

  async compileResults(session: SessionPayload, payload: unknown) {
    assertAcademicApprover(session);
    const parsed = compileResultsSchema.parse(payload ?? {});
    const termId = parsed.termId ?? (await this.currentTerm(session.schoolId)).id;
    const scheme = await this.activeScheme(session.schoolId);
    const sheets = await prisma.resultSheet.findMany({
      where: { schoolId: session.schoolId, termId, ...(parsed.classId ? { classId: parsed.classId } : {}) },
      include: { scoreEntries: true }
    });

    const updates = [];
    for (const sheet of sheets) {
      const bySubject = new Map<string, number>();
      for (const score of sheet.scoreEntries) {
        bySubject.set(score.subjectId, (bySubject.get(score.subjectId) ?? 0) + score.score);
      }
      const totals = Array.from(bySubject.values());
      const average = totals.length === 0 ? 0 : Number((totals.reduce((sum, value) => sum + value, 0) / totals.length).toFixed(2));
      const band = this.resolveBand(average, scheme);
      updates.push({ id: sheet.id, studentId: sheet.studentId, classId: sheet.classId, average, grade: band.label });
    }

    const positions = scheme?.rankingEnabled === false ? [] : [...updates].sort((a, b) => b.average - a.average);
    for (const update of updates) {
      const position = positions.findIndex((item) => item.id === update.id) + 1;
      await prisma.resultSheet.update({
        where: { id: update.id },
        data: {
          totalScore: update.average,
          averageScore: update.average,
          grade: update.grade,
          position: position > 0 ? position : null,
          gradingSchemeId: scheme?.id
        }
      });
    }

    return { compiled: updates.length, rankingEnabled: scheme?.rankingEnabled ?? true };
  }

  async publishResults(session: SessionPayload, payload: unknown) {
    assertAcademicApprover(session);
    const parsed = publishResultsSchema.parse(payload ?? {});
    const termId = parsed.termId ?? (await this.currentTerm(session.schoolId)).id;
    const sheets = await prisma.resultSheet.findMany({
      where: {
        schoolId: session.schoolId,
        termId,
        ...(parsed.classId ? { classId: parsed.classId } : {}),
        status: "APPROVED"
      }
    });
    if (sheets.length === 0) throw new BadRequestException("No approved results are available to publish.");

    const now = new Date();
    await prisma.resultSheet.updateMany({
      where: { id: { in: sheets.map((sheet) => sheet.id) } },
      data: { status: "PUBLISHED", publishedAt: now, lockedAt: now }
    });
    await prisma.resultPublication.create({
      data: {
        schoolId: session.schoolId,
        termId,
        classId: parsed.classId,
        publishedById: session.userId,
        note: parsed.note,
        resultCount: sheets.length
      }
    });

    for (const sheet of sheets) {
      await this.recordApproval({
        schoolId: session.schoolId,
        resultSheetId: sheet.id,
        actorId: session.userId,
        action: "PUBLISH",
        fromStatus: sheet.status as ResultWorkflowStatus,
        toStatus: "PUBLISHED",
        note: parsed.note
      });
    }

    return { published: sheets.length };
  }

  async unpublishResults(session: SessionPayload, payload: unknown) {
    assertAcademicApprover(session);
    const parsed = publishResultsSchema.parse(payload ?? {});
    const termId = parsed.termId ?? (await this.currentTerm(session.schoolId)).id;
    const sheets = await prisma.resultSheet.findMany({
      where: {
        schoolId: session.schoolId,
        termId,
        ...(parsed.classId ? { classId: parsed.classId } : {}),
        status: "PUBLISHED"
      }
    });
    await prisma.resultSheet.updateMany({
      where: { id: { in: sheets.map((sheet) => sheet.id) } },
      data: { status: "APPROVED", publishedAt: null, lockedAt: null }
    });
    await prisma.resultPublication.updateMany({
      where: { schoolId: session.schoolId, termId, ...(parsed.classId ? { classId: parsed.classId } : {}), unpublishedAt: null },
      data: { unpublishedAt: new Date(), note: parsed.note }
    });

    for (const sheet of sheets) {
      await this.recordApproval({
        schoolId: session.schoolId,
        resultSheetId: sheet.id,
        actorId: session.userId,
        action: "UNPUBLISH",
        fromStatus: "PUBLISHED",
        toStatus: "APPROVED",
        note: parsed.note
      });
    }

    return { unpublished: sheets.length };
  }

  async listApprovalQueue(session: SessionPayload): Promise<ResultApprovalView[]> {
    assertAcademicApprover(session);
    if (env.DEMO_MODE) return [];

    const sheets = await prisma.resultSheet.findMany({
      where: { schoolId: session.schoolId, status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "RETURNED"] } },
      include: {
        student: true,
        classRoom: true,
        approvals: { include: { actor: true }, orderBy: { createdAt: "desc" }, take: 1 }
      },
      orderBy: [{ status: "asc" }, { submittedAt: "desc" }],
      take: 100
    });

    return sheets.map((sheet) => {
      const approval = sheet.approvals[0];
      return {
        id: approval?.id ?? sheet.id,
        resultSheetId: sheet.id,
        studentName: formatStudentName(sheet.student),
        className: formatClassName(sheet.classRoom),
        status: sheet.status,
        action: approval?.action ?? "PENDING",
        actorName: approval?.actor ? `${approval.actor.firstName} ${approval.actor.lastName}` : "Awaiting review",
        note: approval?.note ?? undefined,
        createdAt: (approval?.createdAt ?? sheet.submittedAt ?? new Date()).toISOString()
      };
    });
  }

  async getResultAnalytics(session: SessionPayload): Promise<ResultAnalyticsView> {
    if (env.DEMO_MODE) {
      const grades = getDemoStore().grades;
      return {
        metrics: [
          { label: "Score entries", value: String(grades.length), tone: "neutral" },
          { label: "Average score", value: `${Math.round(grades.reduce((sum, item) => sum + item.total, 0) / Math.max(grades.length, 1))}%`, tone: "success" }
        ],
        classSummaries: [],
        subjectSummaries: [],
        statusBreakdown: [],
        missingScores: []
      };
    }

    const [sheets, classSubjects, students] = await Promise.all([
      prisma.resultSheet.findMany({
        where: { schoolId: session.schoolId },
        include: { classRoom: true, scoreEntries: { include: { subject: true } } },
        take: 500
      }),
      prisma.classSubject.findMany({ where: { schoolId: session.schoolId }, include: { classRoom: true, subject: true } }),
      prisma.student.findMany({ where: { schoolId: session.schoolId, status: "ACTIVE" }, include: { currentClass: true } })
    ]);

    const statusCounts = new Map<string, number>();
    const classRows = new Map<string, { className: string; total: number; count: number; published: number; pending: number; missingScores: number }>();
    const subjectRows = new Map<string, { subject: string; total: number; count: number; passes: number }>();
    for (const sheet of sheets) {
      statusCounts.set(sheet.status, (statusCounts.get(sheet.status) ?? 0) + 1);
      const className = formatClassName(sheet.classRoom);
      const classRow = classRows.get(sheet.classId) ?? { className, total: 0, count: 0, published: 0, pending: 0, missingScores: 0 };
      classRow.total += Number(sheet.averageScore);
      classRow.count += 1;
      if (sheet.status === "PUBLISHED") classRow.published += 1;
      else classRow.pending += 1;
      classRows.set(sheet.classId, classRow);

      for (const entry of sheet.scoreEntries) {
        const subjectRow = subjectRows.get(entry.subjectId) ?? { subject: entry.subject.name, total: 0, count: 0, passes: 0 };
        subjectRow.total += entry.score;
        subjectRow.count += 1;
        if (entry.score >= 40) subjectRow.passes += 1;
        subjectRows.set(entry.subjectId, subjectRow);
      }
    }

    const scoredPairs = new Set(sheets.flatMap((sheet) => sheet.scoreEntries.map((entry) => `${sheet.studentId}:${entry.subjectId}`)));
    const missingScores = students.flatMap((student) =>
      classSubjects
        .filter((classSubject) => classSubject.classId === student.currentClassId)
        .filter((classSubject) => !scoredPairs.has(`${student.id}:${classSubject.subjectId}`))
        .map((classSubject) => ({
          studentName: formatStudentName(student),
          className: student.currentClass ? formatClassName(student.currentClass) : formatClassName(classSubject.classRoom),
          subject: classSubject.subject.name
        }))
    );

    return {
      metrics: [
        { label: "Result sheets", value: String(sheets.length), tone: "neutral" },
        { label: "Published", value: String(sheets.filter((sheet) => sheet.status === "PUBLISHED").length), tone: "success" },
        { label: "Pending review", value: String(sheets.filter((sheet) => ["SUBMITTED", "UNDER_REVIEW"].includes(sheet.status)).length), tone: "warning" },
        { label: "Missing scores", value: String(missingScores.length), tone: missingScores.length > 0 ? "warning" : "success" }
      ],
      classSummaries: Array.from(classRows.values()).map((row) => ({
        className: row.className,
        average: row.count === 0 ? 0 : Number((row.total / row.count).toFixed(1)),
        published: row.published,
        pending: row.pending,
        missingScores: row.missingScores
      })),
      subjectSummaries: Array.from(subjectRows.values()).map((row) => ({
        subject: row.subject,
        average: row.count === 0 ? 0 : Number((row.total / row.count).toFixed(1)),
        passRate: row.count === 0 ? 0 : Number(((row.passes / row.count) * 100).toFixed(1)),
        entries: row.count
      })),
      statusBreakdown: Array.from(statusCounts.entries()).map(([status, count]) => ({ status, count })),
      missingScores: missingScores.slice(0, 100)
    };
  }
}
