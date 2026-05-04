import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ApplicationStatus, Prisma } from "@prisma/client";
import { addDays, differenceInCalendarDays } from "date-fns";
import { z } from "zod";

import { prisma } from "../../../../src/lib/db/prisma";
import {
  AdmissionApplicationView,
  AdmissionConfigView,
  AdmissionMetricsView,
  AdmissionPaymentStatus,
  AdmissionStatus,
  StudentRecordView
} from "../../../../src/lib/domain/types";
import { sendNotification } from "../../../../src/lib/integrations/notifications";
import {
  formatNigeriaClassName,
  getNigeriaClassLookupNames,
  normalizeNigeriaClassValue
} from "../../../../src/lib/school-options";

const finalStatuses: AdmissionStatus[] = ["REJECTED", "DECLINED", "ENROLLED", "ACTIVE"];
const decisionStatuses: AdmissionStatus[] = ["APPROVED", "CONDITIONALLY_APPROVED", "REJECTED", "WAITLISTED"];
const booleanField = z.union([z.boolean(), z.enum(["true", "false"])]).transform((value) => value === true || value === "true");
const nigeriaClassInputSchema = z
  .string()
  .min(2)
  .refine((value) => Boolean(normalizeNigeriaClassValue(value)), "Select a valid Nigerian class.");

export const admissionSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  middleName: z.string().optional().or(z.literal("")),
  guardianName: z.string().min(3),
  guardianPhone: z.string().min(10),
  guardianEmail: z.string().email().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  emergencyContactName: z.string().optional().or(z.literal("")),
  emergencyContactPhone: z.string().optional().or(z.literal("")),
  previousSchool: z.string().optional().or(z.literal("")),
  medicalNotes: z.string().optional().or(z.literal("")),
  desiredClass: nigeriaClassInputSchema,
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).default("MALE"),
  dateOfBirth: z.string().optional().or(z.literal("")),
  draft: booleanField.optional().default(false)
});

const reviewAdmissionSchema = z.object({
  notes: z.string().min(8),
  recommendedClass: nigeriaClassInputSchema.optional().or(z.literal("")),
  documentStatus: z.string().optional().or(z.literal("")),
  screeningOutcome: z.string().optional().or(z.literal("")),
  assignedReviewerId: z.string().optional().or(z.literal(""))
});

const documentRequestSchema = z.object({
  missingDocuments: z.string().min(2),
  note: z.string().min(4)
});

const paymentVerificationSchema = z.object({
  amount: z.coerce.number().min(0).default(0),
  reference: z.string().optional().or(z.literal("")),
  waived: booleanField.optional().default(false),
  note: z.string().optional().or(z.literal(""))
});

const screeningScheduleSchema = z.object({
  interviewerId: z.string().optional().or(z.literal("")),
  scheduledAt: z.string().min(4),
  venue: z.string().optional().or(z.literal("")),
  note: z.string().optional().or(z.literal(""))
});

const screeningResultSchema = z.object({
  score: z.coerce.number().min(0).max(100),
  maxScore: z.coerce.number().min(1).default(100),
  result: z.enum(["PASS", "FAIL", "BORDERLINE"]).default("PASS"),
  recommendation: z.string().min(3),
  remarks: z.string().min(4),
  attachmentUrl: z.string().optional().or(z.literal(""))
});

const recommendationSchema = z.object({
  notes: z.string().min(4)
});

const admissionDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "CONDITIONALLY_APPROVED", "REJECTED", "WAITLISTED"]),
  notes: z.string().min(4),
  conditions: z.string().optional().or(z.literal(""))
});

const offerSchema = z.object({
  conditions: z.string().optional().or(z.literal("")),
  checklist: z.string().optional().or(z.literal("")),
  expiryDays: z.coerce.number().min(1).max(90).optional()
});

const offerResponseSchema = z.object({
  note: z.string().optional().or(z.literal(""))
});

const registerAdmissionSchema = z.object({
  admissionNumber: z.string().optional().or(z.literal("")),
  className: nigeriaClassInputSchema,
  guardianRelationship: z.string().min(3).default("Parent"),
  bloodGroup: z.string().optional().or(z.literal("")),
  genotype: z.string().optional().or(z.literal("")),
  allergies: z.string().optional().or(z.literal("")),
  conditions: z.string().optional().or(z.literal("")),
  portalAccountsCreated: booleanField.optional().default(false)
});

const commentSchema = z.object({
  body: z.string().min(3),
  isInternal: z.coerce.boolean().optional().default(true)
});

const configSchema = z.object({
  name: z.string().min(3).default("Default Admissions Cycle"),
  minAge: z.coerce.number().optional(),
  maxAge: z.coerce.number().optional(),
  requiredDocuments: z.string().optional().or(z.literal("")),
  applicationFeeAmount: z.coerce.number().min(0).default(0),
  applicationFeeRequired: booleanField.optional().default(false),
  screeningRequired: booleanField.optional().default(true),
  principalApprovalRequired: booleanField.optional().default(true),
  bursarClearanceRequired: booleanField.optional().default(true),
  offerExpiryDays: z.coerce.number().min(1).max(90).default(14),
  openClasses: z.string().optional().or(z.literal(""))
});

function formatClassName(name?: string | null, arm?: string | null) {
  if (!name) return "Unassigned";
  return formatNigeriaClassName(arm ? `${name} - ${arm}` : name);
}

function splitClassName(value: string) {
  const [name, arm] = formatNigeriaClassName(value).split(" - ").map((item) => item.trim());
  return { name, arm };
}

