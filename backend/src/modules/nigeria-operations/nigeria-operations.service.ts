import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import {
  calculateCurriculumCompletion,
  calculateTotalMinutes,
  calculateTrainingCompliance,
  normalizeSchoolDay,
  resolveClockInStatus
} from "../../../../src/lib/domain/nigeria-operations";
import type {
  CurriculumSummaryView,
  CurriculumTopicView,
  NigeriaAcademicDefaultsView,
  NigeriaOperationsDashboardView,
  StaffAttendancePolicyView,
  StaffClockView,
  TrainingParticipantView,
  TrainingProgramView
} from "../../../../src/lib/domain/types";
import { formatNigeriaClassName, getNigeriaClassOptions } from "../../../../src/lib/school-options";
import { env } from "../../../../src/lib/utils/env";

const adminRoles = ["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER"] as const;
const trainingAdminRoles = ["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER"] as const;

const curriculumSchema = z.object({
  academicSessionId: z.string().optional(),
  termId: z.string().optional(),
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  teacherId: z.string().optional(),
  weekNumber: z.coerce.number().int().min(1).max(16),
  topic: z.string().min(3).max(180),
  subTopic: z.string().max(220).optional(),
  learningObjectives: z.string().max(2000).optional(),
  teacherNotes: z.string().max(2000).optional(),
  recommendedResources: z.string().max(2000).optional(),
  assignmentNote: z.string().max(1000).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("ACTIVE")
});

const curriculumProgressSchema = z.object({
  progressStatus: z.enum(["NOT_STARTED", "IN_PROGRESS", "TAUGHT", "COMPLETED"]),
  actualDateTaught: z.coerce.date().optional(),
  teacherNotes: z.string().max(2000).optional()
});

const attendancePolicySchema = z.object({
  resumptionTime: z.string().regex(/^\d{2}:\d{2}$/).default("07:45"),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/).default("15:30"),
  graceMinutes: z.coerce.number().int().min(0).max(120).default(10),
  timezone: z.string().min(3).max(80).default("Africa/Lagos")
});

const manualAttendanceSchema = z.object({
  userId: z.string().min(1),
  date: z.coerce.date().default(() => new Date()),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED", "ON_LEAVE", "OFFICIAL_DUTY"]),
  checkInAt: z.coerce.date().optional(),
  checkOutAt: z.coerce.date().optional(),
  notes: z.string().max(1000).optional()
});

const trainingSchema = z.object({
  title: z.string().min(4).max(180),
  description: z.string().max(3000).optional(),
  category: z
    .enum([
      "PEDAGOGY",
      "CLASSROOM_MANAGEMENT",
      "SUBJECT_MASTERY",
      "CHILD_PROTECTION",
      "ASSESSMENT_GRADING",
      "ICT_DIGITAL_LITERACY",
      "CURRICULUM_ORIENTATION",
      "COMPLIANCE_PROFESSIONAL_DEVELOPMENT"
    ])
    .default("PEDAGOGY"),
  trainingType: z.enum(["INTERNAL", "EXTERNAL", "ONLINE", "PHYSICAL", "BLENDED"]).default("INTERNAL"),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional(),
  durationHours: z.coerce.number().min(0.5).max(200).optional(),
  facilitator: z.string().max(180).optional(),
  provider: z.string().max(180).optional(),
  location: z.string().max(220).optional(),
  meetingLink: z.string().url().optional().or(z.literal("")),
  mandatory: z.coerce.boolean().default(false)
});

const participantSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1),
  notes: z.string().max(1000).optional()
});

const completeTrainingSchema = z.object({
  status: z.enum(["ATTENDED", "ABSENT", "COMPLETED", "OVERDUE"]).default("COMPLETED"),
  certificateUrl: z.string().url().optional().or(z.literal("")),
  cpdPoints: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().max(1000).optional(),
  feedback: z.string().max(2000).optional()
});

function assertAdmin(session: SessionPayload) {
  if (!adminRoles.includes(session.role as (typeof adminRoles)[number])) {
    throw new ForbiddenException("Only school leadership/admin can manage this operation.");
  }
}

