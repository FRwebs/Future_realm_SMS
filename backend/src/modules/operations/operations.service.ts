import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, LeaveStatus, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";

const disciplineSchema = z.object({
  studentId: z.string().min(1),
  category: z.string().min(2),
  severity: z.string().default("LOW"),
  description: z.string().min(3),
  classId: z.string().optional(),
  escalatedToId: z.string().optional()
});

const counselingSchema = z.object({
  studentId: z.string().min(1),
  category: z.string().min(2),
  summary: z.string().min(3),
  confidentialNote: z.string().optional(),
  principalVisible: z.coerce.boolean().default(false),
  followUpDate: z.string().optional()
});

const healthSchema = z.object({
  studentId: z.string().min(1),
  complaint: z.string().min(2),
  treatment: z.string().optional(),
  medication: z.string().optional(),
  referral: z.string().optional()
});

const visitorSchema = z.object({
  visitorName: z.string().min(2),
  phone: z.string().optional(),
  purpose: z.string().min(2),
  hostName: z.string().optional(),
  hostUserId: z.string().optional(),
  passNumber: z.string().optional()
});

const lessonPlanSchema = z.object({
  academicSessionId: z.string().optional(),
  termId: z.string().optional(),
  classId: z.string().optional(),
  subjectId: z.string().min(1),
  departmentId: z.string().optional(),
  weekNumber: z.coerce.number().int().min(1).max(20),
  topic: z.string().min(2),
  objectives: z.string().min(3),
  resources: z.string().optional(),
  status: z.string().default("DRAFT")
});

const questionSchema = z.object({
  classId: z.string().optional(),
  subjectId: z.string().min(1),
  departmentId: z.string().optional(),
  assessmentType: z.string().min(2),
  question: z.string().min(3),
  answerGuide: z.string().optional(),
  difficulty: z.string().default("MEDIUM"),
  status: z.string().default("DRAFT")
});

const learningMaterialSchema = z.object({
  classId: z.string().optional(),
  subjectId: z.string().min(1),
  title: z.string().min(2),
  description: z.string().optional(),
  fileUrl: z.string().optional(),
  status: z.string().default("DRAFT")
});

const resultWindowSchema = z.object({
  academicSessionId: z.string().min(1),
  termId: z.string().min(1),
  classId: z.string().optional(),
  departmentId: z.string().optional(),
  title: z.string().min(2),
  opensAt: z.string().datetime(),
  closesAt: z.string().datetime(),
  status: z.string().default("OPEN")
});

const leaveSchema = z.object({
  type: z.string().min(2),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().min(3),
  coverArrangement: z.string().optional()
});

const inventorySchema = z.object({
  category: z.string().min(2),
  name: z.string().min(2),
  sku: z.string().optional(),
  quantity: z.coerce.number().int().min(0).default(0),
  unit: z.string().default("unit"),
  location: z.string().optional(),
  reorderLevel: z.coerce.number().int().min(0).default(0)
});

const facilitySchema = z.object({
  facilityName: z.string().min(2),
  category: z.string().min(2),
  issue: z.string().min(3),
  priority: z.string().default("NORMAL"),
  assignedTo: z.string().optional(),
  cost: z.coerce.number().optional()
});

const externalExamSchema = z.object({
  academicSessionId: z.string().optional(),
  classId: z.string().optional(),
  name: z.string().min(2),
  body: z.string().min(2),
  status: z.string().default("DRAFT"),
  examDate: z.string().optional()
});

const meetingSchema = z.object({
  studentId: z.string().optional(),
  guardianId: z.string().optional(),
  staffId: z.string().optional(),
  title: z.string().min(2),
  scheduledAt: z.string().datetime(),
  notes: z.string().optional()
});

const vehicleSchema = z.object({
  routeId: z.string().optional(),
  plateNumber: z.string().min(2),
  model: z.string().optional(),
  capacity: z.coerce.number().int().min(1),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  status: z.string().default("ACTIVE")
});

function parseDate(value?: string) {
  return value ? new Date(value) : undefined;
}

function studentName(student?: { firstName: string; lastName: string } | null) {
  return student ? `${student.firstName} ${student.lastName}` : "Unknown student";
}

@Injectable()
export class OperationsService {
  private async actor(session: SessionPayload) {
    return prisma.user.findFirst({
      where: { OR: [{ id: session.userId }, { email: session.email }] },
      include: { staffProfile: true }
    });
  }

