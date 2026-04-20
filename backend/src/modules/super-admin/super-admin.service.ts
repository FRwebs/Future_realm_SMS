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
  status: tenantStatusSchema.optional()
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

const supportTicketSchema = z.object({
  schoolId: z.string().min(1),
  subject: z.string().min(3),
  description: z.string().min(5),
  category: z.enum(["BILLING", "TECHNICAL_BUG", "FEATURE_REQUEST", "ACCOUNT_ACCESS", "DATA_ISSUE", "OTHER"]).default("OTHER"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  assignedToId: z.string().optional()
});

const ticketMessageSchema = z.object({
  body: z.string().min(2),
  internalOnly: z.coerce.boolean().default(false)
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
      }))
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
      include: { school: true, guardian: true, student: true, staffProfile: true }
    });
    if (!user) throw new NotFoundException("User not found.");
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
      profileType: user.student ? "STUDENT" : user.guardian ? "PARENT" : user.staffProfile ? "STAFF" : "USER"
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

  async softDeleteUser(session: SessionPayload, userId: string) {
    assertSuperAdmin(session);
    const user = await prisma.user.update({ where: { id: userId }, data: { isActive: false, deletedAt: new Date() } });
    await this.audit(session, "DELETE", "User", user.id, { email: user.email, softDelete: true }, user.schoolId);
    return this.response({ id: user.id }, "User soft-deleted");
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

  async analyticsOverview(session: SessionPayload) {
    assertSuperAdmin(session);
    const sevenDays = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDays = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [schools, users, weekSignups, monthSignups, activeUsers, auditLogs] = await Promise.all([
      prisma.school.groupBy({ by: ["status"], where: { deletedAt: null }, _count: true }),
      prisma.user.groupBy({ by: ["role"], where: { deletedAt: null }, _count: true }),
      prisma.school.count({ where: { createdAt: { gte: sevenDays }, deletedAt: null } }),
      prisma.school.count({ where: { createdAt: { gte: thirtyDays }, deletedAt: null } }),
      prisma.user.count({ where: { lastLoginAt: { gte: thirtyDays }, deletedAt: null } }),
      prisma.auditLog.findMany({ include: { actor: true, school: true }, orderBy: { createdAt: "desc" }, take: 10 })
    ]);
    const statusCounts = Object.fromEntries(schools.map((item) => [item.status, item._count]));
    const roleCounts = Object.fromEntries(users.map((item) => [item.role, item._count]));
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

  async impersonate(session: SessionPayload, userId: string) {
    assertSuperAdmin(session);
    const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null, isActive: true }, include: { school: true } });
    if (!user) throw new NotFoundException("User not found or inactive.");
    if (platformRoles.has(user.role)) throw new BadRequestException("Cannot impersonate another platform admin account.");
    const token = await createSessionToken({
      userId: user.id,
      schoolId: user.schoolId,
      role: user.role as Role,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`
    }, { maxAgeSeconds: 15 * 60 });
    await this.audit(session, "IMPERSONATE", "User", user.id, { email: user.email, schoolId: user.schoolId }, user.schoolId);
    return this.response({ token, expiresInSeconds: 15 * 60, user: { id: user.id, email: user.email, role: user.role, schoolName: user.school.name } }, "Impersonation token generated");
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
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString()
    })), "Support tickets loaded", pagination(parsed.page, parsed.limit, total));
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
        slaDueAt: new Date(Date.now() + (parsed.priority === "CRITICAL" ? 4 : parsed.priority === "HIGH" ? 12 : 48) * 60 * 60 * 1000),
        messages: { create: { authorId: actor?.id, body: parsed.description, internalOnly: false } }
      }
    });
    await this.audit(session, "CREATE", "SupportTicket", ticket.id, { subject: parsed.subject, priority: parsed.priority }, parsed.schoolId);
    return this.response({ id: ticket.id, ticketNo: ticket.ticketNo }, "Support ticket created");
  }

  async addTicketMessage(session: SessionPayload, ticketId: string, payload: unknown) {
    assertSuperAdmin(session);
    const parsed = ticketMessageSchema.parse(payload);
    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException("Support ticket not found.");
    const actor = await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] } });
    const message = await prisma.ticketMessage.create({ data: { ticketId, authorId: actor?.id, body: parsed.body, internalOnly: parsed.internalOnly } });
    await prisma.supportTicket.update({ where: { id: ticketId }, data: { status: "IN_PROGRESS" } });
    await this.audit(session, "UPDATE", "SupportTicket", ticketId, { messageId: message.id, internalOnly: parsed.internalOnly }, ticket.schoolId);
    return this.response({ id: message.id }, "Ticket message added");
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
    const [sessions, attempts, privacy, backups, systemLogs] = await Promise.all([
      prisma.platformSession.findMany({ include: { user: true, school: true }, orderBy: { lastActivityAt: "desc" }, take: 50 }),
      prisma.loginAttempt.findMany({ include: { school: true }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.dataPrivacyRequest.findMany({ include: { school: true, handledBy: true }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.backupRecord.findMany({ include: { school: true }, orderBy: { startedAt: "desc" }, take: 20 }),
      prisma.systemLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 })
    ]);
    return this.response({ sessions, attempts, privacy, backups, systemLogs });
  }

  async createPrivacyRequest(session: SessionPayload, payload: unknown) {
    assertAnyPlatformRole(session, new Set<UserRole>(["PLATFORM_OWNER", "PLATFORM_ADMIN", "DEVELOPER", "SUPER_ADMIN"]));
    const parsed = privacyRequestSchema.parse(payload);
    const request = await prisma.dataPrivacyRequest.create({ data: parsed });
    await this.audit(session, "CREATE", "DataPrivacyRequest", request.id, { type: parsed.type, subject: parsed.subject }, parsed.schoolId ?? null);
    return this.response({ id: request.id }, "Privacy request created");
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