function assertTrainingAdmin(session: SessionPayload) {
  if (!trainingAdminRoles.includes(session.role as (typeof trainingAdminRoles)[number])) {
    throw new ForbiddenException("Only school leadership/admin can manage teacher training.");
  }
}

function className(classRoom: { name: string; arm?: string | null }) {
  return formatNigeriaClassName(classRoom.arm ? `${classRoom.name} - ${classRoom.arm}` : classRoom.name);
}

function userName(user: { firstName: string; lastName: string }) {
  return `${user.firstName} ${user.lastName}`;
}

function isSchemaDriftError(error: unknown) {
  return error instanceof Error && /does not exist in the current database|column .* does not exist/i.test(error.message);
}

const staffAttendanceReadSelect = {
  id: true,
  userId: true,
  date: true,
  status: true,
  checkInAt: true,
  checkOutAt: true,
  notes: true,
  user: {
    select: {
      firstName: true,
      lastName: true
    }
  }
} as const;

@Injectable()
export class NigeriaOperationsService {
  private academicDefaults(): NigeriaAcademicDefaultsView {
    return {
      sessionLabel: "Academic Session",
      terms: ["First Term", "Second Term", "Third Term"],
      levels: ["ECCDE / Pre-primary", "Primary", "Junior Secondary (JSS)", "Senior Secondary (SSS)"],
      classAliases: getNigeriaClassOptions().flatMap((option) => [option.label, option.value.replace("_", "")])
    };
  }

  private async currentTerm(schoolId: string) {
    const term = await prisma.term.findFirst({
      where: { schoolId, isCurrent: true },
      include: { academicSession: true }
    });
    if (!term) throw new NotFoundException("No active Nigerian school term is configured.");
    return term;
  }

  private async policy(schoolId: string) {
    return prisma.staffAttendancePolicy.upsert({
      where: { schoolId },
      update: {},
      create: { schoolId, resumptionTime: "07:45", closingTime: "15:30", graceMinutes: 10, timezone: "Africa/Lagos" }
    });
  }

  private mapPolicy(policy: StaffAttendancePolicyView): StaffAttendancePolicyView {
    return {
      resumptionTime: policy.resumptionTime,
      closingTime: policy.closingTime,
      graceMinutes: policy.graceMinutes,
      timezone: policy.timezone
    };
  }

  private mapCurriculumTopic(topic: {
    id: string;
    weekNumber: number;
    topic: string;
    subTopic?: string | null;
    learningObjectives?: string | null;
    teacherNotes?: string | null;
    recommendedResources?: string | null;
    assignmentNote?: string | null;
    status: string;
    progressStatus: string;
    actualDateTaught?: Date | null;
    teacherId?: string | null;
    academicSession: { name: string };
    term: { name: string };
    classRoom: { id: string; name: string; arm?: string | null };
    subject: { id: string; name: string };
  }, teachers = new Map<string, string>()): CurriculumTopicView {
    return {
      id: topic.id,
      academicSession: topic.academicSession.name,
      term: topic.term.name,
      classId: topic.classRoom.id,
      className: className(topic.classRoom),
      subjectId: topic.subject.id,
      subject: topic.subject.name,
      weekNumber: topic.weekNumber,
      topic: topic.topic,
      subTopic: topic.subTopic ?? undefined,
      learningObjectives: topic.learningObjectives ?? undefined,
      teacherNotes: topic.teacherNotes ?? undefined,
      recommendedResources: topic.recommendedResources ?? undefined,
      assignmentNote: topic.assignmentNote ?? undefined,
      status: topic.status as CurriculumTopicView["status"],
      progressStatus: topic.progressStatus as CurriculumTopicView["progressStatus"],
      actualDateTaught: topic.actualDateTaught?.toISOString(),
      teacherName: topic.teacherId ? teachers.get(topic.teacherId) : undefined
    };
  }