function classLookupConditions(value: string) {
  const { arm } = splitClassName(value);
  const names = getNigeriaClassLookupNames(value);
  const formatted = formatNigeriaClassName(value);

  return [
    { name: formatted },
    ...names.flatMap((name) => (arm ? [{ name, arm }] : [{ name }]))
  ];
}

function splitFullName(value: string) {
  const [firstName, ...rest] = value.trim().split(/\s+/);
  return {
    firstName: firstName || value,
    lastName: rest.join(" ") || "Guardian"
  };
}

function parseCsv(value?: string) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function ensureStatus(application: { status: AdmissionStatus }, allowed: AdmissionStatus[], action: string) {
  if (!allowed.includes(application.status)) {
    throw new BadRequestException(`${action} is not allowed while application is ${application.status}.`);
  }
}

function isFeeCleared(application: { applicationFeeStatus?: AdmissionPaymentStatus | null; feeWaived?: boolean | null }) {
  return (
    application.feeWaived ||
    application.applicationFeeStatus === "VERIFIED" ||
    application.applicationFeeStatus === "WAIVED" ||
    application.applicationFeeStatus === "NOT_REQUIRED"
  );
}

function toJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function mapConfig(config: {
  id: string;
  name: string;
  isActive: boolean;
  minAge: number | null;
  maxAge: number | null;
  requiredDocuments: unknown;
  applicationFeeAmount: unknown;
  applicationFeeRequired: boolean;
  screeningRequired: boolean;
  principalApprovalRequired: boolean;
  bursarClearanceRequired: boolean;
  offerExpiryDays: number;
  academicSession?: { name: string } | null;
  term?: { name: string } | null;
  openClasses?: Array<{ name: string; arm: string | null }>;
}): AdmissionConfigView {
  return {
    id: config.id,
    name: config.name,
    academicSession: config.academicSession?.name,
    term: config.term?.name,
    isActive: config.isActive,
    openClasses: config.openClasses?.map((item) => formatClassName(item.name, item.arm)) ?? [],
    minAge: config.minAge ?? undefined,
    maxAge: config.maxAge ?? undefined,
    requiredDocuments: Array.isArray(config.requiredDocuments) ? (config.requiredDocuments as string[]) : [],
    applicationFeeAmount: Number(config.applicationFeeAmount),
    applicationFeeRequired: config.applicationFeeRequired,
    screeningRequired: config.screeningRequired,
    principalApprovalRequired: config.principalApprovalRequired,
    bursarClearanceRequired: config.bursarClearanceRequired,
    offerExpiryDays: config.offerExpiryDays
  };
}

type AdmissionRow = Awaited<ReturnType<typeof prisma.admissionApplication.findMany>>[number] & {
  desiredClass?: { name: string; arm: string | null } | null;
  reviews?: Array<{
    decision: ApplicationStatus;
    notes: string | null;
    reviewedAt: Date;
    reviewer?: { firstName: string; lastName: string } | null;
  }>;
  registeredStudent?: { id: string; admissionNumber: string } | null;
  screenings?: Array<{
    id: string;
    scheduledAt: Date;
    venue: string | null;
    score: number | null;
    maxScore: number;
    result: string | null;
    recommendation: string | null;
    remarks: string | null;
    completedAt: Date | null;
    interviewer?: { firstName: string; lastName: string } | null;
  }>;
  offers?: Array<{ status: string; expiresAt: Date; acceptedAt: Date | null }>;
  history?: Array<{
    id: string;
    fromStatus: ApplicationStatus | null;
    toStatus: ApplicationStatus;
    note: string | null;
    createdAt: Date;
    changedBy?: { firstName: string; lastName: string } | null;
  }>;
  comments?: Array<{
    id: string;
    body: string;
    isInternal: boolean;
    createdAt: Date;
    author?: { firstName: string; lastName: string } | null;
  }>;
  documents?: Array<{
    id: string;
    label: string;
    fileUrl: string;
    mimeType: string;
    isVerified: boolean;
    uploadedAt: Date;
  }>;
};

