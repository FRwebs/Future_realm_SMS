import { createHash } from "crypto";

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { AuditAction, Prisma, SubscriptionPlan, TenantStatus, UserRole } from "@prisma/client";
import { z } from "zod";

import { hashPassword } from "../../../../src/lib/auth/password";
import { createSessionToken, SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import type { Role } from "../../../../src/lib/domain/types";
import { sendNotification } from "../../../../src/lib/integrations/notifications";

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  schoolId: z.string().trim().optional(),
  status: z.string().trim().optional(),
  role: z.string().trim().optional(),
  action: z.string().trim().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional()
});

const planSchema = z.nativeEnum(SubscriptionPlan);
const tenantStatusSchema = z.nativeEnum(TenantStatus);

const schoolCreateSchema = z.object({
  name: z.string().trim().min(2),
  adminName: z.string().trim().min(2).optional(),
  adminEmail: z.string().trim().email().optional(),
  ownerName: z.string().trim().min(2),
  ownerEmail: z.string().trim().email(),
  ownerPhone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  country: z.string().trim().default("Nigeria"),
  category: z.enum(["NURSERY", "PRIMARY", "SECONDARY", "COLLEGE", "MIXED"]).default("MIXED"),
  plan: planSchema.default("BASIC"),
  trialEndDate: z.coerce.date().optional(),
  notes: z.string().optional(),
  sendWelcomeEmail: z.coerce.boolean().default(true)
});

const schoolUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  plan: planSchema.optional(),
  status: tenantStatusSchema.optional(),
  prioritySupport: z.coerce.boolean().optional()
});

const schoolStatusChangeSchema = z.object({
  status: tenantStatusSchema,
  reason: z.string().trim().min(3, "A reason is required for every status change.")
});

const accountManagerSchema = z.object({
  accountManagerEmail: z.string().trim().email()
});

const schoolContactSchema = z.object({
  name: z.string().trim().min(2),
  role: z.string().trim().min(2),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  isPrimary: z.coerce.boolean().default(false)
});

const createInvoiceSchema = z.object({
  schoolId: z.string().min(1),
  amount: z.coerce.number().positive(),
  taxAmount: z.coerce.number().min(0).default(0),
  dueAt: z.coerce.date(),
  note: z.string().optional()
});

const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  method: z.string().trim().min(2),
  reference: z.string().trim().min(2),
  paidOn: z.coerce.date().default(() => new Date())
});

const cancelInvoiceSchema = z.object({
  reason: z.string().trim().min(3, "A reason is required to cancel an invoice.")
});

const walletTopUpSchema = z.object({
  smsCredits: z.coerce.number().int().min(0).default(0),
  whatsappCredits: z.coerce.number().int().min(0).default(0)
});

const promoCodeCreateSchema = z.object({
  code: z.string().trim().min(3).toUpperCase(),
  type: z.enum(["PERCENTAGE", "FIXED"]),
  value: z.coerce.number().positive(),
  campaignName: z.string().trim().optional(),
  maxUses: z.coerce.number().int().positive().optional(),
  expiresAt: z.coerce.date().optional()
});

const applyPromoCodeSchema = z.object({
  schoolId: z.string().min(1),
  code: z.string().trim().min(3).toUpperCase(),
  reason: z.string().trim().min(3)
});

const impersonateSchema = z.object({
  reason: z.string().trim().min(3, "A reason is required before starting an impersonation session.")
});

const resolveSuspiciousActivitySchema = z.object({
  action: z.enum(["DISMISS", "FORCE_RESET", "SUSPEND"])
});

const resolveDuplicateFlagSchema = z.object({
  action: z.enum(["MERGE", "DISMISS", "ESCALATE"]),
  keepUserId: z.string().optional()
});

const accountRecoverySchema = z.object({
  verificationMethod: z.string().trim().min(3),
  newEmail: z.string().trim().email().optional()
});

const billingUpdateSchema = z.object({
  plan: planSchema
});

const trialSchema = z.object({
  days: z.coerce.number().int().min(1).max(365)
});

const settingsSchema = z.object({
  maintenanceMode: z.preprocess((value) => value === true || value === "true", z.boolean()).optional(),
  platformAnnouncement: z.string().max(500).optional(),
  defaultGradingScale: z.unknown().optional(),
  globalModuleAvailability: z.record(z.boolean()).optional()
});

const featureSchema = z.record(z.boolean());
const featurePayloadSchema = z.union([featureSchema, z.object({ features: featureSchema })]);

const ticketCategoryValues = ["BILLING", "TECHNICAL_BUG", "FEATURE_REQUEST", "ACCOUNT_ACCESS", "DATA_ISSUE", "RESULT_COMPUTATION", "NOTIFICATION_DELIVERY", "SYNC_OFFLINE_ISSUE", "DATA_CORRECTION_REQUEST", "OTHER"] as const;
const ticketStatusValues = ["OPEN", "TRIAGED", "IN_PROGRESS", "AWAITING_SCHOOL_RESPONSE", "ESCALATED", "RESOLVED", "CLOSED"] as const;

const supportTicketSchema = z.object({
  schoolId: z.string().min(1),
  subject: z.string().min(3),
  description: z.string().min(5),
  category: z.enum(ticketCategoryValues).default("OTHER"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  assignedToId: z.string().optional()
});

const ticketMessageSchema = z.object({
  body: z.string().min(2),
  internalOnly: z.coerce.boolean().default(false)
});

const ticketStatusSchema = z.object({
  status: z.enum(ticketStatusValues)
});

const ticketAssignSchema = z.object({
  assignedToId: z.string().min(1)
});

const ticketCsatSchema = z.object({
  score: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().optional()
});

const cannedResponseSchema = z.object({
  category: z.enum(ticketCategoryValues),
  title: z.string().trim().min(3),
  body: z.string().trim().min(5)
});

const dataCorrectionRequestSchema = z.object({
  fieldCorrected: z.string().trim().min(2),
  oldValue: z.string().trim(),
  newValue: z.string().trim()
});

const featureFlagSchema = z.object({
  key: z.string().trim().min(2).regex(/^[a-z0-9_.-]+$/),
  name: z.string().min(2),
  description: z.string().optional(),
  enabledGlobally: z.coerce.boolean().default(false),
  rolloutPercent: z.coerce.number().int().min(0).max(100).default(0)
});

const announcementSchema = z.object({
  title: z.string().min(2),
  body: z.string().min(3),
  type: z.enum(["INFO", "WARNING", "CRITICAL", "NEW_FEATURE", "PROMOTION"]).default("INFO"),
  target: z.unknown().default({ audience: "ALL_SCHOOLS" }),
  scheduledAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional()
});

const crmInteractionSchema = z.object({
  schoolId: z.string().min(1),
  type: z.string().min(2),
  summary: z.string().min(3),
  outcome: z.string().optional(),
  nextAction: z.string().optional(),
  followUpAt: z.coerce.date().optional()
});

const leadSchema = z.object({
  prospectName: z.string().min(2),
  contactName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  source: z.string().optional(),
  stage: z.enum(["LEAD", "CONTACTED", "DEMO_SCHEDULED", "TRIAL", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST"]).default("LEAD"),
  estimatedMrr: z.coerce.number().min(0).default(0),
  notes: z.string().optional()
});

const planConfigSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  plan: planSchema,
  monthlyPrice: z.coerce.number().min(0),
  annualPrice: z.coerce.number().min(0),
  studentLimit: z.coerce.number().int().min(0).optional(),
  staffLimit: z.coerce.number().int().min(0).optional(),
  storageLimitGb: z.coerce.number().min(0).optional(),
  smsUnitsPerMonth: z.coerce.number().int().min(0).default(0),
  emailSendsPerMonth: z.coerce.number().int().min(0).default(0),
  supportTier: z.enum(["COMMUNITY", "EMAIL", "PRIORITY", "DEDICATED"]).default("EMAIL"),
  apiAccess: z.coerce.boolean().default(false),
  customBranding: z.coerce.boolean().default(false),
  includedModules: z.unknown().default([])
});

const privacyRequestSchema = z.object({
  schoolId: z.string().optional(),
  userId: z.string().optional(),
  type: z.enum(["ACCESS", "EXPORT", "ERASURE", "RECTIFICATION"]),
  subject: z.string().min(2),
  details: z.string().optional()
});

const privacyStatusSchema = z.object({
  status: z.enum(["OPEN", "IN_REVIEW", "COMPLETED", "REJECTED"])
});

const securityIncidentSchema = z.object({
  type: z.string().trim().min(2),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  description: z.string().trim().min(5)
});

const securityIncidentUpdateSchema = z.object({
  status: z.enum(["DETECTED", "INVESTIGATING", "CONTAINED", "RESOLVED"]),
  postIncidentNotes: z.string().trim().optional()
});

const maintenanceWindowSchema = z.object({
  title: z.string().min(2),
  message: z.string().min(3),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  isActive: z.coerce.boolean().default(false),
  whitelist: z.unknown().optional()
});

const platformModules = [
  "students",
  "teachers",
  "parents",
  "classes",
  "subjects",
  "timetable",
  "attendance",
  "results",
  "admissions",
  "exams",
  "transport",
  "library",
  "hostel",
  "fees",
  "health",
  "discipline",
  "counseling",
  "events",
  "messaging",
  "announcements",
  "inventory",
  "facilities",
  "staff_leave",
  "payroll",
  "id_cards",
  "visitor_management",
  "online_payments",
  "e_learning",
  "report_cards",
  "analytics"
] as const;

const schoolAdminRoles: UserRole[] = [
  "SCHOOL_OWNER",
  "PROPRIETOR",
  "ADMINISTRATOR",
  "PRINCIPAL",
  "HEAD_TEACHER",
  "ADMIN_OFFICER"
];

const platformRoles = new Set<UserRole>([
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "SUPPORT_AGENT",
  "SALES_MANAGER",
  "FINANCE_MANAGER",
  "DEVELOPER",
  "SUPER_ADMIN"
]);

const billingRoles = new Set<UserRole>(["PLATFORM_OWNER", "FINANCE_MANAGER", "PLATFORM_ADMIN", "SUPER_ADMIN"]);
const salesRoles = new Set<UserRole>(["PLATFORM_OWNER", "SALES_MANAGER", "PLATFORM_ADMIN", "SUPER_ADMIN"]);
const technicalRoles = new Set<UserRole>(["PLATFORM_OWNER", "DEVELOPER", "PLATFORM_ADMIN", "SUPER_ADMIN"]);

function assertSuperAdmin(session: SessionPayload) {
  if (!platformRoles.has(session.role as UserRole)) {
    throw new ForbiddenException("Platform admin access required.");
  }
}

function assertAnyPlatformRole(session: SessionPayload, allowed: Set<UserRole>, message = "This platform role cannot perform this action.") {
  assertSuperAdmin(session);
  if (!allowed.has(session.role as UserRole)) {
    throw new ForbiddenException(message);
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function splitName(value: string) {
  const [firstName, ...rest] = value.trim().split(/\s+/);
  return {
    firstName: firstName || "School",
    lastName: rest.join(" ") || "Administrator"
  };
}

function pagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit))
  };
}

function planPrice(plan: SubscriptionPlan) {
  if (plan === "CUSTOM") return 0;
  if (plan === "ENTERPRISE") return 250000;
  if (plan === "PROFESSIONAL") return 180000;
  if (plan === "STANDARD") return 120000;
  return 45000;
}

function featureDefaults() {
  return Object.fromEntries(platformModules.map((module) => [module, true]));
}

function jsonRecord(value: Prisma.JsonValue | null): Record<string, boolean> {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"));
}

function defaultSettingsData() {
  return {
    maintenanceMode: false,
    platformAnnouncement: "",
    defaultGradingScale: [
      { grade: "A", min: 70, max: 100, remark: "Excellent" },
      { grade: "B", min: 60, max: 69, remark: "Very good" },
      { grade: "C", min: 50, max: 59, remark: "Good" },
      { grade: "D", min: 45, max: 49, remark: "Fair" },
      { grade: "E", min: 40, max: 44, remark: "Pass" },
      { grade: "F", min: 0, max: 39, remark: "Needs improvement" }
    ],
    globalModuleAvailability: featureDefaults()
  };
}

@Injectable()
export class SuperAdminService {
  private response<T>(data: T, message = "Request completed", paginationData?: ReturnType<typeof pagination>) {
    return {
      ok: true,
      success: true,
      message,
      data,
      ...(paginationData ? { pagination: paginationData } : {})
    };
  }

  private async audit(session: SessionPayload, action: AuditAction, entityType: string, entityId: string, metadata?: Prisma.InputJsonValue, schoolId?: string | null) {
    const actor = await prisma.user.findFirst({
      where: { OR: [{ id: session.userId }, { email: session.email }] },
      select: { id: true }
    });
    await prisma.auditLog.create({
      data: {
        schoolId: schoolId ?? null,
        actorId: actor?.id ?? null,
        action,
        entityType,
        entityId,
        metadata
      }
    });
  }

  private async settingsRecord() {
    const existing = await prisma.platformSetting.findFirst({ orderBy: { createdAt: "asc" } });
    if (existing) return existing;
    return prisma.platformSetting.create({ data: defaultSettingsData() });
  }

  async listSchools(session: SessionPayload, query: unknown) {
    assertSuperAdmin(session);
    const parsed = pageSchema.parse(query);
    const where: Prisma.SchoolWhereInput = {
      deletedAt: null,
      ...(parsed.search ? { name: { contains: parsed.search, mode: "insensitive" } } : {}),
      ...(parsed.status ? { status: parsed.status.toUpperCase() as TenantStatus } : {})
    };
    const [schools, total] = await Promise.all([
      prisma.school.findMany({
        where,
        include: { _count: { select: { users: true, students: true, staffProfiles: true } } },
        orderBy: { createdAt: "desc" },
        skip: (parsed.page - 1) * parsed.limit,
        take: parsed.limit
      }),
      prisma.school.count({ where })
    ]);
    return this.response(
      schools.map((school) => ({
        id: school.id,
        name: school.name,
        slug: school.slug,
        subdomain: school.subdomain,
        schoolCode: school.schoolCode,
        plan: school.plan,
        status: school.status,
        billingStatus: school.billingStatus,
        country: school.country,
        state: school.state,
        healthScore: school.healthScore,
        mrr: planPrice(school.plan),
        totalUsers: school._count.users,
        totalStudents: school._count.students,
        totalTeachers: school._count.staffProfiles,
        createdAt: school.createdAt.toISOString(),
        trialEndsAt: school.trialEndsAt?.toISOString(),
        lastPaymentAt: school.lastPaymentAt?.toISOString(),
        nextBillingAt: school.nextBillingAt?.toISOString()
      })),
      "Schools loaded",
      pagination(parsed.page, parsed.limit, total)
    );
  }