  private async mapStaffAttendance(records: Array<{
    id: string;
    userId: string;
    date: Date;
    status: string;
    checkInAt?: Date | null;
    checkOutAt?: Date | null;
    totalMinutes?: number | null;
    notes?: string | null;
    user: { firstName: string; lastName: string };
  }>): Promise<StaffClockView[]> {
    return records.map((record) => ({
      id: record.id,
      userId: record.userId,
      teacherName: userName(record.user),
      date: record.date.toISOString(),
      status: record.status as StaffClockView["status"],
      checkInAt: record.checkInAt?.toISOString(),
      checkOutAt: record.checkOutAt?.toISOString(),
      totalMinutes: record.totalMinutes ?? undefined,
      notes: record.notes ?? undefined
    }));
  }

  private mapTraining(program: {
    id: string;
    title: string;
    description?: string | null;
    category: string;
    trainingType: string;
    startsAt: Date;
    endsAt?: Date | null;
    durationHours?: number | null;
    facilitator?: string | null;
    provider?: string | null;
    location?: string | null;
    meetingLink?: string | null;
    mandatory: boolean;
    participants?: Array<{ status: string }>;
  }): TrainingProgramView {
    const participants = program.participants ?? [];
    return {
      id: program.id,
      title: program.title,
      description: program.description ?? undefined,
      category: program.category as TrainingProgramView["category"],
      trainingType: program.trainingType as TrainingProgramView["trainingType"],
      startsAt: program.startsAt.toISOString(),
      endsAt: program.endsAt?.toISOString(),
      durationHours: program.durationHours ?? undefined,
      facilitator: program.facilitator ?? undefined,
      provider: program.provider ?? undefined,
      location: program.location ?? undefined,
      meetingLink: program.meetingLink ?? undefined,
      mandatory: program.mandatory,
      invitedCount: participants.length,
      completedCount: participants.filter((participant) => participant.status === "COMPLETED").length
    };
  }

  async getDashboard(session: SessionPayload): Promise<NigeriaOperationsDashboardView> {
    if (env.DEMO_MODE) {
      return {
        academicDefaults: this.academicDefaults(),
        curriculum: {
          totalTopics: 12,
          completionRate: 58.3,
          overdueTopics: 2,
          bySubject: [
            { subject: "Mathematics", className: "JSS 2 - Gold", totalTopics: 6, completionRate: 66.7 },
            { subject: "Biology", className: "SSS 1 - Emerald", totalTopics: 6, completionRate: 50 }
          ]
        },
        staffAttendance: {
          policy: { resumptionTime: "07:45", closingTime: "15:30", graceMinutes: 10, timezone: "Africa/Lagos" },
          totalMarkedToday: 24,
          lateToday: 3,
          absentToday: 1,
          records: []
        },
        training: {
          upcoming: [
            {
              id: "demo-training-1",
              title: "Second Term Scheme of Work Orientation",
              category: "CURRICULUM_ORIENTATION",
              trainingType: "INTERNAL",
              startsAt: "2026-04-18T09:00:00.000Z",
              mandatory: true,
              invitedCount: 18,
              completedCount: 9
            }
          ],
          complianceRate: 50,
          pendingMandatory: 9
        }
      };
    }

    const [curriculum, policy, todayRecords, trainings] = await Promise.all([
      this.listCurriculum(session).catch((error: unknown) => {
        if (isSchemaDriftError(error)) return [];
        throw error;
      }),
      this.policy(session.schoolId),
      prisma.staffAttendance.findMany({
        where: { schoolId: session.schoolId, date: normalizeSchoolDay(new Date()) },
        select: staffAttendanceReadSelect,
        orderBy: { checkInAt: "asc" }
      }),
      prisma.trainingProgram.findMany({
        where: { schoolId: session.schoolId, archivedAt: null },
        include: { participants: true },
        orderBy: { startsAt: "asc" },
        take: 5
      }).catch((error: unknown) => {
        if (isSchemaDriftError(error)) return [];
        throw error;
      })
    ]);
    const curriculumSummary = this.summarizeCurriculum(curriculum);
    const participants = trainings.flatMap((training) =>
      training.participants.map((participant) => ({ status: participant.status, mandatory: training.mandatory }))
    );

    return {
      academicDefaults: this.academicDefaults(),
      curriculum: curriculumSummary,
      staffAttendance: {
        policy: this.mapPolicy(policy),
        totalMarkedToday: todayRecords.length,
        lateToday: todayRecords.filter((record) => record.status === "LATE").length,
        absentToday: todayRecords.filter((record) => record.status === "ABSENT").length,
        records: await this.mapStaffAttendance(todayRecords)
      },
      training: {
        upcoming: trainings.map((training) => this.mapTraining(training)),
        complianceRate: calculateTrainingCompliance(participants),
        pendingMandatory: participants.filter((participant) => participant.mandatory && participant.status !== "COMPLETED").length
      }
    };
  }