function mapAdmission(item: AdmissionRow): AdmissionApplicationView {
  const latestReview = item.reviews?.find((review) => review.decision === "REVIEWING");
  const latestDecision = item.reviews?.find((review) => decisionStatuses.includes(review.decision as AdmissionStatus));
  const latestOffer = item.offers?.[0];
  const latestScreening = item.screenings?.[0];

  return {
    id: item.id,
    applicationNo: item.applicationNo,
    studentName: `${item.firstName} ${item.lastName}`,
    firstName: item.firstName,
    lastName: item.lastName,
    gender: item.gender,
    dateOfBirth: item.dateOfBirth.toISOString(),
    guardianName: item.guardianName,
    guardianPhone: item.guardianPhone,
    guardianEmail: item.guardianEmail ?? undefined,
    address: item.address ?? undefined,
    emergencyContactName: item.emergencyContactName ?? undefined,
    emergencyContactPhone: item.emergencyContactPhone ?? undefined,
    previousSchool: item.previousSchool ?? undefined,
    medicalNotes: item.medicalNotes ?? undefined,
    desiredClass: item.desiredClass ? formatClassName(item.desiredClass.name, item.desiredClass.arm) : "Unassigned",
    status: item.status as AdmissionStatus,
    submittedAt: item.submittedAt.toISOString(),
    applicationFeeStatus: item.applicationFeeStatus,
    feeWaived: item.feeWaived,
    duplicateFlag: item.duplicateFlag,
    duplicateReason: item.duplicateReason ?? undefined,
    reviewNotes: latestReview?.notes ?? undefined,
    reviewedBy: latestReview?.reviewer
      ? `${latestReview.reviewer.firstName} ${latestReview.reviewer.lastName}`
      : undefined,
    reviewedAt: latestReview?.reviewedAt.toISOString(),
    decisionNotes: latestDecision?.notes ?? item.notes ?? undefined,
    decidedAt: item.decidedAt?.toISOString(),
    offerStatus: latestOffer?.status as AdmissionApplicationView["offerStatus"],
    offerExpiresAt: latestOffer?.expiresAt.toISOString(),
    acceptedAt: item.acceptedAt?.toISOString() ?? latestOffer?.acceptedAt?.toISOString(),
    enrolledAt: item.enrolledAt?.toISOString(),
    registeredStudentId: item.registeredStudent?.id,
    registeredAdmissionNumber: item.registeredStudent?.admissionNumber,
    latestScreening: latestScreening
      ? {
          id: latestScreening.id,
          interviewerName: latestScreening.interviewer
            ? `${latestScreening.interviewer.firstName} ${latestScreening.interviewer.lastName}`
            : undefined,
          scheduledAt: latestScreening.scheduledAt.toISOString(),
          venue: latestScreening.venue ?? undefined,
          score: latestScreening.score ?? undefined,
          maxScore: latestScreening.maxScore,
          result: latestScreening.result ?? undefined,
          recommendation: latestScreening.recommendation ?? undefined,
          remarks: latestScreening.remarks ?? undefined,
          completedAt: latestScreening.completedAt?.toISOString()
        }
      : undefined,
    missingRequirements:
      item.status === "AWAITING_DOCUMENTS" || item.status === "INCOMPLETE" ? parseCsv(item.notes ?? "") : [],
    timeline: item.history?.map((history) => ({
      id: history.id,
      fromStatus: history.fromStatus as AdmissionStatus | undefined,
      toStatus: history.toStatus as AdmissionStatus,
      changedBy: history.changedBy ? `${history.changedBy.firstName} ${history.changedBy.lastName}` : undefined,
      note: history.note ?? undefined,
      createdAt: history.createdAt.toISOString()
    })),
    comments: item.comments?.map((comment) => ({
      id: comment.id,
      authorName: comment.author ? `${comment.author.firstName} ${comment.author.lastName}` : undefined,
      body: comment.body,
      isInternal: comment.isInternal,
      createdAt: comment.createdAt.toISOString()
    })),
    documents: item.documents?.map((document) => ({
      id: document.id,
      label: document.label,
      fileUrl: document.fileUrl,
      mimeType: document.mimeType,
      isVerified: document.isVerified,
      uploadedAt: document.uploadedAt.toISOString()
    }))
  };
}

@Injectable()
export class AdmissionsService {
  private async notify(schoolId: string, application: AdmissionApplicationView, title: string, body: string) {
    await sendNotification({
      channel: "EMAIL",
      recipient: application.guardianEmail || application.guardianPhone,
      title,
      body
    });

    await prisma.notificationLog.create({
      data: {
        schoolId,
        channel: application.guardianEmail ? "EMAIL" : "SMS",
        title,
        body,
        status: "MOCK_SENT",
        sentAt: new Date(),
        metadata: {
          applicationId: application.id,
          applicationNo: application.applicationNo
        }
      }
    });
  }

  private async audit(
    schoolId: string,
    actorId: string | undefined,
    action: "CREATE" | "UPDATE" | "APPROVE" | "REJECT" | "PAYMENT",
    applicationId: string,
    metadata: Record<string, unknown>
  ) {
    await prisma.auditLog.create({
      data: {
        schoolId,
        actorId,
        action,
        entityType: "AdmissionApplication",
        entityId: applicationId,
        metadata: toJson(metadata)
      }
    });
  }