  private async audit(session: SessionPayload, action: AuditAction, entityType: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    const actor = await this.actor(session);
    await prisma.auditLog.create({
      data: {
        schoolId: session.schoolId,
        actorId: actor?.id ?? null,
        action,
        entityType,
        entityId,
        metadata
      }
    });
  }

  async overview(session: SessionPayload) {
    const schoolId = session.schoolId;
    const [
      openDiscipline,
      counselingFollowUps,
      healthVisitsToday,
      unsignedVisitors,
      pendingLessonPlans,
      pendingQuestions,
      pendingLeave,
      lowInventoryItems,
      openFacilities,
      externalExams,
      resultWindows
    ] = await Promise.all([
      prisma.disciplineRecord.count({ where: { schoolId, deletedAt: null, status: { not: "RESOLVED" } } }),
      prisma.counselingRecord.count({ where: { schoolId, deletedAt: null, followUpDate: { not: null } } }),
      prisma.healthVisit.count({ where: { schoolId, deletedAt: null, visitedAt: { gte: new Date(new Date().toDateString()) } } }),
      prisma.visitorLog.count({ where: { schoolId, deletedAt: null, timeOut: null } }),
      prisma.lessonPlan.count({ where: { schoolId, deletedAt: null, status: "SUBMITTED" } }),
      prisma.questionBankItem.count({ where: { schoolId, deletedAt: null, status: "SUBMITTED" } }),
      prisma.leaveRequest.count({ where: { schoolId, status: "PENDING" } }),
      prisma.inventoryItem.findMany({ where: { schoolId, deletedAt: null }, select: { quantity: true, reorderLevel: true } }),
      prisma.facilityMaintenanceLog.count({ where: { schoolId, deletedAt: null, status: { not: "RESOLVED" } } }),
      prisma.externalExam.count({ where: { schoolId, deletedAt: null } }),
      prisma.resultEntryWindow.findMany({ where: { schoolId }, orderBy: { closesAt: "asc" }, take: 5 })
    ]);

    return {
      metrics: [
        { label: "Open discipline", value: openDiscipline, detail: "Incidents awaiting resolution" },
        { label: "Counseling follow-ups", value: counselingFollowUps, detail: "Student welfare follow-up items" },
        { label: "Health visits today", value: healthVisitsToday, detail: "Sick bay visits recorded today" },
        { label: "Visitors signed in", value: unsignedVisitors, detail: "Visitors still on campus" },
        { label: "Lesson plans pending", value: pendingLessonPlans, detail: "Awaiting HOD or VP Academics review" },
        { label: "Questions pending", value: pendingQuestions, detail: "Question bank items awaiting approval" },
        { label: "Leave requests", value: pendingLeave, detail: "Staff leave awaiting approval" },
        { label: "Low inventory", value: lowInventoryItems.filter((item) => item.quantity <= item.reorderLevel).length, detail: "Items at or below reorder level" },
        { label: "Facility issues", value: openFacilities, detail: "Maintenance logs still open" },
        { label: "External exams", value: externalExams, detail: "External exam records on file" }
      ],
      resultWindows
    };
  }

  async listDiscipline(session: SessionPayload) {
    return prisma.disciplineRecord.findMany({
      where: { schoolId: session.schoolId, deletedAt: null },
      include: { student: true, reporter: true, classRoom: true },
      orderBy: { occurredAt: "desc" },
      take: 100
    });
  }

  async createDiscipline(session: SessionPayload, payload: unknown) {
    const parsed = disciplineSchema.parse(payload);
    const actor = await this.actor(session);
    const record = await prisma.disciplineRecord.create({
      data: { schoolId: session.schoolId, reporterId: actor?.id, ...parsed },
      include: { student: true }
    });
    await prisma.notificationLog.create({
      data: {
        schoolId: session.schoolId,
        channel: "IN_APP",
        title: "Discipline incident logged",
        body: `${studentName(record.student)} has a ${record.severity.toLowerCase()} ${record.category} incident for review.`,
        status: "QUEUED",
        metadata: { disciplineRecordId: record.id }
      }
    });
    await this.audit(session, "CREATE", "DisciplineRecord", record.id, { studentId: parsed.studentId, category: parsed.category });
    return record;
  }