  async listCurriculum(session: SessionPayload): Promise<CurriculumTopicView[]> {
    if (env.DEMO_MODE) {
      return [
        {
          id: "demo-curriculum-1",
          academicSession: "2025/2026",
          term: "Second Term",
          classId: "cls_jss2_gold",
          className: "JSS 2 - Gold",
          subjectId: "sub_math",
          subject: "Mathematics",
          weekNumber: 4,
          topic: "Simultaneous equations",
          subTopic: "Elimination method",
          learningObjectives: "Learners solve two-variable equations using elimination.",
          recommendedResources: "NERDC Basic Mathematics JSS2, pages 84-91.",
          assignmentNote: "Exercise 4A, questions 1-10.",
          status: "ACTIVE",
          progressStatus: "IN_PROGRESS",
          teacherName: "Boma Hart"
        }
      ];
    }

    let classIds: string[] | undefined;
    if (session.role === "STUDENT") {
      const student = await prisma.student.findFirst({
        where: { schoolId: session.schoolId, userId: session.userId },
        select: { currentClassId: true }
      });
      classIds = student?.currentClassId ? [student.currentClassId] : [];
    }
    if (session.role === "PARENT") {
      const guardian = await prisma.guardian.findFirst({
        where: { schoolId: session.schoolId, userId: session.userId },
        include: { students: { include: { student: { select: { currentClassId: true } } } } }
      });
      classIds = guardian?.students.flatMap((link) => (link.student.currentClassId ? [link.student.currentClassId] : [])) ?? [];
    }

    const where =
      session.role === "TEACHER"
        ? { schoolId: session.schoolId, OR: [{ teacherId: session.userId }, { teacherId: null, classRoom: { classSubjects: { some: { teacherId: session.userId } } } }] }
        : session.role === "PARENT" || session.role === "STUDENT"
          ? { schoolId: session.schoolId, classId: { in: classIds ?? [] }, status: "ACTIVE" as const }
          : { schoolId: session.schoolId };

    const topics = await prisma.curriculumTopic.findMany({
      where,
      include: { academicSession: true, term: true, classRoom: true, subject: true },
      orderBy: [{ term: { order: "asc" } }, { classRoom: { name: "asc" } }, { subject: { name: "asc" } }, { weekNumber: "asc" }]
    });
    const teacherIds = topics.map((topic) => topic.teacherId).filter(Boolean) as string[];
    const teachers = teacherIds.length
      ? new Map(
          (
            await prisma.user.findMany({
              where: { schoolId: session.schoolId, id: { in: teacherIds } },
              select: { id: true, firstName: true, lastName: true }
            })
          ).map((teacher) => [teacher.id, userName(teacher)])
        )
      : new Map<string, string>();

    return topics.map((topic) => this.mapCurriculumTopic(topic, teachers));
  }

  summarizeCurriculum(topics: CurriculumTopicView[]): CurriculumSummaryView {
    const groups = new Map<string, CurriculumTopicView[]>();
    for (const topic of topics) {
      const key = `${topic.className}:${topic.subject}`;
      groups.set(key, [...(groups.get(key) ?? []), topic]);
    }

    return {
      totalTopics: topics.length,
      completionRate: calculateCurriculumCompletion(topics),
      overdueTopics: topics.filter((topic) => topic.status === "ACTIVE" && topic.progressStatus === "NOT_STARTED" && topic.weekNumber < 4).length,
      bySubject: Array.from(groups.values()).map((items) => ({
        subject: items[0].subject,
        className: items[0].className,
        totalTopics: items.length,
        completionRate: calculateCurriculumCompletion(items)
      }))
    };
  }