  private async transition(
    schoolId: string,
    applicationId: string,
    actorId: string | undefined,
    toStatus: AdmissionStatus,
    note?: string,
    extraData: Record<string, unknown> = {}
  ) {
    const existing = await prisma.admissionApplication.findFirstOrThrow({
      where: { id: applicationId, schoolId },
      select: { status: true }
    });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.admissionStatusHistory.create({
        data: {
          schoolId,
          applicationId,
          fromStatus: existing.status,
          toStatus,
          changedById: actorId,
          note,
          metadata: toJson(extraData)
        }
      });

      return tx.admissionApplication.update({
        where: { id: applicationId },
        data: {
          status: toStatus,
          notes: note,
          ...extraData
        }
      });
    });

    await this.audit(schoolId, actorId, toStatus === "APPROVED" ? "APPROVE" : toStatus === "REJECTED" ? "REJECT" : "UPDATE", applicationId, {
      fromStatus: existing.status,
      toStatus,
      note
    });
    return updated;
  }

  private async getAdmissionOrThrow(schoolId: string, applicationId: string) {
    const application = await prisma.admissionApplication.findFirst({
      where: { id: applicationId, schoolId },
      include: {
        desiredClass: true,
        registeredStudent: { select: { id: true, admissionNumber: true } },
        documents: { orderBy: { uploadedAt: "desc" } },
        reviews: {
          orderBy: { reviewedAt: "desc" },
          include: { reviewer: { select: { firstName: true, lastName: true } } }
        },
        screenings: {
          orderBy: { scheduledAt: "desc" },
          include: { interviewer: { select: { firstName: true, lastName: true } } }
        },
        offers: { orderBy: { createdAt: "desc" } },
        comments: {
          orderBy: { createdAt: "desc" },
          include: { author: { select: { firstName: true, lastName: true } } }
        },
        history: {
          orderBy: { createdAt: "desc" },
          include: { changedBy: { select: { firstName: true, lastName: true } } }
        }
      }
    });

    if (!application) {
      throw new NotFoundException("Admission application not found");
    }

    return application;
  }

  async listAdmissions(schoolId: string): Promise<AdmissionApplicationView[]> {
    const admissions = await prisma.admissionApplication.findMany({
      where: { schoolId },
      include: {
        desiredClass: true,
        registeredStudent: { select: { id: true, admissionNumber: true } },
        documents: { orderBy: { uploadedAt: "desc" } },
        reviews: {
          orderBy: { reviewedAt: "desc" },
          include: { reviewer: { select: { firstName: true, lastName: true } } }
        },
        screenings: {
          orderBy: { scheduledAt: "desc" },
          take: 1,
          include: { interviewer: { select: { firstName: true, lastName: true } } }
        },
        offers: { orderBy: { createdAt: "desc" }, take: 1 },
        comments: {
          orderBy: { createdAt: "desc" },
          take: 3,
          include: { author: { select: { firstName: true, lastName: true } } }
        },
        history: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { changedBy: { select: { firstName: true, lastName: true } } }
        }
      },
      orderBy: { submittedAt: "desc" }
    });

    return admissions.map(mapAdmission);
  }

  async getAdmission(schoolId: string, applicationId: string) {
    return mapAdmission(await this.getAdmissionOrThrow(schoolId, applicationId));
  }

  async getAdmissionMetrics(schoolId: string): Promise<AdmissionMetricsView> {
    const applications = await this.listAdmissions(schoolId);
    const byStatus = Object.entries(
      applications.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = (acc[item.status] ?? 0) + 1;
        return acc;
      }, {})
    ).map(([status, count]) => ({ status: status as AdmissionStatus, count }));
    const byClass = Object.entries(
      applications.reduce<Record<string, number>>((acc, item) => {
        acc[item.desiredClass] = (acc[item.desiredClass] ?? 0) + 1;
        return acc;
      }, {})
    ).map(([className, count]) => ({ className, count }));
    const processingDays = applications
      .filter((item) => item.decidedAt)
      .map((item) => differenceInCalendarDays(new Date(item.decidedAt!), new Date(item.submittedAt)));

    return {
      totalApplications: applications.length,
      byStatus,
      byClass,
      incompleteApplications: applications.filter((item) => ["INCOMPLETE", "AWAITING_DOCUMENTS"].includes(item.status)).length,
      pendingApprovals: applications.filter((item) => item.status === "RECOMMENDED").length,
      admitted: applications.filter((item) => ["APPROVED", "CONDITIONALLY_APPROVED", "OFFER_SENT", "ACCEPTED", "FINANCIALLY_CLEARED", "ENROLLED", "ACTIVE"].includes(item.status)).length,
      rejected: applications.filter((item) => item.status === "REJECTED").length,
      conversionRate:
        applications.length === 0
          ? 0
          : Number(((applications.filter((item) => ["ENROLLED", "ACTIVE"].includes(item.status)).length / applications.length) * 100).toFixed(1)),
      paymentVerified: applications.filter((item) => isFeeCleared(item)).length,
      screeningAverage:
        applications.filter((item) => item.latestScreening?.score !== undefined).length === 0
          ? 0
          : Number(
              (
                applications.reduce((sum, item) => sum + (item.latestScreening?.score ?? 0), 0) /
                applications.filter((item) => item.latestScreening?.score !== undefined).length
              ).toFixed(1)
            ),
      averageProcessingDays:
        processingDays.length === 0
          ? 0
          : Number((processingDays.reduce((sum, value) => sum + value, 0) / processingDays.length).toFixed(1))
    };
  }

  async getAdmissionSettings(schoolId: string): Promise<AdmissionConfigView> {
    const existing = await prisma.admissionConfig.findFirst({
      where: { schoolId, isActive: true },
      include: { academicSession: true, term: true, openClasses: true },
      orderBy: { createdAt: "desc" }
    });

    if (existing) return mapConfig(existing);

    const [session, term] = await Promise.all([
      prisma.academicSession.findFirst({ where: { schoolId, isCurrent: true } }),
      prisma.term.findFirst({ where: { schoolId, isCurrent: true } })
    ]);
    const created = await prisma.admissionConfig.create({
      data: {
        schoolId,
        academicSessionId: session?.id,
        termId: term?.id,
        name: "Default Admissions Cycle",
        requiredDocuments: ["Birth certificate", "Previous school result", "Passport photograph"],
        formFields: ["biodata", "guardian", "medical", "previousSchool"],
        applicationFeeRequired: true,
        applicationFeeAmount: 10000,
        communicationTemplates: {
          submitted: "Your application has been received.",
          offer: "Your admission offer is ready."
        }
      },
      include: { academicSession: true, term: true, openClasses: true }
    });

    return mapConfig(created);
  }

  async updateAdmissionSettings(schoolId: string, payload: unknown) {
    const parsed = configSchema.parse(payload);
    const [session, term, openClasses] = await Promise.all([
      prisma.academicSession.findFirst({ where: { schoolId, isCurrent: true } }),
      prisma.term.findFirst({ where: { schoolId, isCurrent: true } }),
      prisma.classRoom.findMany({
        where: {
          schoolId,
          OR: parseCsv(parsed.openClasses).flatMap(classLookupConditions)
        }
      })
    ]);
    const existing = await prisma.admissionConfig.findFirst({ where: { schoolId, isActive: true } });
    const saved = existing
      ? await prisma.admissionConfig.update({
          where: { id: existing.id },
          data: {
            name: parsed.name,
            academicSessionId: session?.id,
            termId: term?.id,
            minAge: parsed.minAge,
            maxAge: parsed.maxAge,
            requiredDocuments: parseCsv(parsed.requiredDocuments),
            formFields: ["biodata", "guardian", "medical", "previousSchool"],
            applicationFeeAmount: parsed.applicationFeeAmount,
            applicationFeeRequired: parsed.applicationFeeRequired,
            screeningRequired: parsed.screeningRequired,
            principalApprovalRequired: parsed.principalApprovalRequired,
            bursarClearanceRequired: parsed.bursarClearanceRequired,
            offerExpiryDays: parsed.offerExpiryDays,
            openClasses: { set: openClasses.map((item) => ({ id: item.id })) }
          },
          include: { academicSession: true, term: true, openClasses: true }
        })
      : await prisma.admissionConfig.create({
          data: {
            schoolId,
            name: parsed.name,
            academicSessionId: session?.id,
            termId: term?.id,
            minAge: parsed.minAge,
            maxAge: parsed.maxAge,
            requiredDocuments: parseCsv(parsed.requiredDocuments),
            formFields: ["biodata", "guardian", "medical", "previousSchool"],
            applicationFeeAmount: parsed.applicationFeeAmount,
            applicationFeeRequired: parsed.applicationFeeRequired,
            screeningRequired: parsed.screeningRequired,
            principalApprovalRequired: parsed.principalApprovalRequired,
            bursarClearanceRequired: parsed.bursarClearanceRequired,
            offerExpiryDays: parsed.offerExpiryDays,
            openClasses: { connect: openClasses.map((item) => ({ id: item.id })) }
          },
          include: { academicSession: true, term: true, openClasses: true }
        });

    return mapConfig(saved);
  }

  async createAdmission(schoolId: string, payload: unknown) {
    return this.createApplication(schoolId, undefined, payload);
  }

  async createApplication(schoolId: string, actorId: string | undefined, payload: unknown) {
    const parsed = admissionSchema.parse(payload);
    const desiredClassName = formatNigeriaClassName(parsed.desiredClass);
    const status: AdmissionStatus = parsed.draft ? "DRAFT" : "SUBMITTED";

    const [desiredClass, currentSession, currentTerm, duplicate] = await Promise.all([
      prisma.classRoom.findFirst({
        where: { schoolId, OR: classLookupConditions(desiredClassName) }
      }),
      prisma.academicSession.findFirst({ where: { schoolId, isCurrent: true } }),
      prisma.term.findFirst({ where: { schoolId, isCurrent: true } }),
      prisma.admissionApplication.findFirst({
        where: {
          schoolId,
          OR: [
            { guardianPhone: parsed.guardianPhone },
            { firstName: parsed.firstName, lastName: parsed.lastName }
          ]
        }
      })
    ]);

    const created = await prisma.admissionApplication.create({
      data: {
        schoolId,
        academicSessionId: currentSession?.id,
        termId: currentTerm?.id,
        desiredClassId: desiredClass?.id,
        applicationNo: `ADM-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        middleName: parsed.middleName || null,
        guardianName: parsed.guardianName,
        guardianPhone: parsed.guardianPhone,
        guardianEmail: parsed.guardianEmail || null,
        address: parsed.address || null,
        emergencyContactName: parsed.emergencyContactName || null,
        emergencyContactPhone: parsed.emergencyContactPhone || null,
        previousSchool: parsed.previousSchool || null,
        medicalNotes: parsed.medicalNotes || null,
        gender: parsed.gender,
        dateOfBirth: parsed.dateOfBirth ? new Date(parsed.dateOfBirth) : new Date("2014-01-01"),
        status,
        duplicateFlag: Boolean(duplicate),
        duplicateReason: duplicate ? "Similar name or guardian phone already exists." : null,
        applicationFeeStatus: "PENDING",
        history: {
          create: {
            schoolId,
            toStatus: status,
            changedById: actorId,
            note: status === "DRAFT" ? "Draft saved." : "Application submitted."
          }
        }
      },
      include: {
        desiredClass: true,
        registeredStudent: { select: { id: true, admissionNumber: true } },
        documents: true,
        reviews: { include: { reviewer: { select: { firstName: true, lastName: true } } } },
        screenings: true,
        offers: true,
        comments: { include: { author: { select: { firstName: true, lastName: true } } } },
        history: { include: { changedBy: { select: { firstName: true, lastName: true } } } }
      }
    });

    const view = mapAdmission(created);
    await this.audit(schoolId, actorId, "CREATE", created.id, { status });
    await this.notify(schoolId, view, "Application submitted", `Application ${view.applicationNo} has been received.`);
    return view;
  }

  async submitApplication(schoolId: string, actorId: string | undefined, applicationId: string) {
    const application = await this.getAdmission(schoolId, applicationId);
    ensureStatus(application, ["DRAFT"], "Submit application");
    return this.setStatus(schoolId, actorId, applicationId, "SUBMITTED", "Application submitted.");
  }

  private async setStatus(schoolId: string, actorId: string | undefined, applicationId: string, status: AdmissionStatus, note: string, extra: Record<string, unknown> = {}) {
    await this.transition(schoolId, applicationId, actorId, status, note, extra);
    return this.getAdmission(schoolId, applicationId);
  }

  async reviewAdmission(schoolId: string, reviewerId: string, reviewerName: string, applicationId: string, payload: unknown) {
    const parsed = reviewAdmissionSchema.parse(payload);
    const application = await this.getAdmission(schoolId, applicationId);
    ensureStatus(application, ["SUBMITTED", "INCOMPLETE", "AWAITING_DOCUMENTS"], "Review application");
    const recommendedClassName = parsed.recommendedClass ? formatNigeriaClassName(parsed.recommendedClass) : "";
    const reviewNotes = [
      parsed.notes,
      recommendedClassName ? `Recommended class: ${recommendedClassName}` : null,
      parsed.documentStatus ? `Document status: ${parsed.documentStatus}` : null,
      parsed.screeningOutcome ? `Screening outcome: ${parsed.screeningOutcome}` : null
    ]
      .filter(Boolean)
      .join("\n");

    const recommendedClass = recommendedClassName
      ? await prisma.classRoom.findFirst({
          where: { schoolId, OR: classLookupConditions(recommendedClassName) }
        })
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.admissionReview.create({
        data: { applicationId, reviewerId, decision: "REVIEWING", notes: reviewNotes }
      });
      await tx.admissionComment.create({
        data: { schoolId, applicationId, authorId: reviewerId, body: reviewNotes, isInternal: true }
      });
    });

    return this.setStatus(schoolId, reviewerId, applicationId, "REVIEWING", reviewNotes, {
      reviewerId,
      desiredClassId: recommendedClass?.id
    });
  }

  async requestDocuments(schoolId: string, actorId: string, applicationId: string, payload: unknown) {
    const parsed = documentRequestSchema.parse(payload);
    const application = await this.getAdmission(schoolId, applicationId);
    ensureStatus(application, ["SUBMITTED", "REVIEWING", "INCOMPLETE"], "Request documents");
    const note = `${parsed.note}\n${parsed.missingDocuments}`;
    const updated = await this.setStatus(schoolId, actorId, applicationId, "AWAITING_DOCUMENTS", note);
    await this.notify(schoolId, updated, "Documents required", `Please provide: ${parsed.missingDocuments}`);
    return updated;
  }

  async verifyApplicationFee(schoolId: string, actorId: string, applicationId: string, payload: unknown) {
    const parsed = paymentVerificationSchema.parse(payload);
    const application = await this.getAdmission(schoolId, applicationId);
    if (finalStatuses.includes(application.status)) {
      throw new BadRequestException("Application fee cannot be changed after a final status.");
    }
    const status: AdmissionPaymentStatus = parsed.waived ? "WAIVED" : "VERIFIED";
    const note = parsed.waived ? `Application fee waived. ${parsed.note}` : `Application fee verified. ${parsed.reference}`;

    await prisma.admissionPaymentLink.create({
      data: {
        schoolId,
        applicationId,
        verifiedById: actorId,
        reference: parsed.reference || `ADM-FEE-${Date.now().toString().slice(-8)}`,
        amount: parsed.amount,
        status,
        waived: parsed.waived,
        verifiedAt: new Date(),
        metadata: { note: parsed.note }
      }
    });

    const updated = await this.setStatus(schoolId, actorId, applicationId, "PAYMENT_PENDING", note, {
      applicationFeeStatus: status,
      feeWaived: parsed.waived
    });
    await this.audit(schoolId, actorId, "PAYMENT", applicationId, { status, amount: parsed.amount, waived: parsed.waived });
    return updated;
  }

  async scheduleScreening(schoolId: string, actorId: string, applicationId: string, payload: unknown) {
    const parsed = screeningScheduleSchema.parse(payload);
    const application = await this.getAdmission(schoolId, applicationId);
    ensureStatus(application, ["REVIEWING", "PAYMENT_PENDING"], "Schedule screening");
    if (!isFeeCleared(application)) {
      throw new BadRequestException("Application fee must be verified or waived before screening.");
    }

    await prisma.admissionScreening.create({
      data: {
        schoolId,
        applicationId,
        interviewerId: parsed.interviewerId || null,
        scheduledAt: new Date(parsed.scheduledAt),
        venue: parsed.venue || null
      }
    });
    const updated = await this.setStatus(schoolId, actorId, applicationId, "SCREENING_SCHEDULED", parsed.note || "Screening scheduled.");
    await this.notify(schoolId, updated, "Screening scheduled", `Screening is scheduled for ${new Date(parsed.scheduledAt).toLocaleString("en-NG")}.`);
    return updated;
  }

  async recordScreeningResult(schoolId: string, actorId: string, applicationId: string, payload: unknown) {
    const parsed = screeningResultSchema.parse(payload);
    const application = await this.getAdmission(schoolId, applicationId);
    ensureStatus(application, ["SCREENING_SCHEDULED"], "Record screening result");

    const screening = await prisma.admissionScreening.findFirst({
      where: { schoolId, applicationId },
      orderBy: { scheduledAt: "desc" }
    });
    if (!screening) throw new BadRequestException("No screening schedule found for this application.");
    await prisma.admissionScreening.update({
      where: { id: screening.id },
      data: {
        score: parsed.score,
        maxScore: parsed.maxScore,
        result: parsed.result,
        recommendation: parsed.recommendation,
        remarks: parsed.remarks,
        attachmentUrl: parsed.attachmentUrl || null,
        completedAt: new Date()
      }
    });
    return this.setStatus(schoolId, actorId, applicationId, "SCREENING_COMPLETED", parsed.remarks);
  }

  async recommendApplication(schoolId: string, actorId: string, applicationId: string, payload: unknown) {
    const parsed = recommendationSchema.parse(payload);
    const application = await this.getAdmission(schoolId, applicationId);
    ensureStatus(application, ["SCREENING_COMPLETED", "REVIEWING"], "Recommend application");
    return this.setStatus(schoolId, actorId, applicationId, "RECOMMENDED", parsed.notes);
  }

  async decideAdmission(schoolId: string, reviewerId: string, applicationId: string, payload: unknown) {
    return this.decideApplication(schoolId, reviewerId, applicationId, payload);
  }

  async decideApplication(schoolId: string, reviewerId: string, applicationId: string, payload: unknown) {
    const parsed = admissionDecisionSchema.parse(payload);
    const application = await this.getAdmission(schoolId, applicationId);
    ensureStatus(application, ["RECOMMENDED"], "Make final admission decision");

    await prisma.admissionReview.create({
      data: {
        applicationId,
        reviewerId,
        decision: parsed.decision,
        notes: [parsed.notes, parsed.conditions ? `Conditions: ${parsed.conditions}` : null].filter(Boolean).join("\n")
      }
    });

    const updated = await this.setStatus(schoolId, reviewerId, applicationId, parsed.decision, parsed.notes, {
      decidedAt: new Date(),
      notes: parsed.conditions || parsed.notes
    });
    if (parsed.decision === "REJECTED" || parsed.decision === "WAITLISTED") {
      await this.notify(schoolId, updated, `Application ${parsed.decision.toLowerCase()}`, parsed.notes);
    }
    return updated;
  }

  async issueOffer(schoolId: string, actorId: string, applicationId: string, payload: unknown) {
    const parsed = offerSchema.parse(payload);
    const application = await this.getAdmission(schoolId, applicationId);
    ensureStatus(application, ["APPROVED", "CONDITIONALLY_APPROVED"], "Issue offer");
    const settings = await this.getAdmissionSettings(schoolId);
    const expiresAt = addDays(new Date(), parsed.expiryDays ?? settings.offerExpiryDays);

    await prisma.admissionOffer.create({
      data: {
        schoolId,
        applicationId,
        issuedById: actorId,
        offerNumber: `OFFER-${Date.now().toString().slice(-8)}`,
        status: "SENT",
        conditions: parsed.conditions || null,
        checklist: parseCsv(parsed.checklist),
        sentAt: new Date(),
        expiresAt
      }
    });

    const updated = await this.setStatus(schoolId, actorId, applicationId, "OFFER_SENT", "Admission offer sent.", {
      notes: parsed.conditions || null
    });
    updated.offerStatus = "SENT";
    updated.offerExpiresAt = expiresAt.toISOString();
    await this.notify(schoolId, updated, "Admission offer sent", `Your admission offer ${updated.applicationNo} is ready.`);
    return updated;
  }

  async acceptOffer(schoolId: string, applicationId: string, payload: unknown) {
    const parsed = offerResponseSchema.parse(payload);
    const application = await this.getAdmission(schoolId, applicationId);
    ensureStatus(application, ["OFFER_SENT"], "Accept offer");
    const offer = await prisma.admissionOffer.findFirst({ where: { schoolId, applicationId }, orderBy: { createdAt: "desc" } });
    if (offer && offer.expiresAt < new Date()) throw new BadRequestException("This offer has expired.");
    if (offer) {
      await prisma.admissionOffer.update({
        where: { id: offer.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() }
      });
    }
    const updated = await this.setStatus(schoolId, undefined, applicationId, "ACCEPTED", parsed.note || "Offer accepted.", {
      acceptedAt: new Date()
    });
    await this.notify(schoolId, updated, "Offer accepted", "Your offer acceptance has been recorded.");
    return updated;
  }

  async declineOffer(schoolId: string, applicationId: string, payload: unknown) {
    const parsed = offerResponseSchema.parse(payload);
    const application = await this.getAdmission(schoolId, applicationId);
    ensureStatus(application, ["OFFER_SENT"], "Decline offer");
    const offer = await prisma.admissionOffer.findFirst({ where: { schoolId, applicationId }, orderBy: { createdAt: "desc" } });
    if (offer) await prisma.admissionOffer.update({ where: { id: offer.id }, data: { status: "DECLINED", declinedAt: new Date() } });
    return this.setStatus(schoolId, undefined, applicationId, "DECLINED", parsed.note || "Offer declined.");
  }

  async markFinanciallyCleared(schoolId: string, actorId: string, applicationId: string, payload: unknown) {
    const parsed = paymentVerificationSchema.parse(payload);
    const application = await this.getAdmission(schoolId, applicationId);
    ensureStatus(application, ["ACCEPTED"], "Mark financial clearance");
    if (!parsed.waived && parsed.amount <= 0 && !isFeeCleared(application)) {
      throw new BadRequestException("Financial clearance requires payment verification or an approved waiver.");
    }
    await prisma.$transaction(async (tx) => {
      await tx.admissionPaymentLink.create({
        data: {
          schoolId,
          applicationId,
          verifiedById: actorId,
          reference: parsed.reference || `ADM-CLEAR-${Date.now().toString().slice(-8)}`,
          amount: parsed.amount,
          status: parsed.waived ? "WAIVED" : "VERIFIED",
          waived: parsed.waived,
          verifiedAt: new Date(),
          metadata: { note: parsed.note }
        }
      });
      await tx.financialClearance.create({
        data: {
          schoolId,
          admissionApplicationId: applicationId,
          clearedById: actorId,
          status: parsed.waived ? "WAIVED" : "CLEARED",
          reason: parsed.note || (parsed.waived ? "Admission fee waived." : "Admission payment verified."),
          clearedAt: new Date(),
          metadata: { reference: parsed.reference || null, amount: parsed.amount }
        }
      });
    });
    const updated = await this.setStatus(schoolId, actorId, applicationId, "FINANCIALLY_CLEARED", parsed.note || "Financially cleared.", {
      applicationFeeStatus: parsed.waived ? "WAIVED" : "VERIFIED",
      feeWaived: parsed.waived
    });
    await this.notify(schoolId, updated, "Financial clearance confirmed", "Your admission financial clearance is complete.");
    return updated;
  }

  async registerApprovedAdmission(schoolId: string, applicationId: string, payload: unknown): Promise<StudentRecordView> {
    return this.enrollApplicant(schoolId, undefined, applicationId, payload);
  }

  async enrollApplicant(schoolId: string, actorId: string | undefined, applicationId: string, payload: unknown): Promise<StudentRecordView> {
    const parsed = registerAdmissionSchema.parse(payload);
    const className = formatNigeriaClassName(parsed.className);
    const application = await this.getAdmission(schoolId, applicationId);
    ensureStatus(application, ["FINANCIALLY_CLEARED"], "Enroll applicant");
    if (application.registeredStudentId) {
      throw new BadRequestException("This application has already been enrolled.");
    }

    const dbApplication = await prisma.admissionApplication.findFirstOrThrow({
      where: { id: applicationId, schoolId },
      include: { documents: true }
    });
    const [currentClass, currentSession] = await Promise.all([
      prisma.classRoom.findFirst({ where: { schoolId, OR: classLookupConditions(className) } }),
      prisma.academicSession.findFirst({ where: { schoolId, isCurrent: true } })
    ]);
    const guardianName = splitFullName(dbApplication.guardianName);
    const student = await prisma.$transaction(async (tx) => {
      const guardian = await tx.guardian.create({
        data: {
          schoolId,
          firstName: guardianName.firstName,
          lastName: guardianName.lastName,
          phone: dbApplication.guardianPhone,
          email: dbApplication.guardianEmail,
          relationship: parsed.guardianRelationship,
          address: dbApplication.address
        }
      });
      const created = await tx.student.create({
        data: {
          schoolId,
          campusId: dbApplication.campusId,
          admissionNumber: parsed.admissionNumber || `ADM/${Date.now().toString().slice(-6)}`,
          firstName: dbApplication.firstName,
          lastName: dbApplication.lastName,
          middleName: dbApplication.middleName,
          gender: dbApplication.gender,
          dateOfBirth: dbApplication.dateOfBirth,
          admissionDate: new Date(),
          currentClassId: currentClass?.id ?? dbApplication.desiredClassId,
          currentSessionId: currentSession?.id,
          guardians: { create: { guardianId: guardian.id, isPrimary: true } },
          medicalRecord: {
            create: {
              bloodGroup: parsed.bloodGroup || null,
              genotype: parsed.genotype || null,
              allergies: parsed.allergies || null,
              conditions: parsed.conditions || dbApplication.medicalNotes
            }
          },
          documents: {
            create: dbApplication.documents.map((document) => ({
              label: document.label,
              fileName: document.label,
              fileUrl: document.fileUrl,
              mimeType: document.mimeType,
              sizeBytes: document.sizeBytes
            }))
          }
        },
        include: { currentClass: true }
      });
      await tx.admissionApplication.update({
        where: { id: dbApplication.id },
        data: { registeredStudentId: created.id, status: "ENROLLED", enrolledAt: new Date() }
      });
      await tx.enrollmentConversionLog.create({
        data: {
          schoolId,
          applicationId,
          studentId: created.id,
          convertedById: actorId,
          portalAccountsCreated: parsed.portalAccountsCreated,
          notes: "Converted from admissions workflow."
        }
      });
      await tx.admissionStatusHistory.create({
        data: {
          schoolId,
          applicationId,
          fromStatus: "FINANCIALLY_CLEARED",
          toStatus: "ENROLLED",
          changedById: actorId,
          note: `Enrolled as ${created.admissionNumber}.`
        }
      });
      return created;
    });

    await this.notify(schoolId, application, "Enrollment complete", `Student record ${student.admissionNumber} has been created.`);
    return {
      id: student.id,
      admissionNumber: student.admissionNumber,
      fullName: `${student.firstName} ${student.lastName}`,
      className: formatClassName(student.currentClass?.name ?? className, student.currentClass?.arm),
      guardianName: application.guardianName,
      status: student.status,
      attendanceRate: 0,
      averageScore: 0,
      outstandingBalance: 0
    };
  }

  async addComment(schoolId: string, actorId: string, applicationId: string, payload: unknown) {
    const parsed = commentSchema.parse(payload);
    await this.getAdmission(schoolId, applicationId);
    await prisma.admissionComment.create({
      data: { schoolId, applicationId, authorId: actorId, body: parsed.body, isInternal: parsed.isInternal }
    });
    return this.getAdmission(schoolId, applicationId);
  }
}