  async updateDisciplineDecision(session: SessionPayload, id: string, payload: Record<string, unknown>) {
    const record = await prisma.disciplineRecord.findFirst({ where: { id, schoolId: session.schoolId, deletedAt: null } });
    if (!record) throw new NotFoundException("Discipline record not found.");
    const updated = await prisma.disciplineRecord.update({
      where: { id },
      data: {
        sanction: typeof payload.sanction === "string" ? payload.sanction : record.sanction,
        outcome: typeof payload.outcome === "string" ? payload.outcome : record.outcome,
        status: typeof payload.status === "string" ? payload.status : "RESOLVED",
        resolvedAt: new Date(),
        parentNotifiedAt: payload.parentNotified ? new Date() : record.parentNotifiedAt
      }
    });
    await this.audit(session, "APPROVE", "DisciplineRecord", id, { sanction: updated.sanction, status: updated.status });
    return updated;
  }

  async listCounseling(session: SessionPayload) {
    const actor = await this.actor(session);
    const canSeeAll = ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL", "HEAD_TEACHER"].includes(session.role);
    return prisma.counselingRecord.findMany({
      where: {
        schoolId: session.schoolId,
        deletedAt: null,
        ...(canSeeAll ? {} : { counselorId: actor?.id ?? "" })
      },
      include: { student: true, counselor: true },
      orderBy: { sessionDate: "desc" },
      take: 100
    });
  }

  async createCounseling(session: SessionPayload, payload: unknown) {
    const parsed = counselingSchema.parse(payload);
    const actor = await this.actor(session);
    if (!actor) throw new ForbiddenException("Unable to resolve counselor account.");
    const record = await prisma.counselingRecord.create({
      data: {
        schoolId: session.schoolId,
        counselorId: actor.id,
        studentId: parsed.studentId,
        category: parsed.category,
        summary: parsed.summary,
        confidentialNote: parsed.confidentialNote,
        principalVisible: parsed.principalVisible,
        followUpDate: parseDate(parsed.followUpDate)
      }
    });
    await this.audit(session, "CREATE", "CounselingRecord", record.id, { studentId: parsed.studentId, category: parsed.category });
    return record;
  }

  async listHealth(session: SessionPayload) {
    return prisma.healthVisit.findMany({
      where: { schoolId: session.schoolId, deletedAt: null },
      include: { student: true, nurse: true },
      orderBy: { visitedAt: "desc" },
      take: 100
    });
  }

  async createHealth(session: SessionPayload, payload: unknown) {
    const parsed = healthSchema.parse(payload);
    const actor = await this.actor(session);
    const record = await prisma.healthVisit.create({
      data: { schoolId: session.schoolId, nurseId: actor?.id, ...parsed }
    });
    await this.audit(session, "CREATE", "HealthVisit", record.id, { studentId: parsed.studentId });
    return record;
  }

  async listVisitors(session: SessionPayload) {
    return prisma.visitorLog.findMany({ where: { schoolId: session.schoolId, deletedAt: null }, include: { createdBy: true, hostUser: true }, orderBy: { timeIn: "desc" }, take: 100 });
  }

  async createVisitor(session: SessionPayload, payload: unknown) {
    const parsed = visitorSchema.parse(payload);
    const actor = await this.actor(session);
    const record = await prisma.visitorLog.create({ data: { schoolId: session.schoolId, createdById: actor?.id, ...parsed } });
    await this.audit(session, "CREATE", "VisitorLog", record.id, { visitorName: parsed.visitorName });
    return record;
  }

  async signOutVisitor(session: SessionPayload, id: string) {
    const existing = await prisma.visitorLog.findFirst({ where: { id, schoolId: session.schoolId, deletedAt: null } });
    if (!existing) throw new NotFoundException("Visitor log not found.");
    const record = await prisma.visitorLog.update({ where: { id }, data: { timeOut: new Date(), status: "SIGNED_OUT" } });
    await this.audit(session, "UPDATE", "VisitorLog", id, { status: "SIGNED_OUT" });
    return record;
  }

  async listLessonPlans(session: SessionPayload) {
    return prisma.lessonPlan.findMany({ where: { schoolId: session.schoolId, deletedAt: null }, include: { teacher: true, subject: true, classRoom: true }, orderBy: { createdAt: "desc" }, take: 100 });
  }

  async createLessonPlan(session: SessionPayload, payload: unknown) {
    const parsed = lessonPlanSchema.parse(payload);
    const actor = await this.actor(session);
    if (!actor) throw new ForbiddenException("Unable to resolve teacher account.");
    const record = await prisma.lessonPlan.create({ data: { schoolId: session.schoolId, teacherId: actor.id, ...parsed } });
    await this.audit(session, "CREATE", "LessonPlan", record.id, { subjectId: parsed.subjectId, status: parsed.status });
    return record;
  }