  async createCurriculumTopic(session: SessionPayload, payload: unknown) {
    assertAdmin(session);
    const parsed = curriculumSchema.parse(payload);
    const term = parsed.termId
      ? await prisma.term.findFirst({ where: { schoolId: session.schoolId, id: parsed.termId }, include: { academicSession: true } })
      : await this.currentTerm(session.schoolId);
    if (!term) throw new NotFoundException("Selected term was not found.");

    const [classRoom, subject] = await Promise.all([
      prisma.classRoom.findFirst({ where: { schoolId: session.schoolId, id: parsed.classId } }),
      prisma.subject.findFirst({ where: { schoolId: session.schoolId, id: parsed.subjectId } })
    ]);
    if (!classRoom || !subject) throw new BadRequestException("A valid class and subject are required.");

    const topic = await prisma.curriculumTopic.create({
      data: {
        schoolId: session.schoolId,
        academicSessionId: parsed.academicSessionId ?? term.academicSessionId,
        termId: term.id,
        classId: parsed.classId,
        subjectId: parsed.subjectId,
        teacherId: parsed.teacherId,
        weekNumber: parsed.weekNumber,
        topic: parsed.topic,
        subTopic: parsed.subTopic,
        learningObjectives: parsed.learningObjectives,
        teacherNotes: parsed.teacherNotes,
        recommendedResources: parsed.recommendedResources,
        assignmentNote: parsed.assignmentNote,
        status: parsed.status
      },
      include: { academicSession: true, term: true, classRoom: true, subject: true }
    });

    return this.mapCurriculumTopic(topic);
  }

  async updateCurriculumProgress(session: SessionPayload, topicId: string, payload: unknown) {
    const parsed = curriculumProgressSchema.parse(payload);
    const topic = await prisma.curriculumTopic.findFirst({
      where: { id: topicId, schoolId: session.schoolId },
      include: { classRoom: { include: { classSubjects: true } } }
    });
    if (!topic) throw new NotFoundException("Scheme of work topic not found.");
    const assigned = topic.classRoom.classSubjects.some((assignment) => assignment.subjectId === topic.subjectId && assignment.teacherId === session.userId);
    if (session.role === "TEACHER" && topic.teacherId !== session.userId && !assigned) {
      throw new ForbiddenException("Teachers can update only assigned scheme-of-work topics.");
    }
    if (session.role !== "TEACHER") assertAdmin(session);

    const updated = await prisma.curriculumTopic.update({
      where: { id: topic.id },
      data: {
        progressStatus: parsed.progressStatus,
        actualDateTaught: parsed.actualDateTaught,
        teacherNotes: parsed.teacherNotes ?? topic.teacherNotes
      },
      include: { academicSession: true, term: true, classRoom: true, subject: true }
    });
    return this.mapCurriculumTopic(updated);
  }

  async updateAttendancePolicy(session: SessionPayload, payload: unknown) {
    assertAdmin(session);
    const parsed = attendancePolicySchema.parse(payload);
    const policy = await prisma.staffAttendancePolicy.upsert({
      where: { schoolId: session.schoolId },
      update: parsed,
      create: { schoolId: session.schoolId, ...parsed }
    });
    return this.mapPolicy(policy);
  }

  async clockIn(session: SessionPayload) {
    if (session.role !== "TEACHER") throw new ForbiddenException("Only teachers can use self clock-in.");
    const policy = await this.policy(session.schoolId);
    const now = new Date();
    const date = normalizeSchoolDay(now);
    const status = resolveClockInStatus({ clockInAt: now, resumptionTime: policy.resumptionTime, graceMinutes: policy.graceMinutes });
    const record = await prisma.staffAttendance.upsert({
      where: { schoolId_userId_date: { schoolId: session.schoolId, userId: session.userId, date } },
      update: { checkInAt: now, status, clockInMethod: "SELF_SERVICE", notes: "Teacher self clock-in" },
      create: { schoolId: session.schoolId, userId: session.userId, date, status, checkInAt: now, clockInMethod: "SELF_SERVICE", notes: "Teacher self clock-in" },
      include: { user: true }
    });
    await prisma.staffAttendanceAudit.create({
      data: { schoolId: session.schoolId, staffAttendanceId: record.id, actorId: session.userId, action: "CLOCK_IN", note: status === "LATE" ? "Clocked in after resumption grace period." : "Clocked in on time." }
    });
    return (await this.mapStaffAttendance([record]))[0];
  }