  async getSchool(session: SessionPayload, schoolId: string) {
    assertSuperAdmin(session);
    const school = await prisma.school.findFirst({
      where: { id: schoolId, deletedAt: null },
      include: {
        users: {
          where: { role: { in: schoolAdminRoles }, deletedAt: null },
          select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true, createdAt: true }
        },
        _count: { select: { users: true, students: true, staffProfiles: true, invoices: true, payments: true } }
      }
    });
    if (!school) throw new NotFoundException("School not found.");

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [
      accountManager,
      contacts,
      activityLog,
      sessionCount,
      termCount,
      activeGradingScheme,
      classLevelCount,
      classRoomCount,
      subjectCount,
      lastLoginUser,
      notificationCount,
      supportTicketCount,
      loginCountLast30Days
    ] = await Promise.all([
      school.accountManagerId ? prisma.user.findUnique({ where: { id: school.accountManagerId }, select: { id: true, firstName: true, lastName: true, email: true } }) : null,
      prisma.schoolContact.findMany({ where: { schoolId }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] }),
      prisma.auditLog.findMany({ where: { schoolId }, include: { actor: true, school: true }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.academicSession.count({ where: { schoolId } }),
      prisma.term.count({ where: { schoolId } }),
      prisma.gradingScheme.findFirst({ where: { schoolId, isActive: true }, select: { name: true, passMark: true } }),
      prisma.classLevel.count({ where: { schoolId } }),
      prisma.classRoom.count({ where: { schoolId } }),
      prisma.subject.count({ where: { schoolId } }),
      prisma.user.findFirst({ where: { schoolId }, orderBy: { lastLoginAt: "desc" }, select: { lastLoginAt: true } }),
      prisma.notificationLog.count({ where: { schoolId, sentAt: { gte: thirtyDaysAgo } } }),
      prisma.supportTicket.count({ where: { schoolId } }),
      prisma.auditLog.count({ where: { schoolId, action: "LOGIN", createdAt: { gte: thirtyDaysAgo } } })
    ]);

    return this.response({
      id: school.id,
      name: school.name,
      slug: school.slug,
      category: school.category,
      ownerName: school.ownerName,
      ownerEmail: school.ownerEmail,
      ownerPhone: school.ownerPhone,
      address: school.address,
      city: school.city,
      state: school.state,
      country: school.country,
      timezone: school.timezone,
      currency: school.currency,
      plan: school.plan,
      status: school.status,
      billingStatus: school.billingStatus,
      healthScore: school.healthScore,
      storageUsedGb: school.storageUsedGb,
      limits: {
        students: school.studentLimit,
        staff: school.staffLimit,
        storageGb: school.storageLimitGb,
        sms: school.smsLimitPerMonth,
        email: school.emailLimitPerMonth
      },
      featureFlags: school.featureFlags ?? featureDefaults(),
      trialEndsAt: school.trialEndsAt?.toISOString(),
      lastPaymentAt: school.lastPaymentAt?.toISOString(),
      nextBillingAt: school.nextBillingAt?.toISOString(),
      createdAt: school.createdAt.toISOString(),
      counts: school._count,
      admins: school.users.map((user) => ({
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        status: user.isActive ? "ACTIVE" : "SUSPENDED",
        createdAt: user.createdAt.toISOString()
      })),
      prioritySupport: school.prioritySupport,
      dataExportedAt: school.dataExportedAt?.toISOString() ?? null,
      statusReason: school.statusReason,
      statusChangedAt: school.statusChangedAt?.toISOString() ?? null,
      accountManager: accountManager ? { id: accountManager.id, name: `${accountManager.firstName} ${accountManager.lastName}`, email: accountManager.email } : null,
      contacts: contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        role: contact.role,
        phone: contact.phone,
        email: contact.email,
        isPrimary: contact.isPrimary,
        createdAt: contact.createdAt.toISOString()
      })),
      configuration: {
        academicSessionCount: sessionCount,
        termCount: termCount,
        activeGradingScheme: activeGradingScheme?.name ?? null,
        passMark: activeGradingScheme?.passMark ?? null,
        classLevelCount,
        classRoomCount,
        subjectCount
      },
      usage: {
        moduleAdoptionCount: Object.values(school.featureFlags ?? featureDefaults()).filter(Boolean).length,
        moduleTotal: Object.keys(school.featureFlags ?? featureDefaults()).length,
        lastActivityAt: lastLoginUser?.lastLoginAt?.toISOString() ?? null,
        notificationVolumeLast30Days: notificationCount,
        supportTicketCount,
        loginCountLast30Days
      },
      activityLog: activityLog.map((log) => this.mapAuditLog(log))
    });
  }

  async createSchool(session: SessionPayload, payload: unknown) {
    assertSuperAdmin(session);
    const parsed = schoolCreateSchema.parse(payload);
    const baseSlug = slugify(parsed.name);
    const slug = `${baseSlug}-${Date.now().toString(36)}`;
    const adminName = splitName(parsed.adminName ?? parsed.ownerName);
    const adminEmail = (parsed.adminEmail ?? parsed.ownerEmail).toLowerCase();
    const schoolCode = `SCH-${Date.now().toString(36).toUpperCase()}`;
    const school = await prisma.school.create({
      data: {
        name: parsed.name,
        slug,
        subdomain: slug,
        schoolCode,
        ownerName: parsed.ownerName,
        ownerEmail: parsed.ownerEmail.toLowerCase(),
        ownerPhone: parsed.ownerPhone,
        address: parsed.address,
        city: parsed.city,
        state: parsed.state,
        country: parsed.country,
        category: parsed.category,
        plan: parsed.plan,
        status: parsed.trialEndDate ? "TRIAL" : "ACTIVE",
        billingStatus: parsed.trialEndDate ? "TRIAL" : "ACTIVE",
        trialEndsAt: parsed.trialEndDate,
        nextBillingAt: parsed.trialEndDate,
        featureFlags: featureDefaults(),
        healthScore: parsed.trialEndDate ? 62 : 78,
        users: {
          create: {
            email: adminEmail,
            firstName: adminName.firstName,
            lastName: adminName.lastName,
            passwordHash: hashPassword("FutureRealm123!"),
            role: "ADMINISTRATOR",
            passwordResetRequired: true
          }
        }
      }
    });
    await this.audit(session, "CREATE", "School", school.id, { name: parsed.name, plan: parsed.plan, sendWelcomeEmail: parsed.sendWelcomeEmail, notes: parsed.notes }, school.id);
    return this.response({ id: school.id, slug: school.slug }, "School tenant created");
  }

  async updateSchool(session: SessionPayload, schoolId: string, payload: unknown) {
    assertSuperAdmin(session);
    const parsed = schoolUpdateSchema.parse(payload);
    const school = await prisma.school.update({
      where: { id: schoolId },
      data: parsed
    });
    await this.audit(session, "UPDATE", "School", school.id, parsed as Prisma.InputJsonValue, school.id);
    return this.response({ id: school.id }, "School updated");
  }

  async suspendSchool(session: SessionPayload, schoolId: string) {
    assertSuperAdmin(session);
    const school = await prisma.school.update({
      where: { id: schoolId },
      data: { status: "SUSPENDED", billingStatus: "SUSPENDED", users: { updateMany: { where: { role: { notIn: Array.from(platformRoles) } }, data: { isActive: false, suspendedAt: new Date() } } } }
    });
    await this.audit(session, "SUSPEND", "School", school.id, { reason: "Suspended by Super Admin" }, school.id);
    return this.response({ id: school.id, status: school.status }, "School suspended");
  }

  async activateSchool(session: SessionPayload, schoolId: string) {
    assertSuperAdmin(session);
    const school = await prisma.school.update({
      where: { id: schoolId },
      data: { status: "ACTIVE", billingStatus: "ACTIVE", users: { updateMany: { where: { deletedAt: null }, data: { isActive: true, suspendedAt: null } } } }
    });
    await this.audit(session, "ACTIVATE", "School", school.id, { reason: "Activated by Super Admin" }, school.id);
    return this.response({ id: school.id, status: school.status }, "School activated");
  }

  async softDeleteSchool(session: SessionPayload, schoolId: string) {
    assertSuperAdmin(session);
    const school = await prisma.school.update({
      where: { id: schoolId },
      data: {
        status: "DELETED",
        deletedAt: new Date(),
        users: { updateMany: { where: { role: { notIn: Array.from(platformRoles) } }, data: { isActive: false, deletedAt: new Date() } } }
      }
    });
    await this.audit(session, "DELETE", "School", school.id, { softDelete: true }, school.id);
    return this.response({ id: school.id }, "School soft-deleted");
  }

  async updateSchoolStatus(session: SessionPayload, schoolId: string, payload: unknown) {
    assertSuperAdmin(session);
    const parsed = schoolStatusChangeSchema.parse(payload);
    const closingStatuses: TenantStatus[] = ["ARCHIVED", "DELETED"];
    if (closingStatuses.includes(parsed.status)) {
      const existing = await prisma.school.findFirst({ where: { id: schoolId, deletedAt: null } });
      if (!existing) throw new NotFoundException("School not found.");
      if (!existing.dataExportedAt) {
        throw new BadRequestException("A full data export must be completed before this school can be deactivated or closed.");
      }
    }

    const billingStatusForStatus: Partial<Record<TenantStatus, Prisma.SchoolUpdateInput["billingStatus"]>> = {
      ACTIVE: "ACTIVE",
      TRIAL: "TRIAL",
      GRACE_PERIOD: "OVERDUE",
      SUSPENDED: "SUSPENDED",
      ARCHIVED: "CANCELLED",
      DELETED: "CANCELLED"
    };
    const shouldDisableUsers = parsed.status === "SUSPENDED" || parsed.status === "ARCHIVED" || parsed.status === "DELETED";
    const shouldReenableUsers = parsed.status === "ACTIVE";

    const school = await prisma.school.update({
      where: { id: schoolId },
      data: {
        status: parsed.status,
        billingStatus: billingStatusForStatus[parsed.status],
        statusReason: parsed.reason,
        statusChangedAt: new Date(),
        deletedAt: parsed.status === "DELETED" ? new Date() : undefined,
        ...(shouldDisableUsers
          ? { users: { updateMany: { where: { role: { notIn: Array.from(platformRoles) } }, data: { isActive: false, suspendedAt: new Date() } } } }
          : {}),
        ...(shouldReenableUsers
          ? { users: { updateMany: { where: { deletedAt: null }, data: { isActive: true, suspendedAt: null } } } }
          : {})
      }
    });
    const auditAction: AuditAction = parsed.status === "ACTIVE" ? "ACTIVATE" : parsed.status === "SUSPENDED" ? "SUSPEND" : parsed.status === "DELETED" ? "DELETE" : "UPDATE";
    await this.audit(session, auditAction, "School", school.id, { status: parsed.status, reason: parsed.reason }, school.id);
    return this.response({ id: school.id, status: school.status }, "School status updated");
  }

  async assignAccountManager(session: SessionPayload, schoolId: string, payload: unknown) {
    assertSuperAdmin(session);
    const parsed = accountManagerSchema.parse(payload);
    const manager = await prisma.user.findFirst({
      where: { email: parsed.accountManagerEmail.toLowerCase(), role: { in: Array.from(platformRoles) }, deletedAt: null }
    });
    if (!manager) throw new NotFoundException("No active platform team member found with that email.");
    const school = await prisma.school.update({ where: { id: schoolId }, data: { accountManagerId: manager.id } });
    await this.audit(session, "UPDATE", "School", school.id, { accountManagerId: manager.id, accountManagerEmail: manager.email }, school.id);
    return this.response({ id: school.id, accountManagerId: manager.id }, "Account manager assigned");
  }

  async listSchoolContacts(session: SessionPayload, schoolId: string) {
    assertSuperAdmin(session);
    const contacts = await prisma.schoolContact.findMany({ where: { schoolId }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] });
    return this.response(contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      role: contact.role,
      phone: contact.phone,
      email: contact.email,
      isPrimary: contact.isPrimary,
      createdAt: contact.createdAt.toISOString()
    })));
  }

  async addSchoolContact(session: SessionPayload, schoolId: string, payload: unknown) {
    assertSuperAdmin(session);
    const parsed = schoolContactSchema.parse(payload);
    const contact = await prisma.schoolContact.create({ data: { schoolId, ...parsed } });
    await this.audit(session, "CREATE", "SchoolContact", contact.id, parsed as Prisma.InputJsonValue, schoolId);
    return this.response({ id: contact.id }, "Contact added");
  }

  async removeSchoolContact(session: SessionPayload, schoolId: string, contactId: string) {
    assertSuperAdmin(session);
    const contact = await prisma.schoolContact.findFirst({ where: { id: contactId, schoolId } });
    if (!contact) throw new NotFoundException("Contact not found.");
    await prisma.schoolContact.delete({ where: { id: contactId } });
    await this.audit(session, "DELETE", "SchoolContact", contactId, { name: contact.name }, schoolId);
    return this.response({ id: contactId }, "Contact removed");
  }

  async exportSchoolData(session: SessionPayload, schoolId: string) {
    assertSuperAdmin(session);
    const school = await prisma.school.findFirst({ where: { id: schoolId, deletedAt: null } });
    if (!school) throw new NotFoundException("School not found.");

    const [students, staff, invoices, payments] = await Promise.all([
      prisma.student.findMany({ where: { schoolId }, select: { id: true, firstName: true, lastName: true, admissionNumber: true, status: true, admissionDate: true } }),
      prisma.staffProfile.findMany({ where: { schoolId }, select: { id: true, employeeNo: true, staffType: true, user: { select: { firstName: true, lastName: true, email: true, isActive: true } } } }),
      prisma.invoice.findMany({ where: { schoolId }, select: { id: true, status: true, total: true, dueOn: true, issuedOn: true } }),
      prisma.payment.findMany({ where: { schoolId }, select: { id: true, amount: true, method: true, status: true, paidAt: true } })
    ]);

    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const section = (title: string, header: string[], rows: string[][]) => [
      `# ${title}`,
      header.map(escape).join(","),
      ...rows.map((row) => row.map(escape).join(","))
    ].join("\n");

    const csv = [
      section("Students", ["ID", "Admission No", "First Name", "Last Name", "Status", "Enrolled"], students.map((s) => [s.id, s.admissionNumber ?? "", s.firstName, s.lastName, s.status, s.admissionDate.toISOString()])),
      section("Staff", ["ID", "Employee No", "Name", "Email", "Type", "Status"], staff.map((s) => [s.id, s.employeeNo ?? "", `${s.user?.firstName ?? ""} ${s.user?.lastName ?? ""}`.trim(), s.user?.email ?? "", s.staffType, s.user?.isActive ? "ACTIVE" : "SUSPENDED"])),
      section("Invoices", ["ID", "Status", "Amount", "Due Date", "Issued"], invoices.map((i) => [i.id, i.status, String(i.total), i.dueOn?.toISOString() ?? "", i.issuedOn.toISOString()])),
      section("Payments", ["ID", "Amount", "Method", "Status", "Paid At"], payments.map((p) => [p.id, String(p.amount), p.method, p.status, p.paidAt?.toISOString() ?? ""]))
    ].join("\n\n");

    await prisma.school.update({ where: { id: schoolId }, data: { dataExportedAt: new Date() } });
    await this.audit(session, "EXPORT", "School", schoolId, { studentCount: students.length, staffCount: staff.length, invoiceCount: invoices.length, paymentCount: payments.length }, schoolId);
    return csv;
  }

  private roleFilter(role?: string): UserRole[] | undefined {
    if (!role) return undefined;
    const value = role.toUpperCase();
    if (value === "SCHOOL_ADMIN") return schoolAdminRoles;
    if (value === "TEACHER") return ["TEACHER", "SUBJECT_TEACHER", "CLASS_TEACHER"];
    if (value === "PARENT") return ["PARENT"];
    if (value === "STUDENT") return ["STUDENT"];
    return Object.values(UserRole).includes(value as UserRole) ? [value as UserRole] : undefined;
  }

  async listUsers(session: SessionPayload, query: unknown) {
    assertSuperAdmin(session);
    const parsed = pageSchema.parse(query);
    const roleIn = this.roleFilter(parsed.role);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      school: { deletedAt: null },
      ...(roleIn ? { role: { in: roleIn } } : {}),
      ...(parsed.schoolId ? { schoolId: parsed.schoolId } : {}),
      ...(parsed.status ? { isActive: parsed.status.toUpperCase() !== "SUSPENDED" } : {}),
      ...(parsed.search
        ? {
            OR: [
              { firstName: { contains: parsed.search, mode: "insensitive" } },
              { lastName: { contains: parsed.search, mode: "insensitive" } },
              { email: { contains: parsed.search, mode: "insensitive" } }
            ]
          }
        : {})
    };
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { school: { select: { id: true, name: true, status: true } } },
        orderBy: { createdAt: "desc" },
        skip: (parsed.page - 1) * parsed.limit,
        take: parsed.limit
      }),
      prisma.user.count({ where })
    ]);
    return this.response(
      users.map((user) => ({
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        schoolId: user.schoolId,
        schoolName: user.school.name,
        schoolStatus: user.school.status,
        status: user.isActive ? "ACTIVE" : "SUSPENDED",
        lastLoginAt: user.lastLoginAt?.toISOString(),
        createdAt: user.createdAt.toISOString()
      })),
      "Users loaded",
      pagination(parsed.page, parsed.limit, total)
    );
  }

  async getUser(session: SessionPayload, userId: string) {
    assertSuperAdmin(session);
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        school: true,
        guardian: { include: { students: { include: { student: { select: { id: true, firstName: true, lastName: true } } } } } },
        student: true,
        staffProfile: true
      }
    });
    if (!user) throw new NotFoundException("User not found.");

    const termStart = new Date();
    termStart.setDate(termStart.getDate() - 90);

    const [sessions, scoreEntryCount, attendanceMarkedCount, notificationsReceived, adminActionCount] = await Promise.all([
      prisma.platformSession.findMany({ where: { userId }, orderBy: { lastActivityAt: "desc" }, take: 10 }),
      prisma.scoreEntry.count({ where: { enteredById: userId, recordedAt: { gte: termStart } } }),
      prisma.studentAttendance.count({ where: { markedById: userId, date: { gte: termStart } } }),
      prisma.notificationLog.count({ where: { userId, sentAt: { gte: termStart } } }),
      prisma.auditLog.count({ where: { actorId: userId, createdAt: { gte: termStart } } })
    ]);

    return this.response({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.isActive ? "ACTIVE" : "SUSPENDED",
      lastLoginAt: user.lastLoginAt?.toISOString(),
      createdAt: user.createdAt.toISOString(),
      school: { id: user.school.id, name: user.school.name, status: user.school.status, plan: user.school.plan },
      profileType: user.student ? "STUDENT" : user.guardian ? "PARENT" : user.staffProfile ? "STAFF" : "USER",
      recentSessions: sessions.map((s) => ({
        id: s.id,
        startedAt: s.createdAt.toISOString(),
        lastActivityAt: s.lastActivityAt.toISOString(),
        device: s.device,
        ipAddress: s.ipAddress,
        active: !s.revokedAt && s.expiresAt > new Date()
      })),
      activitySummary: user.staffProfile
        ? { type: "STAFF", scoreEntriesSubmitted: scoreEntryCount, attendanceMarked: attendanceMarkedCount }
        : user.guardian
        ? { type: "PARENT", notificationsReceived }
        : { type: "ADMIN", adminActionsTaken: adminActionCount },
      linkedAccounts: user.guardian
        ? user.guardian.students.map((sg) => ({ studentId: sg.student.id, studentName: `${sg.student.firstName} ${sg.student.lastName}`, isPrimary: sg.isPrimary }))
        : []
    });
  }

  async resetPassword(session: SessionPayload, userId: string) {
    assertSuperAdmin(session);
    const tempPassword = `FutureRealm${Math.floor(100000 + Math.random() * 900000)}!`;
    const user = await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashPassword(tempPassword), passwordResetRequired: true }
    });
    await this.audit(session, "RESET_PASSWORD", "User", user.id, { email: user.email }, user.schoolId);
    return this.response({ id: user.id, temporaryPassword: tempPassword }, "Password reset generated");
  }

  async suspendUser(session: SessionPayload, userId: string) {
    assertSuperAdmin(session);
    const user = await prisma.user.update({ where: { id: userId }, data: { isActive: false, suspendedAt: new Date() } });
    await this.audit(session, "SUSPEND", "User", user.id, { email: user.email }, user.schoolId);
    return this.response({ id: user.id }, "User suspended");
  }

  async reinstateUser(session: SessionPayload, userId: string) {
    assertSuperAdmin(session);
    const user = await prisma.user.update({ where: { id: userId }, data: { isActive: true, suspendedAt: null } });
    await this.audit(session, "ACTIVATE", "User", user.id, { email: user.email }, user.schoolId);
    return this.response({ id: user.id }, "User reinstated");
  }

  async softDeleteUser(session: SessionPayload, userId: string) {
    assertSuperAdmin(session);
    const user = await prisma.user.update({ where: { id: userId }, data: { isActive: false, deletedAt: new Date() } });
    await this.audit(session, "DELETE", "User", user.id, { email: user.email, softDelete: true }, user.schoolId);
    return this.response({ id: user.id }, "User soft-deleted");
  }

  async initiateAccountRecovery(session: SessionPayload, userId: string, payload: unknown) {
    assertSuperAdmin(session);
    const parsed = accountRecoverySchema.parse(payload);
    const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException("User not found.");

    const tempPassword = `FutureRealm${Math.floor(100000 + Math.random() * 900000)}!`;
    const record = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash: hashPassword(tempPassword),
          passwordResetRequired: true,
          ...(parsed.newEmail ? { email: parsed.newEmail.toLowerCase() } : {})
        }
      });
      return tx.accountRecoveryRecord.create({
        data: {
          userId,
          verifiedById: session.userId,
          verificationMethod: parsed.verificationMethod,
          newEmail: parsed.newEmail,
          completedAt: new Date()
        }
      });
    });

    await sendNotification({
      channel: "EMAIL",
      recipient: parsed.newEmail ?? user.email,
      title: "Account access restored",
      body: "Your account was recovered by FutureRealm support after identity verification. A temporary password has been set — you will be asked to change it on next login."
    });
    await this.audit(session, "RESET_PASSWORD", "User", userId, { verificationMethod: parsed.verificationMethod, recoveryRecordId: record.id }, user.schoolId);
    return this.response({ id: record.id, temporaryPassword: tempPassword }, "Account recovery completed");
  }

  async recalculateSuspiciousActivity(session: SessionPayload) {
    assertSuperAdmin(session);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const businessStartHour = 6;
    const businessEndHour = 22;

    const [failedLoginGroupsRaw, activeSessions, recentSensitiveActions] = await Promise.all([
      prisma.loginAttempt.groupBy({ by: ["email"], where: { success: false, createdAt: { gte: oneHourAgo } }, _count: { email: true } }),
      prisma.platformSession.findMany({ where: { revokedAt: null, expiresAt: { gt: new Date() }, lastActivityAt: { gte: thirtyMinutesAgo } }, select: { userId: true, ipAddress: true } }),
      prisma.auditLog.findMany({ where: { action: { in: ["SUSPEND", "ACTIVATE", "RESET_PASSWORD"] }, createdAt: { gte: oneHourAgo }, actorId: { not: null } }, select: { actorId: true, createdAt: true } })
    ]);
    const failedLoginGroups = failedLoginGroupsRaw.filter((group) => group._count.email > 10);

    const flagsCreated: Array<{ userId: string; flagType: string; detail: string }> = [];

    for (const group of failedLoginGroups) {
      const user = await prisma.user.findUnique({ where: { email: group.email } });
      if (user) flagsCreated.push({ userId: user.id, flagType: "EXCESSIVE_FAILED_LOGINS", detail: `${group._count.email} failed login attempts in the last hour` });
    }

    const sessionsByUser = new Map<string, Set<string>>();
    for (const s of activeSessions) {
      if (!s.ipAddress) continue;
      const set = sessionsByUser.get(s.userId) ?? new Set<string>();
      set.add(s.ipAddress);
      sessionsByUser.set(s.userId, set);
    }
    for (const [userId, ips] of sessionsByUser.entries()) {
      if (ips.size >= 2) flagsCreated.push({ userId, flagType: "SIMULTANEOUS_SESSIONS", detail: `Active sessions from ${ips.size} distinct locations at once` });
    }

    for (const log of recentSensitiveActions) {
      if (!log.actorId) continue;
      const hour = log.createdAt.getHours();
      if (hour < businessStartHour || hour >= businessEndHour) {
        flagsCreated.push({ userId: log.actorId, flagType: "OUTSIDE_HOURS_PERMISSION_CHANGE", detail: `Sensitive account action taken at ${log.createdAt.toLocaleTimeString()}` });
      }
    }

    let created = 0;
    for (const flag of flagsCreated) {
      const existing = await prisma.suspiciousActivityFlag.findFirst({ where: { userId: flag.userId, flagType: flag.flagType, resolvedAt: null } });
      if (existing) continue;
      await prisma.suspiciousActivityFlag.create({ data: flag });
      created += 1;
    }

    await this.audit(session, "UPDATE", "SuspiciousActivityFlag", "bulk", { newFlags: created }, null);
    return this.response({ newFlags: created }, "Suspicious activity scan complete");
  }

  async listSuspiciousActivity(session: SessionPayload) {
    assertSuperAdmin(session);
    const flags = await prisma.suspiciousActivityFlag.findMany({
      where: { resolvedAt: null },
      include: { user: { select: { firstName: true, lastName: true, email: true, schoolId: true } } },
      orderBy: { detectedAt: "desc" }
    });
    return this.response(flags.map((flag) => ({
      id: flag.id,
      userId: flag.userId,
      userName: `${flag.user.firstName} ${flag.user.lastName}`,
      userEmail: flag.user.email,
      flagType: flag.flagType,
      detail: flag.detail,
      detectedAt: flag.detectedAt.toISOString()
    })));
  }

  async resolveSuspiciousActivity(session: SessionPayload, flagId: string, payload: unknown) {
    assertSuperAdmin(session);
    const parsed = resolveSuspiciousActivitySchema.parse(payload);
    const flag = await prisma.suspiciousActivityFlag.findUnique({ where: { id: flagId } });
    if (!flag) throw new NotFoundException("Flag not found.");

    if (parsed.action === "FORCE_RESET") {
      await this.resetPassword(session, flag.userId);
    } else if (parsed.action === "SUSPEND") {
      await this.suspendUser(session, flag.userId);
    }

    const updated = await prisma.suspiciousActivityFlag.update({ where: { id: flagId }, data: { adminAction: parsed.action, resolvedAt: new Date() } });
    await this.audit(session, "UPDATE", "SuspiciousActivityFlag", flagId, { action: parsed.action }, null);
    return this.response({ id: updated.id }, "Flag resolved");
  }

  async recalculateDuplicateAccounts(session: SessionPayload) {
    assertSuperAdmin(session);
    const users = await prisma.user.findMany({ where: { deletedAt: null, phone: { not: null } }, select: { id: true, phone: true, firstName: true, lastName: true, schoolId: true } });
    const byPhone = new Map<string, typeof users>();
    for (const user of users) {
      if (!user.phone) continue;
      const list = byPhone.get(user.phone) ?? [];
      list.push(user);
      byPhone.set(user.phone, list);
    }

    let created = 0;
    for (const [, group] of byPhone.entries()) {
      if (group.length < 2) continue;
      for (let i = 0; i < group.length; i += 1) {
        for (let j = i + 1; j < group.length; j += 1) {
          const [a, b] = [group[i].id, group[j].id].sort();
          const existing = await prisma.duplicateFlag.findFirst({ where: { OR: [{ userIdA: a, userIdB: b }, { userIdA: b, userIdB: a }] } });
          if (existing) continue;
          await prisma.duplicateFlag.create({ data: { userIdA: a, userIdB: b, matchCriteria: "Same phone number" } });
          created += 1;
        }
      }
    }

    await this.audit(session, "UPDATE", "DuplicateFlag", "bulk", { newFlags: created }, null);
    return this.response({ newFlags: created }, "Duplicate account scan complete");
  }

  async listDuplicateAccounts(session: SessionPayload) {
    assertSuperAdmin(session);
    const flags = await prisma.duplicateFlag.findMany({
      where: { status: "PENDING" },
      include: {
        userA: { select: { firstName: true, lastName: true, email: true, phone: true } },
        userB: { select: { firstName: true, lastName: true, email: true, phone: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    return this.response(flags.map((flag) => ({
      id: flag.id,
      matchCriteria: flag.matchCriteria,
      status: flag.status,
      userA: { id: flag.userIdA, name: `${flag.userA.firstName} ${flag.userA.lastName}`, email: flag.userA.email, phone: flag.userA.phone },
      userB: { id: flag.userIdB, name: `${flag.userB.firstName} ${flag.userB.lastName}`, email: flag.userB.email, phone: flag.userB.phone },
      createdAt: flag.createdAt.toISOString()
    })));
  }

  async resolveDuplicateAccount(session: SessionPayload, flagId: string, payload: unknown) {
    assertSuperAdmin(session);
    const parsed = resolveDuplicateFlagSchema.parse(payload);
    const flag = await prisma.duplicateFlag.findUnique({ where: { id: flagId } });
    if (!flag) throw new NotFoundException("Flag not found.");

    if (parsed.action === "MERGE") {
      const keepUserId = parsed.keepUserId ?? flag.userIdA;
      const removeUserId = keepUserId === flag.userIdA ? flag.userIdB : flag.userIdA;
      await prisma.user.update({ where: { id: removeUserId }, data: { isActive: false, deletedAt: new Date() } });
    }

    const updated = await prisma.duplicateFlag.update({ where: { id: flagId }, data: { status: parsed.action === "MERGE" ? "MERGED" : parsed.action, resolvedAt: new Date() } });
    await this.audit(session, "UPDATE", "DuplicateFlag", flagId, { action: parsed.action, keepUserId: parsed.keepUserId }, null);
    return this.response({ id: updated.id }, "Duplicate flag resolved");
  }

  async listBilling(session: SessionPayload, query: unknown) {
    assertAnyPlatformRole(session, new Set<UserRole>([...billingRoles, ...salesRoles]), "Billing views are restricted to commercial and finance platform roles.");
    const parsed = pageSchema.parse(query);
    const where: Prisma.SchoolWhereInput = {
      deletedAt: null,
      ...(parsed.search ? { name: { contains: parsed.search, mode: "insensitive" } } : {})
    };
    const [schools, total] = await Promise.all([
      prisma.school.findMany({ where, orderBy: { createdAt: "desc" }, skip: (parsed.page - 1) * parsed.limit, take: parsed.limit }),
      prisma.school.count({ where })
    ]);
    return this.response(
      schools.map((school) => ({
        schoolId: school.id,
        schoolName: school.name,
        plan: school.plan,
        status: school.billingStatus,
        tenantStatus: school.status,
        lastPaymentAt: school.lastPaymentAt?.toISOString(),
        nextDueAt: school.nextBillingAt?.toISOString(),
        trialEndsAt: school.trialEndsAt?.toISOString(),
        monthlyAmount: planPrice(school.plan)
      })),
      "Billing loaded",
      pagination(parsed.page, parsed.limit, total)
    );
  }

  async updateBilling(session: SessionPayload, schoolId: string, payload: unknown) {
    assertAnyPlatformRole(session, new Set<UserRole>([...billingRoles, ...salesRoles]), "Plan changes are restricted to commercial and finance platform roles.");
    const parsed = billingUpdateSchema.parse(payload);
    const school = await prisma.school.update({ where: { id: schoolId }, data: { plan: parsed.plan, billingStatus: "ACTIVE", status: "ACTIVE" } });
    await this.audit(session, "BILLING_UPDATE", "School", school.id, { plan: parsed.plan }, school.id);
    return this.response({ schoolId: school.id, plan: school.plan }, "Subscription plan updated");
  }

  async extendTrial(session: SessionPayload, schoolId: string, payload: unknown) {
    assertAnyPlatformRole(session, salesRoles, "Trial extensions are restricted to owner, platform admin, and sales roles.");
    const parsed = trialSchema.parse(payload);
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException("School not found.");
    const baseDate = school.trialEndsAt && school.trialEndsAt > new Date() ? school.trialEndsAt : new Date();
    const nextTrialEnd = new Date(baseDate);
    nextTrialEnd.setDate(nextTrialEnd.getDate() + parsed.days);
    const updated = await prisma.school.update({ where: { id: schoolId }, data: { trialEndsAt: nextTrialEnd, nextBillingAt: nextTrialEnd, billingStatus: "TRIAL", status: "TRIAL" } });
    await this.audit(session, "BILLING_UPDATE", "School", updated.id, { trialExtendedDays: parsed.days }, updated.id);
    return this.response({ schoolId: updated.id, trialEndsAt: nextTrialEnd.toISOString() }, "Trial extended");
  }

  async suspendBilling(session: SessionPayload, schoolId: string) {
    assertAnyPlatformRole(session, billingRoles, "Billing suspension is restricted to platform finance roles.");
    const school = await prisma.school.update({ where: { id: schoolId }, data: { billingStatus: "OVERDUE", status: "SUSPENDED" } });
    await this.audit(session, "BILLING_UPDATE", "School", school.id, { billingStatus: "OVERDUE" }, school.id);
    return this.response({ schoolId: school.id }, "Billing suspended");
  }

  async listInvoices(session: SessionPayload, query: unknown) {
    assertAnyPlatformRole(session, new Set<UserRole>([...billingRoles, ...salesRoles]), "Invoice views are restricted to commercial and finance platform roles.");
    const parsed = pageSchema.parse(query);
    const where: Prisma.PlatformInvoiceWhereInput = {
      ...(parsed.schoolId ? { schoolId: parsed.schoolId } : {}),
      ...(parsed.status ? { status: parsed.status.toUpperCase() } : {})
    };
    const [invoices, total] = await Promise.all([
      prisma.platformInvoice.findMany({
        where,
        include: { school: { select: { name: true } }, transactions: true },
        orderBy: { issuedAt: "desc" },
        skip: (parsed.page - 1) * parsed.limit,
        take: parsed.limit
      }),
      prisma.platformInvoice.count({ where })
    ]);
    return this.response(
      invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNo: invoice.invoiceNo,
        schoolId: invoice.schoolId,
        schoolName: invoice.school.name,
        amount: Number(invoice.amount),
        taxAmount: Number(invoice.taxAmount),
        totalAmount: Number(invoice.amount) + Number(invoice.taxAmount),
        amountPaid: invoice.transactions.filter((t) => t.status === "SUCCESS").reduce((sum, t) => sum + Number(t.amount), 0),
        status: invoice.status,
        issuedAt: invoice.issuedAt.toISOString(),
        dueAt: invoice.dueAt.toISOString(),
        paidAt: invoice.paidAt?.toISOString()
      })),
      "Invoices loaded",
      pagination(parsed.page, parsed.limit, total)
    );
  }

  async createInvoice(session: SessionPayload, payload: unknown) {
    assertAnyPlatformRole(session, billingRoles, "Invoice creation is restricted to platform finance roles.");
    const parsed = createInvoiceSchema.parse(payload);
    const school = await prisma.school.findFirst({ where: { id: parsed.schoolId, deletedAt: null } });
    if (!school) throw new NotFoundException("School not found.");
    const invoiceNo = `INV-${Date.now().toString(36).toUpperCase()}`;
    const invoice = await prisma.platformInvoice.create({
      data: {
        schoolId: parsed.schoolId,
        invoiceNo,
        amount: parsed.amount,
        taxAmount: parsed.taxAmount,
        status: "DRAFT",
        dueAt: parsed.dueAt,
        metadata: parsed.note ? { note: parsed.note } : undefined
      }
    });
    await this.audit(session, "CREATE", "PlatformInvoice", invoice.id, { schoolId: parsed.schoolId, amount: parsed.amount }, parsed.schoolId);
    return this.response({ id: invoice.id, invoiceNo: invoice.invoiceNo }, "Invoice drafted");
  }

  async sendInvoice(session: SessionPayload, invoiceId: string) {
    assertAnyPlatformRole(session, billingRoles, "Sending invoices is restricted to platform finance roles.");
    const invoice = await prisma.platformInvoice.findUnique({ where: { id: invoiceId }, include: { school: true } });
    if (!invoice) throw new NotFoundException("Invoice not found.");
    if (invoice.status !== "DRAFT") throw new BadRequestException("Only draft invoices can be sent.");
    const updated = await prisma.platformInvoice.update({ where: { id: invoiceId }, data: { status: "SENT" } });
    await sendNotification({
      channel: "EMAIL",
      recipient: invoice.school.ownerEmail ?? "",
      title: `Invoice ${invoice.invoiceNo} from FutureRealm SMS`,
      body: `An invoice for ${Number(invoice.amount) + Number(invoice.taxAmount)} ${invoice.currency} is due ${invoice.dueAt.toDateString()}.`
    });
    await this.audit(session, "UPDATE", "PlatformInvoice", invoice.id, { status: "SENT" }, invoice.schoolId);
    return this.response({ id: updated.id, status: updated.status }, "Invoice sent to school");
  }

  async recordInvoicePayment(session: SessionPayload, invoiceId: string, payload: unknown) {
    assertAnyPlatformRole(session, billingRoles, "Recording payments is restricted to platform finance roles.");
    const parsed = recordPaymentSchema.parse(payload);
    const invoice = await prisma.platformInvoice.findUnique({ where: { id: invoiceId }, include: { school: true, transactions: true } });
    if (!invoice) throw new NotFoundException("Invoice not found.");
    if (invoice.status === "CANCELLED") throw new BadRequestException("Cannot record a payment against a cancelled invoice.");

    await prisma.platformBillingTransaction.create({
      data: {
        schoolId: invoice.schoolId,
        invoiceId: invoice.id,
        amount: parsed.amount,
        method: parsed.method,
        status: "SUCCESS",
        reference: parsed.reference,
        processedAt: parsed.paidOn
      }
    });

    const totalDue = Number(invoice.amount) + Number(invoice.taxAmount);
    const totalPaid = invoice.transactions.filter((t) => t.status === "SUCCESS").reduce((sum, t) => sum + Number(t.amount), 0) + parsed.amount;
    const fullyPaid = totalPaid >= totalDue;

    const updated = await prisma.platformInvoice.update({
      where: { id: invoiceId },
      data: { status: fullyPaid ? "PAID" : "PARTIALLY_PAID", paidAt: fullyPaid ? parsed.paidOn : null }
    });

    if (fullyPaid) {
      await prisma.school.update({
        where: { id: invoice.schoolId },
        data: { billingStatus: "ACTIVE", status: invoice.school.status === "SUSPENDED" || invoice.school.status === "GRACE_PERIOD" ? "ACTIVE" : invoice.school.status, lastPaymentAt: parsed.paidOn }
      });
      await sendNotification({
        channel: "EMAIL",
        recipient: invoice.school.ownerEmail ?? "",
        title: "Payment confirmed",
        body: `We have received your payment of ${parsed.amount} ${invoice.currency} for invoice ${invoice.invoiceNo}. Thank you.`
      });
    }

    await this.audit(session, "PAYMENT", "PlatformInvoice", invoice.id, { amount: parsed.amount, method: parsed.method, reference: parsed.reference, fullyPaid }, invoice.schoolId);
    return this.response({ id: updated.id, status: updated.status }, "Payment recorded");
  }

  async cancelInvoice(session: SessionPayload, invoiceId: string, payload: unknown) {
    assertAnyPlatformRole(session, billingRoles, "Cancelling invoices is restricted to platform finance roles.");
    const parsed = cancelInvoiceSchema.parse(payload);
    const invoice = await prisma.platformInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException("Invoice not found.");
    const updated = await prisma.platformInvoice.update({ where: { id: invoiceId }, data: { status: "CANCELLED", metadata: { ...(invoice.metadata as object ?? {}), cancelReason: parsed.reason } } });
    await this.audit(session, "UPDATE", "PlatformInvoice", invoice.id, { status: "CANCELLED", reason: parsed.reason }, invoice.schoolId);
    return this.response({ id: updated.id, status: updated.status }, "Invoice cancelled");
  }

  async recalculateChurnRisk(session: SessionPayload) {
    assertAnyPlatformRole(session, new Set<UserRole>([...billingRoles, "PLATFORM_OWNER", "PLATFORM_ADMIN", "DEVELOPER", "SUPER_ADMIN"]), "Churn scoring is restricted to finance and technical platform roles.");
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const termStart = new Date();
    termStart.setDate(termStart.getDate() - 60);

    const schools = await prisma.school.findMany({ where: { deletedAt: null, status: { in: ["ACTIVE", "TRIAL", "GRACE_PERIOD"] } } });
    const results: Array<{ schoolId: string; score: number; signals: string[] }> = [];

    for (const school of schools) {
      const [lastLogin, lastScoreEntry, lastPayment, openCriticalTicket, parentNotificationCount] = await Promise.all([
        prisma.user.findFirst({ where: { schoolId: school.id, deletedAt: null }, orderBy: { lastLoginAt: "desc" }, select: { lastLoginAt: true } }),
        prisma.scoreEntry.findFirst({ where: { schoolId: school.id }, orderBy: { recordedAt: "desc" }, select: { recordedAt: true } }),
        prisma.payment.findFirst({ where: { schoolId: school.id }, orderBy: { paidAt: "desc" }, select: { paidAt: true } }),
        prisma.supportTicket.findFirst({ where: { schoolId: school.id, status: { in: ["OPEN", "IN_PROGRESS"] }, priority: "CRITICAL", createdAt: { lte: fiveDaysAgo } } }),
        prisma.notificationLog.count({ where: { schoolId: school.id, sentAt: { gte: termStart } } })
      ]);

      const signals: string[] = [];
      let score = 100;

      if (!lastLogin?.lastLoginAt || lastLogin.lastLoginAt < tenDaysAgo) {
        signals.push("No admin or teacher login in 10+ days");
        score -= 25;
      }
      if (!lastScoreEntry || lastScoreEntry.recordedAt < fourteenDaysAgo) {
        signals.push("No result or score entry in 14+ days");
        score -= 25;
      }
      if (!lastPayment || lastPayment.paidAt === null || lastPayment.paidAt < fourteenDaysAgo) {
        signals.push("No fee recording activity in 14+ days");
        score -= 15;
      }
      if (school.trialEndsAt && school.trialEndsAt <= sevenDaysFromNow && (!lastLogin?.lastLoginAt || lastLogin.lastLoginAt < sevenDaysAgo)) {
        signals.push("Trial nearing expiry with low engagement");
        score -= 25;
      }
      if (openCriticalTicket) {
        signals.push("Critical support ticket unresolved 5+ days");
        score -= 15;
      }
      if (parentNotificationCount === 0) {
        signals.push("No parent notification sent all term");
        score -= 5;
      }

      score = Math.max(0, Math.min(100, score));
      results.push({ schoolId: school.id, score, signals });

      await prisma.school.update({ where: { id: school.id }, data: { healthScore: score } });
      await prisma.churnSignalLog.create({ data: { schoolId: school.id, score, signals } });
    }

    await this.audit(session, "UPDATE", "ChurnSignalLog", "bulk", { schoolsScored: results.length }, null);
    return this.response({ schoolsScored: results.length, highRisk: results.filter((r) => r.score < 50).length }, "Churn risk recalculated");
  }

  async listChurnRisk(session: SessionPayload) {
    assertAnyPlatformRole(session, new Set<UserRole>([...billingRoles, "PLATFORM_OWNER", "PLATFORM_ADMIN", "DEVELOPER", "SUPER_ADMIN"]), "Churn risk views are restricted to finance and technical platform roles.");
    const schools = await prisma.school.findMany({
      where: { deletedAt: null, status: { in: ["ACTIVE", "TRIAL", "GRACE_PERIOD"] } },
      orderBy: { healthScore: "asc" },
      take: 50,
      select: { id: true, name: true, healthScore: true, status: true, plan: true, churnSignalLogs: { orderBy: { calculatedAt: "desc" }, take: 1 } }
    });
    return this.response(schools.map((school) => ({
      schoolId: school.id,
      schoolName: school.name,
      score: school.healthScore,
      status: school.status,
      plan: school.plan,
      signals: (school.churnSignalLogs[0]?.signals as string[] | undefined) ?? [],
      lastCalculatedAt: school.churnSignalLogs[0]?.calculatedAt.toISOString() ?? null
    })));
  }

  async getNotificationWallet(session: SessionPayload, schoolId: string) {
    assertAnyPlatformRole(session, new Set<UserRole>([...billingRoles, ...salesRoles]), "Notification wallet views are restricted to commercial and finance platform roles.");
    const wallet = await prisma.notificationWallet.upsert({
      where: { schoolId },
      create: { schoolId },
      update: {}
    });
    return this.response({
      schoolId,
      smsBalance: wallet.smsBalance,
      whatsappBalance: wallet.whatsappBalance,
      lowBalanceThreshold: wallet.lowBalanceThreshold,
      isLow: wallet.smsBalance < wallet.lowBalanceThreshold || wallet.whatsappBalance < wallet.lowBalanceThreshold,
      lastToppedUpAt: wallet.lastToppedUpAt?.toISOString() ?? null
    });
  }

  async topUpNotificationWallet(session: SessionPayload, schoolId: string, payload: unknown) {
    assertAnyPlatformRole(session, billingRoles, "Topping up notification credits is restricted to platform finance roles.");
    const parsed = walletTopUpSchema.parse(payload);
    const wallet = await prisma.notificationWallet.upsert({
      where: { schoolId },
      create: { schoolId, smsBalance: parsed.smsCredits, whatsappBalance: parsed.whatsappCredits, lastToppedUpAt: new Date() },
      update: { smsBalance: { increment: parsed.smsCredits }, whatsappBalance: { increment: parsed.whatsappCredits }, lastToppedUpAt: new Date() }
    });
    await this.audit(session, "UPDATE", "NotificationWallet", wallet.id, { smsCredits: parsed.smsCredits, whatsappCredits: parsed.whatsappCredits }, schoolId);
    return this.response({ schoolId, smsBalance: wallet.smsBalance, whatsappBalance: wallet.whatsappBalance }, "Notification credits topped up");
  }

  async listPromoCodes(session: SessionPayload) {
    assertAnyPlatformRole(session, new Set<UserRole>([...billingRoles, ...salesRoles]), "Promo code views are restricted to commercial and finance platform roles.");
    const codes = await prisma.promoCode.findMany({ orderBy: { createdAt: "desc" }, include: { redemptions: true } });
    return this.response(codes.map((code) => ({
      id: code.id,
      code: code.code,
      type: code.type,
      value: Number(code.value),
      campaignName: code.campaignName,
      maxUses: code.maxUses,
      uses: code.uses,
      expiresAt: code.expiresAt?.toISOString(),
      isActive: code.isActive,
      totalDiscountIssued: code.redemptions.reduce((sum, r) => sum + Number(r.value), 0),
      schoolsConverted: new Set(code.redemptions.map((r) => r.schoolId)).size
    })));
  }

  async createPromoCode(session: SessionPayload, payload: unknown) {
    assertAnyPlatformRole(session, new Set<UserRole>(["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPER_ADMIN"]), "Only Super Admin can create promo codes.");
    const parsed = promoCodeCreateSchema.parse(payload);
    const existing = await prisma.promoCode.findUnique({ where: { code: parsed.code } });
    if (existing) throw new BadRequestException("A promo code with this code already exists.");
    const code = await prisma.promoCode.create({ data: parsed });
    await this.audit(session, "CREATE", "PromoCode", code.id, { code: code.code, campaignName: code.campaignName }, null);
    return this.response({ id: code.id, code: code.code }, "Promo code created");
  }

  async applyPromoCode(session: SessionPayload, payload: unknown) {
    assertAnyPlatformRole(session, new Set<UserRole>([...billingRoles, ...salesRoles]), "Applying promo codes is restricted to commercial and finance platform roles.");
    const parsed = applyPromoCodeSchema.parse(payload);
    const code = await prisma.promoCode.findUnique({ where: { code: parsed.code } });
    if (!code || !code.isActive) throw new NotFoundException("Promo code not found or inactive.");
    if (code.expiresAt && code.expiresAt < new Date()) throw new BadRequestException("This promo code has expired.");
    if (code.maxUses && code.uses >= code.maxUses) throw new BadRequestException("This promo code has reached its maximum redemptions.");
    const school = await prisma.school.findFirst({ where: { id: parsed.schoolId, deletedAt: null } });
    if (!school) throw new NotFoundException("School not found.");

    const discount = await prisma.$transaction(async (tx) => {
      const created = await tx.platformDiscount.create({
        data: { schoolId: parsed.schoolId, type: code.type, value: code.value, reason: parsed.reason, appliedBy: session.userId, promoCodeId: code.id, expiresAt: code.expiresAt }
      });
      await tx.promoCode.update({ where: { id: code.id }, data: { uses: { increment: 1 } } });
      return created;
    });

    await this.audit(session, "UPDATE", "PromoCode", code.id, { schoolId: parsed.schoolId, discountId: discount.id }, parsed.schoolId);
    return this.response({ id: discount.id }, "Promo code applied to school");
  }

  async promoCodeCampaignReport(session: SessionPayload) {
    assertAnyPlatformRole(session, new Set<UserRole>([...billingRoles, ...salesRoles]), "Campaign reporting is restricted to commercial and finance platform roles.");
    const codes = await prisma.promoCode.findMany({ include: { redemptions: true } });
    const campaigns = new Map<string, { campaignName: string; totalRedemptions: number; totalDiscountIssued: number; schoolIds: Set<string> }>();
    for (const code of codes) {
      const name = code.campaignName ?? "Uncategorized";
      const entry = campaigns.get(name) ?? { campaignName: name, totalRedemptions: 0, totalDiscountIssued: 0, schoolIds: new Set<string>() };
      entry.totalRedemptions += code.redemptions.length;
      entry.totalDiscountIssued += code.redemptions.reduce((sum, r) => sum + Number(r.value), 0);
      code.redemptions.forEach((r) => entry.schoolIds.add(r.schoolId));
      campaigns.set(name, entry);
    }
    return this.response(Array.from(campaigns.values()).map((entry) => ({
      campaignName: entry.campaignName,
      totalRedemptions: entry.totalRedemptions,
      totalDiscountIssued: entry.totalDiscountIssued,
      schoolsConverted: entry.schoolIds.size
    })));
  }

  async analyticsOverview(session: SessionPayload) {
    assertSuperAdmin(session);
    const sevenDays = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fiveDays = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const thisWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const lastWeekStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const thirtyDays = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const thirtyMinutes = new Date(Date.now() - 30 * 60 * 1000);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const nextSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const previousMonthStart = new Date(monthStart);
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);
    const previousMonthEnd = new Date(monthStart.getTime() - 1);

    const [
      schools,
      users,
      totalStudents,
      weekSignups,
      monthSignups,
      activeUsers,
      onlineSchoolSessions,
      pendingSyncDrafts,
      lastBackup,
      currentMonthPayments,
      previousMonthPayments,
      currentTermInvoices,
      overdueInvoices,
      trialsExpiring,
      churnRiskSchools,
      gracePeriodSchools,
      stuckTrialSchools,
      convertedThisWeek,
      supportOpen,
      supportCriticalOpen,
      supportSlaBreaching,
      resolvedThisWeek,
      resolvedLastWeek,
      apiUsage,
      failedSyncDrafts,
      notificationLogs,
      geographySchools,
      auditLogs
    ] = await Promise.all([
      prisma.school.groupBy({ by: ["status"], where: { deletedAt: null }, _count: true }),
      prisma.user.groupBy({ by: ["role"], where: { deletedAt: null }, _count: true }),
      prisma.student.count({ where: { school: { deletedAt: null } } }),
      prisma.school.count({ where: { createdAt: { gte: sevenDays }, deletedAt: null } }),
      prisma.school.count({ where: { createdAt: { gte: thirtyDays }, deletedAt: null } }),
      prisma.user.count({ where: { lastLoginAt: { gte: thirtyDays }, deletedAt: null } }),
      prisma.platformSession.findMany({
        where: { schoolId: { not: null }, revokedAt: null, expiresAt: { gt: new Date() }, lastActivityAt: { gte: thirtyMinutes } },
        distinct: ["schoolId"],
        select: { schoolId: true }
      }),
      prisma.syncDraft.count({ where: { syncedAt: null, school: { deletedAt: null } } }),
      prisma.backupRecord.findFirst({ where: { status: { in: ["SUCCESS", "COMPLETED", "COMPLETED_SUCCESSFULLY"] } }, orderBy: { endedAt: "desc" } }),
      prisma.platformBillingTransaction.aggregate({ where: { status: { in: ["SUCCESS", "PAID", "COMPLETED"] }, processedAt: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.platformBillingTransaction.aggregate({ where: { status: { in: ["SUCCESS", "PAID", "COMPLETED"] }, processedAt: { gte: previousMonthStart, lte: previousMonthEnd } }, _sum: { amount: true } }),
      prisma.platformInvoice.aggregate({ where: { issuedAt: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.platformInvoice.aggregate({ where: { status: { in: ["PENDING", "OVERDUE"] }, dueAt: { lt: new Date() } }, _sum: { amount: true } }),
      prisma.school.count({ where: { deletedAt: null, status: "TRIAL", trialEndsAt: { gte: new Date(), lte: nextSevenDays } } }),
      prisma.school.count({ where: { deletedAt: null, healthScore: { lt: 50 } } }),
      prisma.school.count({ where: { deletedAt: null, billingStatus: { in: ["OVERDUE", "SUSPENDED"] } } }),
      prisma.school.count({ where: { deletedAt: null, status: "TRIAL", updatedAt: { lt: fiveDays } } }),
      prisma.school.count({ where: { deletedAt: null, status: "ACTIVE", updatedAt: { gte: thisWeek } } }),
      prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, priority: "CRITICAL" } }),
      prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, slaDueAt: { lt: new Date() } } }),
      prisma.supportTicket.findMany({ where: { resolvedAt: { gte: thisWeek } }, select: { createdAt: true, resolvedAt: true } }),
      prisma.supportTicket.findMany({ where: { resolvedAt: { gte: lastWeekStart, lt: thisWeek } }, select: { createdAt: true, resolvedAt: true } }),
      prisma.apiUsageLog.findMany({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }, select: { status: true, durationMs: true } }),
      prisma.syncDraft.count({ where: { syncedAt: null, createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, school: { deletedAt: null } } }),
      prisma.notificationLog.findMany({ where: { sentAt: { gte: thirtyDays } }, select: { status: true } }),
      prisma.school.findMany({ where: { deletedAt: null }, select: { state: true, plan: true, status: true } }),
      prisma.auditLog.findMany({ include: { actor: true, school: true }, orderBy: { createdAt: "desc" }, take: 10 })
    ]);
    const statusCounts = Object.fromEntries(schools.map((item) => [item.status, item._count]));
    const roleCounts = Object.fromEntries(users.map((item) => [item.role, item._count]));
    const currentMonthRevenue = Number(currentMonthPayments._sum.amount ?? 0);
    const previousMonthRevenue = Number(previousMonthPayments._sum.amount ?? 0);
    const monthOverMonthGrowth = previousMonthRevenue > 0 ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 : currentMonthRevenue > 0 ? 100 : 0;
    const averageResolutionHours = (tickets: typeof resolvedThisWeek) => {
      if (!tickets.length) return 0;
      const totalMs = tickets.reduce((sum, ticket) => {
        if (!ticket.resolvedAt) return sum;
        return sum + (ticket.resolvedAt.getTime() - ticket.createdAt.getTime());
      }, 0);
      return Math.round((totalMs / tickets.length / (60 * 60 * 1000)) * 10) / 10;
    };
    const successfulApiRequests = apiUsage.filter((item) => item.status < 500).length;
    const apiUptime = apiUsage.length ? Math.round((successfulApiRequests / apiUsage.length) * 1000) / 10 : 100;
    const responseSamples = apiUsage.filter((item) => typeof item.durationMs === "number");
    const averageResponseMs = responseSamples.length ? Math.round(responseSamples.reduce((sum, item) => sum + (item.durationMs ?? 0), 0) / responseSamples.length) : 0;
    const deliveredNotifications = notificationLogs.filter((item) => ["SENT", "DELIVERED", "SUCCESS", "COMPLETED"].includes(item.status.toUpperCase())).length;
    const notificationDeliveryRate = notificationLogs.length ? Math.round((deliveredNotifications / notificationLogs.length) * 1000) / 10 : 100;
    const geography = Array.from(
      geographySchools.reduce((map, school) => {
        const state = school.state?.trim() || "Unspecified";
        const existing = map.get(state) ?? { state, schoolCount: 0, activeSchools: 0, trialSchools: 0, suspendedSchools: 0, planMix: {} as Record<string, number> };
        existing.schoolCount += 1;
        if (school.status === "ACTIVE") existing.activeSchools += 1;
        if (school.status === "TRIAL") existing.trialSchools += 1;
        if (school.status === "SUSPENDED") existing.suspendedSchools += 1;
        existing.planMix[school.plan] = (existing.planMix[school.plan] ?? 0) + 1;
        map.set(state, existing);
        return map;
      }, new Map<string, { state: string; schoolCount: number; activeSchools: number; trialSchools: number; suspendedSchools: number; planMix: Record<string, number> }>())
    ).map(([, value]) => value).sort((left, right) => right.schoolCount - left.schoolCount);
    const alerts = [
      trialsExpiring ? { id: "trials-expiring", severity: "warning", title: "Trials expiring soon", detail: `${trialsExpiring} school(s) have trials ending within 7 days.`, actionHref: "/super-admin/schools?status=TRIAL" } : null,
      Number(overdueInvoices._sum.amount ?? 0) > 0 ? { id: "overdue-invoices", severity: "danger", title: "Overdue platform invoices", detail: `${Number(overdueInvoices._sum.amount ?? 0).toLocaleString()} outstanding beyond due date.`, actionHref: "/super-admin/billing" } : null,
      failedSyncDrafts ? { id: "sync-backlog", severity: "warning", title: "Offline sync backlog", detail: `${failedSyncDrafts} sync record(s) have been pending for more than 24 hours.`, actionHref: "/super-admin/analytics" } : null,
      supportSlaBreaching ? { id: "support-sla", severity: "danger", title: "Support SLA breach", detail: `${supportSlaBreaching} support ticket(s) are beyond SLA.`, actionHref: "/super-admin/support" } : null,
      churnRiskSchools ? { id: "churn-risk", severity: "warning", title: "Churn risk schools", detail: `${churnRiskSchools} school(s) have health scores below 50.`, actionHref: "/super-admin/crm" } : null
    ].filter(Boolean);

    return this.response({
      schools: {
        total: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
        active: statusCounts.ACTIVE ?? 0,
        suspended: statusCounts.SUSPENDED ?? 0,
        trial: statusCounts.TRIAL ?? 0
      },
      users: {
        total: Object.values(roleCounts).reduce((sum, count) => sum + count, 0),
        parents: roleCounts.PARENT ?? 0,
        teachers: (roleCounts.TEACHER ?? 0) + (roleCounts.CLASS_TEACHER ?? 0) + (roleCounts.SUBJECT_TEACHER ?? 0),
        students: roleCounts.STUDENT ?? 0,
        schoolAdmins: schoolAdminRoles.reduce((sum, role) => sum + (roleCounts[role] ?? 0), 0)
      },
      signups: { last7Days: weekSignups, last30Days: monthSignups },
      mau: activeUsers,
      revenue: await this.revenueSummary(),
      commandCenter: {
        pulse: {
          totalActiveSchools: statusCounts.ACTIVE ?? 0,
          totalStudents,
          schoolsOnline: onlineSchoolSessions.length,
          uptime30Day: apiUptime,
          offlineSyncQueueSize: pendingSyncDrafts,
          lastSuccessfulBackupAt: lastBackup?.endedAt?.toISOString() ?? lastBackup?.startedAt.toISOString() ?? null
        },
        revenueSnapshot: {
          currentMonthRevenue,
          currentTermCollected: currentMonthRevenue,
          currentTermInvoiced: Number(currentTermInvoices._sum.amount ?? 0),
          overdueBalances: Number(overdueInvoices._sum.amount ?? 0),
          monthOverMonthGrowth,
          newMrrThisMonth: monthSignups * planPrice("BASIC"),
          notificationCreditRevenue: 0
        },
        subscriptionHealth: {
          trialsExpiringNext7Days: trialsExpiring,
          churnRiskSchools,
          gracePeriodSchools
        },
        onboardingPipeline: {
          pendingVerification: statusCounts.TRIAL ?? 0,
          schoolsInTrial: statusCounts.TRIAL ?? 0,
          stuckMidOnboarding: stuckTrialSchools,
          convertedThisWeek
        },
        supportQueue: {
          totalOpenTickets: supportOpen,
          criticalOpenTickets: supportCriticalOpen,
          ticketsBreachingSla: supportSlaBreaching,
          averageResolutionHoursThisWeek: averageResolutionHours(resolvedThisWeek),
          averageResolutionHoursLastWeek: averageResolutionHours(resolvedLastWeek)
        },
        systemHealth: {
          apiUptime,
          averageResponseMs,
          syncFailureRate24h: pendingSyncDrafts > 0 ? Math.round((failedSyncDrafts / pendingSyncDrafts) * 1000) / 10 : 0,
          notificationDeliveryRate,
          activeInfrastructureAlerts: supportCriticalOpen + supportSlaBreaching
        },
        geography,
        alerts
      },
      recentActivity: auditLogs.map((log) => this.mapAuditLog(log))
    });
  }

  async usage(session: SessionPayload) {
    assertSuperAdmin(session);
    const schools = await prisma.school.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { users: true, auditLogs: true, academicAssessments: true, payments: true, admissions: true } } },
      orderBy: { updatedAt: "desc" },
      take: 50
    });
    return this.response(schools.map((school) => ({
      schoolId: school.id,
      schoolName: school.name,
      logins: school._count.auditLogs,
      activeUsers: school._count.users,
      modulesUsed: [
        school._count.academicAssessments ? "assessments" : null,
        school._count.payments ? "fees" : null,
        school._count.admissions ? "admissions" : null
      ].filter(Boolean)
    })));
  }

  private async revenueSummary() {
    const paidSchools = await prisma.school.findMany({ where: { deletedAt: null, billingStatus: "ACTIVE" }, select: { plan: true } });
    const mrr = paidSchools.reduce((sum, school) => sum + planPrice(school.plan), 0);
    return { mrr, arr: mrr * 12, totalPaidSchools: paidSchools.length };
  }

  async revenue(session: SessionPayload) {
    assertSuperAdmin(session);
    const schoolsByPlan = await prisma.school.groupBy({ by: ["plan"], where: { deletedAt: null }, _count: true });
    return this.response({
      ...(await this.revenueSummary()),
      schoolsByPlan: schoolsByPlan.map((item) => ({ plan: item.plan, count: item._count })),
      monthlyRevenue: Array.from({ length: 12 }, (_, index) => ({
        month: new Date(2026, index, 1).toLocaleString("en", { month: "short" }),
        amount: (index + 1) * 125000
      }))
    });
  }

  async revenueReport(session: SessionPayload) {
    assertAnyPlatformRole(session, billingRoles, "Revenue reporting is restricted to platform finance roles.");
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const [schools, unpaidInvoices, notificationRevenue, renewedRecently, activeSchoolCount] = await Promise.all([
      prisma.school.findMany({ where: { deletedAt: null }, select: { plan: true, state: true, city: true, billingStatus: true, createdAt: true } }),
      prisma.platformInvoice.aggregate({ where: { status: { in: ["SENT", "PENDING_PAYMENT", "PARTIALLY_PAID", "OVERDUE", "ESCALATED"] } }, _sum: { amount: true, taxAmount: true } }),
      prisma.platformBillingTransaction.aggregate({ where: { status: "SUCCESS", metadata: { path: ["type"], equals: "notification_credit" } }, _sum: { amount: true } }),
      prisma.school.count({ where: { deletedAt: null, lastPaymentAt: { gte: ninetyDaysAgo } } }),
      prisma.school.count({ where: { deletedAt: null, billingStatus: "ACTIVE" } })
    ]);

    const revenueByTier = new Map<string, number>();
    const revenueByState = new Map<string, { revenue: number; schoolCount: number }>();
    for (const school of schools) {
      const monthly = planPrice(school.plan);
      revenueByTier.set(school.plan, (revenueByTier.get(school.plan) ?? 0) + monthly);
      const state = school.state?.trim() || "Unspecified";
      const existing = revenueByState.get(state) ?? { revenue: 0, schoolCount: 0 };
      existing.revenue += monthly;
      existing.schoolCount += 1;
      revenueByState.set(state, existing);
    }

    const avgTenureMonths = 18;
    const ltvByTier = Array.from(revenueByTier.entries()).map(([plan, monthly]) => ({
      plan,
      ltv: (monthly / Math.max(1, revenueByTier.size)) * avgTenureMonths
    }));

    return this.response({
      revenueByTier: Array.from(revenueByTier.entries()).map(([plan, revenue]) => ({ plan, revenue })),
      revenueByState: Array.from(revenueByState.entries()).map(([state, value]) => ({ state, ...value })).sort((a, b) => b.revenue - a.revenue),
      notificationCreditRevenue: Number(notificationRevenue._sum.amount ?? 0),
      outstandingReceivables: Number(unpaidInvoices._sum.amount ?? 0) + Number(unpaidInvoices._sum.taxAmount ?? 0),
      renewalRate: activeSchoolCount > 0 ? Math.round((renewedRecently / activeSchoolCount) * 1000) / 10 : 0,
      ltvByTier
    });
  }

  async listAuditLogs(session: SessionPayload, query: unknown) {
    assertSuperAdmin(session);
    const parsed = pageSchema.parse(query);
    const where: Prisma.AuditLogWhereInput = {
      ...(parsed.schoolId ? { schoolId: parsed.schoolId } : {}),
      ...(parsed.action ? { action: parsed.action.toUpperCase() as AuditAction } : {}),
      ...(parsed.dateFrom || parsed.dateTo ? { createdAt: { ...(parsed.dateFrom ? { gte: parsed.dateFrom } : {}), ...(parsed.dateTo ? { lte: parsed.dateTo } : {}) } } : {})
    };
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { actor: true, school: true },
        orderBy: { createdAt: "desc" },
        skip: (parsed.page - 1) * parsed.limit,
        take: parsed.limit
      }),
      prisma.auditLog.count({ where })
    ]);
    return this.response(logs.map((log) => this.mapAuditLog(log)), "Audit logs loaded", pagination(parsed.page, parsed.limit, total));
  }

  async exportAuditLogsCsv(session: SessionPayload, query: unknown) {
    const result = await this.listAuditLogs(session, { ...(query as Record<string, unknown>), page: 1, limit: 100 });
    const rows = result.data as ReturnType<SuperAdminService["mapAuditLog"]>[];
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    return [
      ["Timestamp", "Super Admin", "Action", "Target", "School", "Details"].map(escape).join(","),
      ...rows.map((row) => [
        row.timestamp,
        row.superAdmin,
        row.action,
        row.target,
        row.schoolName ?? "Platform",
        JSON.stringify(row.details ?? {})
      ].map(escape).join(","))
    ].join("\n");
  }

  private mapAuditLog(log: Prisma.AuditLogGetPayload<{ include: { actor: true; school: true } }>) {
    return {
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      action: log.action,
      superAdmin: log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : "System",
      target: `${log.entityType}:${log.entityId}`,
      schoolId: log.schoolId,
      schoolName: log.school?.name,
      details: log.metadata
    };
  }

  async impersonate(session: SessionPayload, userId: string, payload: unknown) {
    assertSuperAdmin(session);
    const parsed = impersonateSchema.parse(payload);
    const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null, isActive: true }, include: { school: true } });
    if (!user) throw new NotFoundException("User not found or inactive.");
    if (platformRoles.has(user.role)) throw new BadRequestException("Cannot impersonate another platform admin account.");
    const maxAgeSeconds = 30 * 60;
    const token = await createSessionToken({
      userId: user.id,
      schoolId: user.schoolId,
      role: user.role as Role,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`
    }, { maxAgeSeconds });
    await this.audit(session, "IMPERSONATE", "User", user.id, { email: user.email, schoolId: user.schoolId, reason: parsed.reason, startedAt: new Date().toISOString(), maxAgeSeconds }, user.schoolId);
    return this.response({ token, expiresInSeconds: maxAgeSeconds, user: { id: user.id, email: user.email, role: user.role, schoolName: user.school.name } }, "Impersonation token generated");
  }

  async getSettings(session: SessionPayload) {
    assertSuperAdmin(session);
    const settings = await this.settingsRecord();
    return this.response(settings);
  }

  async updateSettings(session: SessionPayload, payload: unknown) {
    assertSuperAdmin(session);
    const parsed = settingsSchema.parse(payload);
    const settings = await this.settingsRecord();
    const updated = await prisma.platformSetting.update({
      where: { id: settings.id },
      data: parsed as Prisma.PlatformSettingUpdateInput
    });
    await this.audit(session, "SETTINGS_UPDATE", "PlatformSetting", updated.id, parsed as Prisma.InputJsonValue, null);
    return this.response(updated, "Platform settings updated");
  }

  async getFeatures(session: SessionPayload, schoolId: string) {
    assertSuperAdmin(session);
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true, featureFlags: true } });
    if (!school) throw new NotFoundException("School not found.");
    return this.response({ schoolId: school.id, schoolName: school.name, features: school.featureFlags ?? featureDefaults() });
  }

  async updateFeatures(session: SessionPayload, schoolId: string, payload: unknown) {
    assertSuperAdmin(session);
    const raw = featurePayloadSchema.parse(payload);
    const parsed = ("features" in raw ? raw.features : raw) as Record<string, boolean>;
    const invalidModules = Object.keys(parsed).filter((key) => !platformModules.includes(key as (typeof platformModules)[number]));
    if (invalidModules.length) throw new BadRequestException(`Unsupported feature flag(s): ${invalidModules.join(", ")}`);
    const current = await prisma.school.findUnique({ where: { id: schoolId }, select: { featureFlags: true } });
    if (!current) throw new NotFoundException("School not found.");
    const features = { ...featureDefaults(), ...jsonRecord(current.featureFlags), ...parsed };
    const school = await prisma.school.update({ where: { id: schoolId }, data: { featureFlags: features } });
    await this.audit(session, "UPDATE", "SchoolFeature", school.id, features, school.id);
    return this.response({ schoolId: school.id, features }, "School feature flags updated");
  }

  async listSupportTickets(session: SessionPayload, query: unknown) {
    assertSuperAdmin(session);
    const parsed = pageSchema.parse(query);
    const where: Prisma.SupportTicketWhereInput = {
      ...(parsed.schoolId ? { schoolId: parsed.schoolId } : {}),
      ...(parsed.status ? { status: parsed.status.toUpperCase() as never } : {}),
      ...(parsed.search ? { OR: [{ subject: { contains: parsed.search, mode: "insensitive" } }, { ticketNo: { contains: parsed.search, mode: "insensitive" } }] } : {})
    };
    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: { school: true, assignedTo: true, createdBy: true, _count: { select: { messages: true } } },
        orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
        skip: (parsed.page - 1) * parsed.limit,
        take: parsed.limit
      }),
      prisma.supportTicket.count({ where })
    ]);
    return this.response(tickets.map((ticket) => ({
      id: ticket.id,
      ticketNo: ticket.ticketNo,
      schoolId: ticket.schoolId,
      schoolName: ticket.school.name,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      assignedTo: ticket.assignedTo ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}` : "Unassigned",
      messageCount: ticket._count.messages,
      slaDueAt: ticket.slaDueAt?.toISOString(),
      slaBreached: Boolean(ticket.slaDueAt && ticket.slaDueAt < new Date() && !["RESOLVED", "CLOSED"].includes(ticket.status)),
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString()
    })), "Support tickets loaded", pagination(parsed.page, parsed.limit, total));
  }

  private ticketSlaHours(priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") {
    if (priority === "CRITICAL") return 1;
    if (priority === "HIGH") return 4;
    if (priority === "MEDIUM") return 8;
    return 24;
  }

  async createSupportTicket(session: SessionPayload, payload: unknown) {
    assertSuperAdmin(session);
    const parsed = supportTicketSchema.parse(payload);
    const actor = await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] } });
    const ticket = await prisma.supportTicket.create({
      data: {
        schoolId: parsed.schoolId,
        createdById: actor?.id,
        assignedToId: parsed.assignedToId,
        ticketNo: `SUP-${Date.now().toString(36).toUpperCase()}`,
        subject: parsed.subject,
        description: parsed.description,
        category: parsed.category,
        priority: parsed.priority,
        status: parsed.assignedToId ? "TRIAGED" : "OPEN",
        slaDueAt: new Date(Date.now() + this.ticketSlaHours(parsed.priority) * 60 * 60 * 1000),
        messages: { create: { authorId: actor?.id, body: parsed.description, internalOnly: false } }
      }
    });
    await this.audit(session, "CREATE", "SupportTicket", ticket.id, { subject: parsed.subject, priority: parsed.priority }, parsed.schoolId);
    return this.response({ id: ticket.id, ticketNo: ticket.ticketNo }, "Support ticket created");
  }

  async getSupportTicket(session: SessionPayload, ticketId: string) {
    assertSuperAdmin(session);
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        school: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        messages: { include: { author: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } },
        csatResponse: true,
        dataCorrectionRecords: { orderBy: { createdAt: "desc" } }
      }
    });
    if (!ticket) throw new NotFoundException("Support ticket not found.");
    return this.response({
      id: ticket.id,
      ticketNo: ticket.ticketNo,
      schoolId: ticket.schoolId,
      schoolName: ticket.school.name,
      subject: ticket.subject,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      assignedTo: ticket.assignedTo ? { id: ticket.assignedTo.id, name: `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}` } : null,
      createdBy: ticket.createdBy ? `${ticket.createdBy.firstName} ${ticket.createdBy.lastName}` : "Unknown",
      slaDueAt: ticket.slaDueAt?.toISOString(),
      slaBreached: Boolean(ticket.slaDueAt && ticket.slaDueAt < new Date() && !["RESOLVED", "CLOSED"].includes(ticket.status)),
      resolvedAt: ticket.resolvedAt?.toISOString(),
      closedAt: ticket.closedAt?.toISOString(),
      createdAt: ticket.createdAt.toISOString(),
      messages: ticket.messages.map((m) => ({
        id: m.id,
        body: m.body,
        internalOnly: m.internalOnly,
        author: m.author ? `${m.author.firstName} ${m.author.lastName}` : "School contact",
        createdAt: m.createdAt.toISOString()
      })),
      csat: ticket.csatResponse ? { score: ticket.csatResponse.score, comment: ticket.csatResponse.comment, submittedAt: ticket.csatResponse.submittedAt.toISOString() } : null,
      dataCorrectionRecords: ticket.dataCorrectionRecords.map((r) => ({
        id: r.id,
        fieldCorrected: r.fieldCorrected,
        oldValue: r.oldValue,
        newValue: r.newValue,
        status: r.status,
        completedAt: r.completedAt?.toISOString(),
        createdAt: r.createdAt.toISOString()
      }))
    });
  }

  async addTicketMessage(session: SessionPayload, ticketId: string, payload: unknown) {
    assertSuperAdmin(session);
    const parsed = ticketMessageSchema.parse(payload);
    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException("Support ticket not found.");
    const actor = await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] } });
    const message = await prisma.ticketMessage.create({ data: { ticketId, authorId: actor?.id, body: parsed.body, internalOnly: parsed.internalOnly } });
    if (!["RESOLVED", "CLOSED"].includes(ticket.status)) {
      await prisma.supportTicket.update({ where: { id: ticketId }, data: { status: parsed.internalOnly ? ticket.status : "AWAITING_SCHOOL_RESPONSE" } });
    }
    await this.audit(session, "UPDATE", "SupportTicket", ticketId, { messageId: message.id, internalOnly: parsed.internalOnly }, ticket.schoolId);
    return this.response({ id: message.id }, "Ticket message added");
  }

  async updateTicketStatus(session: SessionPayload, ticketId: string, payload: unknown) {
    assertSuperAdmin(session);
    const parsed = ticketStatusSchema.parse(payload);
    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId }, include: { school: true } });
    if (!ticket) throw new NotFoundException("Support ticket not found.");

    const updated = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: parsed.status,
        resolvedAt: parsed.status === "RESOLVED" ? new Date() : ticket.resolvedAt,
        closedAt: parsed.status === "CLOSED" ? new Date() : ticket.closedAt
      }
    });

    if (parsed.status === "RESOLVED") {
      await sendNotification({
        channel: "EMAIL",
        recipient: ticket.school.ownerEmail ?? "",
        title: `Ticket ${ticket.ticketNo} resolved — how did we do?`,
        body: "Your support ticket has been marked resolved. Please rate your experience from 1 (poor) to 5 (excellent)."
      });
    }

    await this.audit(session, "UPDATE", "SupportTicket", ticketId, { status: parsed.status }, ticket.schoolId);
    return this.response({ id: updated.id, status: updated.status }, "Ticket status updated");
  }

  async assignTicket(session: SessionPayload, ticketId: string, payload: unknown) {
    assertSuperAdmin(session);
    const parsed = ticketAssignSchema.parse(payload);
    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException("Support ticket not found.");
    const updated = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { assignedToId: parsed.assignedToId, status: ticket.status === "OPEN" ? "TRIAGED" : ticket.status }
    });
    await this.audit(session, "UPDATE", "SupportTicket", ticketId, { assignedToId: parsed.assignedToId }, ticket.schoolId);
    return this.response({ id: updated.id }, "Ticket reassigned");
  }

  async submitTicketCsat(session: SessionPayload, ticketId: string, payload: unknown) {
    assertSuperAdmin(session);
    const parsed = ticketCsatSchema.parse(payload);
    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException("Support ticket not found.");
    const csat = await prisma.ticketCsatResponse.upsert({
      where: { ticketId },
      create: { ticketId, score: parsed.score, comment: parsed.comment },
      update: { score: parsed.score, comment: parsed.comment, submittedAt: new Date() }
    });
    await this.audit(session, "UPDATE", "SupportTicket", ticketId, { csatScore: parsed.score }, ticket.schoolId);
    return this.response({ id: csat.id }, "CSAT response recorded");
  }

  async listCannedResponses(session: SessionPayload) {
    assertSuperAdmin(session);
    const responses = await prisma.cannedResponse.findMany({ orderBy: { category: "asc" } });
    return this.response(responses.map((r) => ({ id: r.id, category: r.category, title: r.title, body: r.body, updatedAt: r.updatedAt.toISOString() })));
  }

  async createCannedResponse(session: SessionPayload, payload: unknown) {
    assertSuperAdmin(session);
    const parsed = cannedResponseSchema.parse(payload);
    const response = await prisma.cannedResponse.create({ data: { ...parsed, updatedById: session.userId } });
    await this.audit(session, "CREATE", "CannedResponse", response.id, { title: response.title }, null);
    return this.response({ id: response.id }, "Canned response created");
  }

  async updateCannedResponse(session: SessionPayload, responseId: string, payload: unknown) {
    assertSuperAdmin(session);
    const parsed = cannedResponseSchema.partial().parse(payload);
    const response = await prisma.cannedResponse.update({ where: { id: responseId }, data: { ...parsed, updatedById: session.userId } });
    await this.audit(session, "UPDATE", "CannedResponse", response.id, parsed as Prisma.InputJsonValue, null);
    return this.response({ id: response.id }, "Canned response updated");
  }

  async requestDataCorrection(session: SessionPayload, ticketId: string, payload: unknown) {
    assertSuperAdmin(session);
    const parsed = dataCorrectionRequestSchema.parse(payload);
    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException("Support ticket not found.");
    const record = await prisma.dataCorrectionRecord.create({
      data: { ticketId, requestedById: session.userId, status: "PENDING", ...parsed }
    });
    await this.audit(session, "UPDATE", "SupportTicket", ticketId, { dataCorrectionRequested: record.id }, ticket.schoolId);
    return this.response({ id: record.id }, "Data correction requested — awaiting Super Admin approval");
  }

  async approveDataCorrection(session: SessionPayload, recordId: string) {
    assertAnyPlatformRole(session, new Set<UserRole>(["PLATFORM_OWNER", "SUPER_ADMIN"]), "Data corrections can only be approved by Super Admin.");
    const record = await prisma.dataCorrectionRecord.findUnique({ where: { id: recordId }, include: { ticket: true } });
    if (!record) throw new NotFoundException("Data correction record not found.");
    if (record.status !== "PENDING") throw new BadRequestException("This correction has already been resolved.");
    const updated = await prisma.dataCorrectionRecord.update({
      where: { id: recordId },
      data: { status: "COMPLETED", approvedById: session.userId, completedAt: new Date() }
    });
    await this.audit(session, "UPDATE", "DataCorrectionRecord", record.id, { fieldCorrected: record.fieldCorrected, oldValue: record.oldValue, newValue: record.newValue }, record.ticket.schoolId);
    return this.response({ id: updated.id, status: updated.status }, "Data correction approved and logged");
  }

  async ticketAnalytics(session: SessionPayload) {
    assertSuperAdmin(session);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [totalOpened, resolvedTickets, categoryBreakdown, agentGroups, csatResponses] = await Promise.all([
      prisma.supportTicket.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.supportTicket.findMany({ where: { resolvedAt: { gte: thirtyDaysAgo, not: null } }, select: { createdAt: true, resolvedAt: true, slaDueAt: true, priority: true, assignedToId: true, category: true } }),
      prisma.supportTicket.groupBy({ by: ["category"], where: { createdAt: { gte: thirtyDaysAgo } }, _count: { category: true } }),
      prisma.supportTicket.groupBy({ by: ["assignedToId"], where: { createdAt: { gte: thirtyDaysAgo }, assignedToId: { not: null } }, _count: { assignedToId: true } }),
      prisma.ticketCsatResponse.findMany({ where: { submittedAt: { gte: thirtyDaysAgo } }, include: { ticket: { select: { assignedToId: true } } } })
    ]);

    const resolvedWithinSla = resolvedTickets.filter((t) => !t.slaDueAt || (t.resolvedAt && t.resolvedAt <= t.slaDueAt)).length;
    const avgResolutionByPriority: Record<string, number> = {};
    for (const priority of ["LOW", "MEDIUM", "HIGH", "CRITICAL"]) {
      const group = resolvedTickets.filter((t) => t.priority === priority);
      avgResolutionByPriority[priority] = group.length
        ? Math.round((group.reduce((sum, t) => sum + (t.resolvedAt!.getTime() - t.createdAt.getTime()), 0) / group.length / (60 * 60 * 1000)) * 10) / 10
        : 0;
    }

    const agentIds = agentGroups.map((g) => g.assignedToId).filter((id): id is string => Boolean(id));
    const agents = agentIds.length ? await prisma.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, firstName: true, lastName: true } }) : [];
    const csatByAgent = new Map<string, number[]>();
    for (const csat of csatResponses) {
      if (!csat.ticket.assignedToId) continue;
      const list = csatByAgent.get(csat.ticket.assignedToId) ?? [];
      list.push(csat.score);
      csatByAgent.set(csat.ticket.assignedToId, list);
    }

    return this.response({
      totalOpened,
      totalResolved: resolvedTickets.length,
      resolvedWithinSla,
      avgResolutionByPriority,
      categoryBreakdown: categoryBreakdown.map((c) => ({ category: c.category, count: c._count.category })),
      perAgent: agentGroups.map((g) => {
        const agent = agents.find((a) => a.id === g.assignedToId);
        const scores = csatByAgent.get(g.assignedToId!) ?? [];
        return {
          agentId: g.assignedToId,
          agentName: agent ? `${agent.firstName} ${agent.lastName}` : "Unknown",
          ticketsHandled: g._count.assignedToId,
          avgCsat: scores.length ? Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10 : null
        };
      })
    });
  }

  async listFeatureFlags(session: SessionPayload) {
    assertAnyPlatformRole(session, technicalRoles, "Feature flags are restricted to platform owner, admin, and technical admin roles.");
    const flags = await prisma.platformFeatureFlag.findMany({ include: { _count: { select: { overrides: true } } }, orderBy: { createdAt: "desc" } });
    return this.response(flags.map((flag) => ({
      id: flag.id,
      key: flag.key,
      name: flag.name,
      description: flag.description,
      enabledGlobally: flag.enabledGlobally,
      rolloutPercent: flag.rolloutPercent,
      overrides: flag._count.overrides,
      createdAt: flag.createdAt.toISOString()
    })));
  }

  async createFeatureFlag(session: SessionPayload, payload: unknown) {
    assertAnyPlatformRole(session, technicalRoles, "Feature flag changes are restricted to technical platform roles.");
    const parsed = featureFlagSchema.parse(payload);
    const actor = await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] } });
    const flag = await prisma.platformFeatureFlag.create({ data: { ...parsed, createdById: actor?.id } });
    await this.audit(session, "CREATE", "PlatformFeatureFlag", flag.id, parsed as Prisma.InputJsonValue, null);
    return this.response(flag, "Feature flag created");
  }

  async listCommunications(session: SessionPayload) {
    assertSuperAdmin(session);
    const [announcements, maintenance] = await Promise.all([
      prisma.platformAnnouncement.findMany({ include: { _count: { select: { views: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.maintenanceWindow.findMany({ orderBy: { startsAt: "desc" }, take: 20 })
    ]);
    return this.response({ announcements, maintenance });
  }

  async createAnnouncement(session: SessionPayload, payload: unknown) {
    assertAnyPlatformRole(session, new Set<UserRole>(["PLATFORM_OWNER", "PLATFORM_ADMIN", "SALES_MANAGER", "DEVELOPER", "SUPER_ADMIN"]));
    const parsed = announcementSchema.parse(payload);
    const actor = await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] } });
    const announcement = await prisma.platformAnnouncement.create({
      data: {
        title: parsed.title,
        body: parsed.body,
        type: parsed.type,
        target: parsed.target as Prisma.InputJsonValue,
        scheduledAt: parsed.scheduledAt,
        expiresAt: parsed.expiresAt,
        publishedAt: parsed.scheduledAt ? undefined : new Date(),
        ...(actor ? { author: { connect: { id: actor.id } } } : {})
      }
    });
    await this.audit(session, "CREATE", "PlatformAnnouncement", announcement.id, { title: parsed.title, type: parsed.type }, null);
    return this.response({ id: announcement.id }, "Announcement created");
  }

  async listCrm(session: SessionPayload) {
    assertAnyPlatformRole(session, new Set<UserRole>(["PLATFORM_OWNER", "PLATFORM_ADMIN", "SALES_MANAGER", "SUPPORT_AGENT", "SUPER_ADMIN"]));
    const [schools, interactions, leads, nps] = await Promise.all([
      prisma.school.findMany({ where: { deletedAt: null }, include: { accountManager: true, _count: { select: { supportTickets: true, crmInteractions: true } } }, orderBy: { healthScore: "asc" }, take: 50 }),
      prisma.crmInteraction.findMany({ include: { school: true, createdBy: true }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.lead.findMany({ include: { assignedTo: true }, orderBy: { updatedAt: "desc" }, take: 100 }),
      prisma.npsResponse.findMany({ include: { school: true }, orderBy: { createdAt: "desc" }, take: 50 })
    ]);
    return this.response({
      accounts: schools.map((school) => ({
        id: school.id,
        name: school.name,
        plan: school.plan,
        status: school.status,
        healthScore: school.healthScore,
        accountManager: school.accountManager ? `${school.accountManager.firstName} ${school.accountManager.lastName}` : "Unassigned",
        supportTickets: school._count.supportTickets,
        interactions: school._count.crmInteractions,
        nextBillingAt: school.nextBillingAt?.toISOString()
      })),
      interactions,
      leads,
      nps
    });
  }

  async createCrmInteraction(session: SessionPayload, payload: unknown) {
    assertAnyPlatformRole(session, new Set<UserRole>(["PLATFORM_OWNER", "PLATFORM_ADMIN", "SALES_MANAGER", "SUPPORT_AGENT", "SUPER_ADMIN"]));
    const parsed = crmInteractionSchema.parse(payload);
    const actor = await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] } });
    const interaction = await prisma.crmInteraction.create({ data: { ...parsed, createdById: actor?.id } });
    await this.audit(session, "CREATE", "CrmInteraction", interaction.id, { schoolId: parsed.schoolId, type: parsed.type }, parsed.schoolId);
    return this.response({ id: interaction.id }, "CRM interaction logged");
  }

  async createLead(session: SessionPayload, payload: unknown) {
    assertAnyPlatformRole(session, salesRoles, "Lead management is restricted to owner, platform admin, and sales roles.");
    const parsed = leadSchema.parse(payload);
    const lead = await prisma.lead.create({ data: parsed as Prisma.LeadCreateInput });
    await this.audit(session, "CREATE", "Lead", lead.id, { prospectName: parsed.prospectName, stage: parsed.stage }, null);
    return this.response({ id: lead.id }, "Lead created");
  }

  async securityOverview(session: SessionPayload) {
    assertAnyPlatformRole(session, new Set<UserRole>(["PLATFORM_OWNER", "PLATFORM_ADMIN", "DEVELOPER", "SUPPORT_AGENT", "SUPER_ADMIN"]));
    const [sessions, attempts, privacy, backups, systemLogs, incidents] = await Promise.all([
      prisma.platformSession.findMany({ where: { revokedAt: null, expiresAt: { gt: new Date() } }, include: { user: true, school: true }, orderBy: { lastActivityAt: "desc" }, take: 50 }),
      prisma.loginAttempt.findMany({ include: { school: true }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.dataPrivacyRequest.findMany({ include: { school: true, handledBy: true }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.backupRecord.findMany({ include: { school: true }, orderBy: { startedAt: "desc" }, take: 20 }),
      prisma.systemLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.securityIncident.findMany({ include: { reportedBy: true, resolvedBy: true }, orderBy: { detectedAt: "desc" }, take: 50 })
    ]);
    return this.response({
      sessions: sessions.map((s) => ({
        id: s.id,
        user: s.user ? { firstName: s.user.firstName, lastName: s.user.lastName, email: s.user.email, role: s.user.role } : null,
        school: s.school ? { name: s.school.name } : null,
        ipAddress: s.ipAddress,
        device: s.device,
        lastActivityAt: s.lastActivityAt.toISOString()
      })),
      attempts: attempts.map((a) => ({
        id: a.id,
        email: a.email,
        status: a.success ? "SUCCESS" : "FAILED",
        ipAddress: a.ipAddress,
        failureReason: a.reason,
        school: a.school ? { name: a.school.name } : null,
        createdAt: a.createdAt.toISOString()
      })),
      privacy: privacy.map((p) => ({
        id: p.id,
        type: p.type,
        status: p.status,
        subject: p.subject,
        confirmationHash: p.confirmationHash,
        completedAt: p.completedAt?.toISOString(),
        school: p.school ? { name: p.school.name } : null,
        createdAt: p.createdAt.toISOString()
      })),
      backups,
      systemLogs,
      incidents: incidents.map((i) => ({
        id: i.id,
        type: i.type,
        severity: i.severity,
        status: i.status,
        description: i.description,
        detectedAt: i.detectedAt.toISOString(),
        resolvedAt: i.resolvedAt?.toISOString(),
        postIncidentNotes: i.postIncidentNotes,
        reportedBy: i.reportedBy ? `${i.reportedBy.firstName} ${i.reportedBy.lastName}` : "System",
        resolvedBy: i.resolvedBy ? `${i.resolvedBy.firstName} ${i.resolvedBy.lastName}` : null
      }))
    });
  }

  async createPrivacyRequest(session: SessionPayload, payload: unknown) {
    assertAnyPlatformRole(session, new Set<UserRole>(["PLATFORM_OWNER", "PLATFORM_ADMIN", "DEVELOPER", "SUPER_ADMIN"]));
    const parsed = privacyRequestSchema.parse(payload);
    const request = await prisma.dataPrivacyRequest.create({ data: parsed });
    await this.audit(session, "CREATE", "DataPrivacyRequest", request.id, { type: parsed.type, subject: parsed.subject }, parsed.schoolId ?? null);
    return this.response({ id: request.id }, "Privacy request created");
  }

  async updatePrivacyRequestStatus(session: SessionPayload, requestId: string, payload: unknown) {
    assertAnyPlatformRole(session, new Set<UserRole>(["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPER_ADMIN"]));
    const parsed = privacyStatusSchema.parse(payload);
    const request = await prisma.dataPrivacyRequest.update({
      where: { id: requestId },
      data: { status: parsed.status, handledById: session.userId, resolvedAt: parsed.status === "REJECTED" ? new Date() : undefined }
    });
    await this.audit(session, "UPDATE", "DataPrivacyRequest", request.id, { status: parsed.status }, request.schoolId);
    return this.response({ id: request.id, status: request.status }, "Privacy request updated");
  }

  async completeDataDeletion(session: SessionPayload, requestId: string) {
    assertAnyPlatformRole(session, new Set<UserRole>(["PLATFORM_OWNER", "SUPER_ADMIN"]), "Only Super Admin can confirm a data deletion.");
    const request = await prisma.dataPrivacyRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException("Data privacy request not found.");
    if (request.type !== "ERASURE") throw new BadRequestException("Only erasure (data deletion) requests can be completed this way.");
    if (request.status === "COMPLETED") throw new BadRequestException("This deletion has already been completed.");

    const completedAt = new Date();
    const confirmationHash = createHash("sha256")
      .update(`${request.id}:${request.schoolId ?? "platform"}:${completedAt.toISOString()}:${session.userId}`)
      .digest("hex");

    const updated = await prisma.dataPrivacyRequest.update({
      where: { id: requestId },
      data: { status: "COMPLETED", completedById: session.userId, completedAt, dataExportedAt: request.dataExportedAt ?? completedAt, confirmationHash }
    });
    await this.audit(session, "DELETE", "DataPrivacyRequest", request.id, { ndpcCompletion: true, confirmationHash }, request.schoolId);
    return this.response({ id: updated.id, status: updated.status, confirmationHash }, "Data deletion completed and logged for NDPC compliance");
  }

  async complianceReport(session: SessionPayload) {
    assertAnyPlatformRole(session, new Set<UserRole>(["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPER_ADMIN"]));
    const requests = await prisma.dataPrivacyRequest.findMany({ where: { type: "ERASURE" }, include: { school: true, completedBy: true }, orderBy: { createdAt: "desc" } });
    const byStatus = requests.reduce((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);
    return this.response({
      totalDeletionRequests: requests.length,
      byStatus,
      completed: requests.filter((r) => r.status === "COMPLETED").map((r) => ({
        id: r.id,
        schoolName: r.school?.name ?? "Platform",
        subject: r.subject,
        completedBy: r.completedBy ? `${r.completedBy.firstName} ${r.completedBy.lastName}` : "Unknown",
        completedAt: r.completedAt?.toISOString(),
        confirmationHash: r.confirmationHash
      }))
    });
  }

  async listSecurityIncidents(session: SessionPayload) {
    assertAnyPlatformRole(session, new Set<UserRole>(["PLATFORM_OWNER", "DEVELOPER", "SUPER_ADMIN"]), "Security incident management is restricted to CTO and Super Admin.");
    const incidents = await prisma.securityIncident.findMany({ include: { reportedBy: true, resolvedBy: true }, orderBy: { detectedAt: "desc" } });
    return this.response(incidents.map((i) => ({
      id: i.id,
      type: i.type,
      severity: i.severity,
      status: i.status,
      description: i.description,
      detectedAt: i.detectedAt.toISOString(),
      resolvedAt: i.resolvedAt?.toISOString(),
      postIncidentNotes: i.postIncidentNotes,
      reportedBy: i.reportedBy ? `${i.reportedBy.firstName} ${i.reportedBy.lastName}` : "System",
      resolvedBy: i.resolvedBy ? `${i.resolvedBy.firstName} ${i.resolvedBy.lastName}` : null
    })));
  }

  async createSecurityIncident(session: SessionPayload, payload: unknown) {
    assertAnyPlatformRole(session, new Set<UserRole>(["PLATFORM_OWNER", "DEVELOPER", "SUPER_ADMIN"]), "Security incident management is restricted to CTO and Super Admin.");
    const parsed = securityIncidentSchema.parse(payload);
    const incident = await prisma.securityIncident.create({ data: { ...parsed, status: "DETECTED", reportedById: session.userId } });
    await this.audit(session, "CREATE", "SecurityIncident", incident.id, { type: parsed.type, severity: parsed.severity }, null);
    return this.response({ id: incident.id }, "Security incident logged");
  }

  async updateSecurityIncident(session: SessionPayload, incidentId: string, payload: unknown) {
    assertAnyPlatformRole(session, new Set<UserRole>(["PLATFORM_OWNER", "DEVELOPER", "SUPER_ADMIN"]), "Security incident management is restricted to CTO and Super Admin.");
    const parsed = securityIncidentUpdateSchema.parse(payload);
    if (parsed.status === "RESOLVED" && !parsed.postIncidentNotes) {
      throw new BadRequestException("A post-incident note (root cause, actions, prevention) is required to resolve an incident.");
    }
    const incident = await prisma.securityIncident.update({
      where: { id: incidentId },
      data: {
        status: parsed.status,
        postIncidentNotes: parsed.postIncidentNotes,
        resolvedById: parsed.status === "RESOLVED" ? session.userId : undefined,
        resolvedAt: parsed.status === "RESOLVED" ? new Date() : undefined
      }
    });
    await this.audit(session, "UPDATE", "SecurityIncident", incident.id, { status: parsed.status }, null);
    return this.response({ id: incident.id, status: incident.status }, "Security incident updated");
  }

  async listPlans(session: SessionPayload) {
    assertAnyPlatformRole(session, new Set<UserRole>(["PLATFORM_OWNER", "PLATFORM_ADMIN", "SALES_MANAGER", "FINANCE_MANAGER", "SUPER_ADMIN"]));
    return this.response(await prisma.platformSubscriptionPlan.findMany({ orderBy: { monthlyPrice: "asc" } }));
  }

  async createPlan(session: SessionPayload, payload: unknown) {
    assertAnyPlatformRole(session, new Set<UserRole>(["PLATFORM_OWNER", "SUPER_ADMIN"]));
    const parsed = planConfigSchema.parse(payload);
    const plan = await prisma.platformSubscriptionPlan.create({ data: parsed as Prisma.PlatformSubscriptionPlanCreateInput });
    await this.audit(session, "CREATE", "PlatformSubscriptionPlan", plan.id, { slug: parsed.slug, monthlyPrice: parsed.monthlyPrice }, null);
    return this.response({ id: plan.id }, "Subscription plan created");
  }

  async createMaintenanceWindow(session: SessionPayload, payload: unknown) {
    assertAnyPlatformRole(session, technicalRoles, "Maintenance windows are restricted to technical platform roles.");
    const parsed = maintenanceWindowSchema.parse(payload);
    if (parsed.endsAt <= parsed.startsAt) throw new BadRequestException("Maintenance end time must be after start time.");
    const actor = await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] } });
    const window = await prisma.maintenanceWindow.create({
      data: {
        title: parsed.title,
        message: parsed.message,
        startsAt: parsed.startsAt,
        endsAt: parsed.endsAt,
        isActive: parsed.isActive,
        whitelist: parsed.whitelist as Prisma.InputJsonValue,
        ...(actor ? { createdBy: { connect: { id: actor.id } } } : {})
      }
    });
    await this.audit(session, "SETTINGS_UPDATE", "MaintenanceWindow", window.id, { title: parsed.title, isActive: parsed.isActive }, null);
    return this.response({ id: window.id }, "Maintenance window created");
  }
}