  async reviewLessonPlan(session: SessionPayload, id: string, payload: Record<string, unknown>) {
    const actor = await this.actor(session);
    const status = payload.action === "reject" ? "REJECTED" : "APPROVED";
    const existing = await prisma.lessonPlan.findFirst({ where: { id, schoolId: session.schoolId, deletedAt: null } });
    if (!existing) throw new NotFoundException("Lesson plan not found.");
    const record = await prisma.lessonPlan.update({
      where: { id },
      data: {
        status,
        approvedById: status === "APPROVED" ? actor?.id : undefined,
        approvedAt: status === "APPROVED" ? new Date() : undefined,
        rejectedAt: status === "REJECTED" ? new Date() : undefined,
        reviewNote: typeof payload.note === "string" ? payload.note : undefined
      }
    });
    await this.audit(session, status === "APPROVED" ? "APPROVE" : "REJECT", "LessonPlan", id, { status });
    return record;
  }

  async listQuestionBank(session: SessionPayload) {
    return prisma.questionBankItem.findMany({ where: { schoolId: session.schoolId, deletedAt: null }, include: { subject: true, classRoom: true, teacher: true }, orderBy: { createdAt: "desc" }, take: 100 });
  }

  async createQuestion(session: SessionPayload, payload: unknown) {
    const parsed = questionSchema.parse(payload);
    const actor = await this.actor(session);
    const record = await prisma.questionBankItem.create({ data: { schoolId: session.schoolId, teacherId: actor?.id, ...parsed } });
    await this.audit(session, "CREATE", "QuestionBankItem", record.id, { subjectId: parsed.subjectId });
    return record;
  }

  async approveQuestion(session: SessionPayload, id: string, payload: Record<string, unknown>) {
    const actor = await this.actor(session);
    const status = payload.action === "reject" ? "REJECTED" : "APPROVED";
    const existing = await prisma.questionBankItem.findFirst({ where: { id, schoolId: session.schoolId, deletedAt: null } });
    if (!existing) throw new NotFoundException("Question not found.");
    const record = await prisma.questionBankItem.update({ where: { id }, data: { status, approvedById: actor?.id, approvedAt: status === "APPROVED" ? new Date() : undefined } });
    await this.audit(session, status === "APPROVED" ? "APPROVE" : "REJECT", "QuestionBankItem", id, { status });
    return record;
  }

  async createLearningMaterial(session: SessionPayload, payload: unknown) {
    const parsed = learningMaterialSchema.parse(payload);
    const actor = await this.actor(session);
    const record = await prisma.learningMaterial.create({ data: { schoolId: session.schoolId, teacherId: actor?.id, ...parsed } });
    await this.audit(session, "CREATE", "LearningMaterial", record.id, { subjectId: parsed.subjectId });
    return record;
  }

  async listLearningMaterials(session: SessionPayload) {
    return prisma.learningMaterial.findMany({ where: { schoolId: session.schoolId, deletedAt: null }, include: { subject: true, classRoom: true, teacher: true }, orderBy: { createdAt: "desc" }, take: 100 });
  }

  async listResultWindows(session: SessionPayload) {
    return prisma.resultEntryWindow.findMany({ where: { schoolId: session.schoolId }, include: { term: true, classRoom: true, department: true }, orderBy: { closesAt: "asc" }, take: 100 });
  }

  async createResultWindow(session: SessionPayload, payload: unknown) {
    const parsed = resultWindowSchema.parse(payload);
    if (new Date(parsed.closesAt) <= new Date(parsed.opensAt)) throw new BadRequestException("Result entry deadline must be after the opening date.");
    const actor = await this.actor(session);
    const record = await prisma.resultEntryWindow.create({ data: { schoolId: session.schoolId, createdById: actor?.id, ...parsed, opensAt: new Date(parsed.opensAt), closesAt: new Date(parsed.closesAt) } });
    await this.audit(session, "CREATE", "ResultEntryWindow", record.id, { title: parsed.title });
    return record;
  }

  async listStaffLeave(session: SessionPayload) {
    return prisma.leaveRequest.findMany({ where: { schoolId: session.schoolId }, include: { staff: { include: { user: true, department: true } } }, orderBy: { startDate: "desc" }, take: 100 });
  }