  async clockOut(session: SessionPayload) {
    if (session.role !== "TEACHER") throw new ForbiddenException("Only teachers can use self clock-out.");
    const now = new Date();
    const date = normalizeSchoolDay(now);
    const record = await prisma.staffAttendance.findUnique({
      where: { schoolId_userId_date: { schoolId: session.schoolId, userId: session.userId, date } },
      include: { user: true }
    });
    if (!record?.checkInAt) throw new BadRequestException("Clock-in is required before clock-out.");
    const totalMinutes = calculateTotalMinutes(record.checkInAt, now);
    const updated = await prisma.staffAttendance.update({
      where: { id: record.id },
      data: { checkOutAt: now, clockOutMethod: "SELF_SERVICE", totalMinutes },
      include: { user: true }
    });
    await prisma.staffAttendanceAudit.create({
      data: { schoolId: session.schoolId, staffAttendanceId: updated.id, actorId: session.userId, action: "CLOCK_OUT", note: "Teacher self clock-out" }
    });
    return (await this.mapStaffAttendance([updated]))[0];
  }

  async listStaffAttendance(session: SessionPayload) {
    if (session.role === "TEACHER") {
      const records = await prisma.staffAttendance.findMany({
        where: { schoolId: session.schoolId, userId: session.userId },
        select: staffAttendanceReadSelect,
        orderBy: { date: "desc" },
        take: 60
      });
      return this.mapStaffAttendance(records);
    }
    assertAdmin(session);
    const records = await prisma.staffAttendance.findMany({
      where: { schoolId: session.schoolId },
      select: staffAttendanceReadSelect,
      orderBy: [{ date: "desc" }, { checkInAt: "asc" }],
      take: 120
    });
    return this.mapStaffAttendance(records);
  }

  async recordManualStaffAttendance(session: SessionPayload, payload: unknown) {
    assertAdmin(session);
    const parsed = manualAttendanceSchema.parse(payload);
    if (parsed.checkInAt && parsed.checkOutAt && parsed.checkOutAt.getTime() < parsed.checkInAt.getTime()) {
      throw new BadRequestException("Clock-out cannot be earlier than clock-in.");
    }
    const user = await prisma.user.findFirst({ where: { id: parsed.userId, schoolId: session.schoolId } });
    if (!user) throw new NotFoundException("Staff user not found.");
    const date = normalizeSchoolDay(parsed.date);
    const totalMinutes = calculateTotalMinutes(parsed.checkInAt, parsed.checkOutAt);
    const record = await prisma.staffAttendance.upsert({
      where: { schoolId_userId_date: { schoolId: session.schoolId, userId: parsed.userId, date } },
      update: { status: parsed.status, checkInAt: parsed.checkInAt, checkOutAt: parsed.checkOutAt, totalMinutes, notes: parsed.notes, clockInMethod: "MANUAL" },
      create: { schoolId: session.schoolId, userId: parsed.userId, date, status: parsed.status, checkInAt: parsed.checkInAt, checkOutAt: parsed.checkOutAt, totalMinutes, notes: parsed.notes, clockInMethod: "MANUAL" },
      include: { user: true }
    });
    await prisma.staffAttendanceAudit.create({
      data: { schoolId: session.schoolId, staffAttendanceId: record.id, actorId: session.userId, action: "MANUAL_UPDATE", note: parsed.notes }
    });
    return (await this.mapStaffAttendance([record]))[0];
  }

  async listTrainingPrograms(session: SessionPayload): Promise<TrainingProgramView[]> {
    if (env.DEMO_MODE) return (await this.getDashboard(session)).training.upcoming;
    const where = session.role === "TEACHER"
      ? { schoolId: session.schoolId, participants: { some: { userId: session.userId } } }
      : { schoolId: session.schoolId };
    const programs = await prisma.trainingProgram.findMany({
      where,
      include: { participants: true },
      orderBy: { startsAt: "desc" },
      take: 80
    }).catch((error: unknown) => {
      if (isSchemaDriftError(error)) return [];
      throw error;
    });
    return programs.map((program) => this.mapTraining(program));
  }

  async createTrainingProgram(session: SessionPayload, payload: unknown) {
    assertTrainingAdmin(session);
    const parsed = trainingSchema.parse(payload);
    const program = await prisma.trainingProgram.create({
      data: {
        schoolId: session.schoolId,
        createdById: session.userId,
        ...parsed,
        meetingLink: parsed.meetingLink || undefined
      },
      include: { participants: true }
    });
    return this.mapTraining(program);
  }

  async assignTrainingParticipants(session: SessionPayload, trainingProgramId: string, payload: unknown) {
    assertTrainingAdmin(session);
    const parsed = participantSchema.parse(payload);
    const program = await prisma.trainingProgram.findFirst({ where: { id: trainingProgramId, schoolId: session.schoolId } });
    if (!program) throw new NotFoundException("Training program not found.");
    const staff = await prisma.staffProfile.findMany({
      where: { schoolId: session.schoolId, userId: { in: parsed.userIds } }
    });
    const staffByUserId = new Map(staff.map((item) => [item.userId, item.id]));
    await prisma.trainingParticipant.createMany({
      data: parsed.userIds.map((userId) => ({
        schoolId: session.schoolId,
        trainingProgramId,
        userId,
        staffId: staffByUserId.get(userId),
        notes: parsed.notes
      })),
      skipDuplicates: true
    });
    return this.listTrainingPrograms(session);
  }

  async listTrainingParticipants(session: SessionPayload): Promise<TrainingParticipantView[]> {
    const where = session.role === "TEACHER" ? { schoolId: session.schoolId, userId: session.userId } : { schoolId: session.schoolId };
    if (session.role !== "TEACHER") assertTrainingAdmin(session);
    const participants = await prisma.trainingParticipant.findMany({
      where,
      include: { trainingProgram: true, user: true },
      orderBy: { trainingProgram: { startsAt: "desc" } },
      take: 120
    }).catch((error: unknown) => {
      if (isSchemaDriftError(error)) return [];
      throw error;
    });
    return participants.map((participant) => ({
      id: participant.id,
      trainingProgramId: participant.trainingProgramId,
      title: participant.trainingProgram.title,
      teacherName: userName(participant.user),
      status: participant.status,
      startsAt: participant.trainingProgram.startsAt.toISOString(),
      completedAt: participant.completedAt?.toISOString(),
      certificateUrl: participant.certificateUrl ?? undefined,
      cpdPoints: participant.cpdPoints,
      notes: participant.notes ?? undefined
    }));
  }

  async completeTrainingParticipant(session: SessionPayload, participantId: string, payload: unknown) {
    const parsed = completeTrainingSchema.parse(payload);
    const participant = await prisma.trainingParticipant.findFirst({ where: { id: participantId, schoolId: session.schoolId } });
    if (!participant) throw new NotFoundException("Training participant record not found.");
    if (session.role === "TEACHER" && participant.userId !== session.userId) {
      throw new ForbiddenException("Teachers can update only their own training record.");
    }
    if (session.role !== "TEACHER") assertTrainingAdmin(session);
    await prisma.trainingParticipant.update({
      where: { id: participant.id },
      data: {
        status: parsed.status,
        completedAt: parsed.status === "COMPLETED" ? new Date() : participant.completedAt,
        attendedAt: parsed.status === "ATTENDED" || parsed.status === "COMPLETED" ? new Date() : participant.attendedAt,
        certificateUrl: parsed.certificateUrl || undefined,
        cpdPoints: parsed.cpdPoints,
        notes: parsed.notes,
        feedback: parsed.feedback
      }
    });
    return this.listTrainingParticipants(session);
  }
}