  async createStaffLeave(session: SessionPayload, payload: unknown) {
    const parsed = leaveSchema.parse(payload);
    const actor = await this.actor(session);
    if (!actor?.staffProfile) throw new ForbiddenException("Only staff can submit leave requests.");
    const record = await prisma.leaveRequest.create({
      data: { schoolId: session.schoolId, staffId: actor.staffProfile.id, type: parsed.type, startDate: new Date(parsed.startDate), endDate: new Date(parsed.endDate), reason: parsed.coverArrangement ? `${parsed.reason}\nCover: ${parsed.coverArrangement}` : parsed.reason }
    });
    await this.audit(session, "CREATE", "LeaveRequest", record.id, { type: parsed.type });
    return record;
  }

  async reviewStaffLeave(session: SessionPayload, id: string, status: LeaveStatus) {
    const existing = await prisma.leaveRequest.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!existing) throw new NotFoundException("Leave request not found.");
    const record = await prisma.leaveRequest.update({ where: { id }, data: { status, reviewedAt: new Date() } });
    await this.audit(session, status === "APPROVED" ? "APPROVE" : "REJECT", "LeaveRequest", id, { status });
    return record;
  }

  async listInventory(session: SessionPayload) {
    return prisma.inventoryItem.findMany({ where: { schoolId: session.schoolId, deletedAt: null }, orderBy: [{ category: "asc" }, { name: "asc" }], take: 200 });
  }

  async createInventory(session: SessionPayload, payload: unknown) {
    const parsed = inventorySchema.parse(payload);
    const record = await prisma.inventoryItem.create({ data: { schoolId: session.schoolId, ...parsed } });
    await this.audit(session, "CREATE", "InventoryItem", record.id, { name: parsed.name });
    return record;
  }

  async listFacilities(session: SessionPayload) {
    return prisma.facilityMaintenanceLog.findMany({ where: { schoolId: session.schoolId, deletedAt: null }, include: { reportedBy: true }, orderBy: { reportedAt: "desc" }, take: 100 });
  }

  async createFacilityLog(session: SessionPayload, payload: unknown) {
    const parsed = facilitySchema.parse(payload);
    const actor = await this.actor(session);
    const record = await prisma.facilityMaintenanceLog.create({ data: { schoolId: session.schoolId, reportedById: actor?.id, ...parsed, cost: parsed.cost } });
    await this.audit(session, "CREATE", "FacilityMaintenanceLog", record.id, { facilityName: parsed.facilityName });
    return record;
  }

  async listExternalExams(session: SessionPayload) {
    return prisma.externalExam.findMany({ where: { schoolId: session.schoolId, deletedAt: null }, include: { classRoom: true, academicSession: true }, orderBy: { examDate: "asc" }, take: 100 });
  }

  async createExternalExam(session: SessionPayload, payload: unknown) {
    const parsed = externalExamSchema.parse(payload);
    const record = await prisma.externalExam.create({ data: { schoolId: session.schoolId, ...parsed, examDate: parseDate(parsed.examDate) } });
    await this.audit(session, "CREATE", "ExternalExam", record.id, { body: parsed.body });
    return record;
  }

  async listParentMeetings(session: SessionPayload) {
    return prisma.parentMeeting.findMany({ where: { schoolId: session.schoolId, deletedAt: null }, include: { student: true, guardian: true, staff: { include: { user: true } } }, orderBy: { scheduledAt: "asc" }, take: 100 });
  }

  async createParentMeeting(session: SessionPayload, payload: unknown) {
    const parsed = meetingSchema.parse(payload);
    const actor = await this.actor(session);
    const record = await prisma.parentMeeting.create({ data: { schoolId: session.schoolId, scheduledById: actor?.id, ...parsed, scheduledAt: new Date(parsed.scheduledAt) } });
    await this.audit(session, "CREATE", "ParentMeeting", record.id, { title: parsed.title });
    return record;
  }

  async listTransportVehicles(session: SessionPayload) {
    return prisma.transportVehicle.findMany({ where: { schoolId: session.schoolId, deletedAt: null }, include: { route: true }, orderBy: { plateNumber: "asc" }, take: 100 });
  }

  async createTransportVehicle(session: SessionPayload, payload: unknown) {
    const parsed = vehicleSchema.parse(payload);
    const record = await prisma.transportVehicle.create({ data: { schoolId: session.schoolId, ...parsed } });
    await this.audit(session, "CREATE", "TransportVehicle", record.id, { plateNumber: parsed.plateNumber });
    return record;
  }
}
