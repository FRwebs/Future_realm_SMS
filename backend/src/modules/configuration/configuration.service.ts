import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, SchoolCategory, SchoolSection } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { policyDefinition, validatePolicyValues } from "../../../../src/lib/modules/school-policies";
import { RolesManagementService } from "../roles-management/roles-management.service";

type ConfigGroup = "General" | "Finance" | "Academics" | "Others";
type ConfigAction = "view" | "create" | "update" | "delete" | "manage" | "export";

type ResourceDefinition = {
  key: string;
  label: string;
  group: ConfigGroup;
  description: string;
  mode: "table" | "settings" | "readonly";
  backend: "sessions_terms" | "school" | "class_levels" | "calendar" | "subjects" | "departments" | "login_history" | "assessment_windows" | "generic";
  actions: ConfigAction[];
  fields: Array<{ name: string; label: string; type: "text" | "number" | "date" | "textarea" | "select"; required?: boolean; options?: Array<{ label: string; value: string }> }>;
};

const resourceDefinitions: ResourceDefinition[] = [
  { key: "sessions-terms", label: "Sessions & Terms", group: "General", description: "Academic sessions, terms, and current period controls.", mode: "table", backend: "sessions_terms", actions: ["view", "create", "update", "delete", "manage"], fields: [] },
  { key: "school-information", label: "School Information", group: "General", description: "Registered school identity, contacts, branding, and locale.", mode: "settings", backend: "school", actions: ["view", "update"], fields: [] },
  { key: "assessment-windows", label: "Assessment Windows", group: "Academics", description: "When each assessment component can be scored in a term, and when its result is released.", mode: "table", backend: "assessment_windows", actions: ["view", "create", "update", "delete"], fields: [] },
  { key: "school-policies", label: "School Policies", group: "General", description: "The rules that make the product behave like this school.", mode: "settings", backend: "generic", actions: ["view", "update", "manage"], fields: [] },
  { key: "class-levels", label: "Class Levels", group: "General", description: "Creche, Nursery, Primary, JSS, and SS level ordering.", mode: "table", backend: "class_levels", actions: ["view", "create", "update", "delete"], fields: [] },
  { key: "class-arms", label: "Class Arms", group: "General", description: "Reusable arms such as Gold, Silver, A, B, C, Science, Arts, and Commercial.", mode: "table", backend: "generic", actions: ["view", "create", "update", "delete", "manage"], fields: [] },
  { key: "school-calendar", label: "School Calendar", group: "General", description: "Holidays, resumption, PTA, speech day, exams, and vacation events.", mode: "table", backend: "calendar", actions: ["view", "create", "update", "delete"], fields: [] },
  { key: "admissions", label: "Admissions", group: "General", description: "Admission workflows, windows, requirements, and screening defaults.", mode: "settings", backend: "generic", actions: ["view", "update", "manage"], fields: [] },
  { key: "finance", label: "Finance", group: "General", description: "Invoice numbering, receipt prefix, due date defaults, and penalty settings.", mode: "settings", backend: "generic", actions: ["view", "update"], fields: [] },
  { key: "payment-settings", label: "Payment Settings", group: "Finance", description: "Bank accounts, payment channel toggles, and gateway-safe metadata.", mode: "settings", backend: "generic", actions: ["view", "update", "manage"], fields: [] },
  { key: "fees", label: "Fees Configuration", group: "Finance", description: "Fee categories, recurring settings, and fee configuration defaults.", mode: "table", backend: "generic", actions: ["view", "create", "update", "delete"], fields: [] },
  { key: "chart-of-accounts", label: "Chart of Accounts", group: "Finance", description: "Account codes, account names, and account types.", mode: "table", backend: "generic", actions: ["view", "create", "update", "delete"], fields: [] },
  { key: "expense-items", label: "Expense Items", group: "Finance", description: "Expense categories, default mappings, and budget labels.", mode: "table", backend: "generic", actions: ["view", "create", "update", "delete"], fields: [] },
  { key: "inventory-settings", label: "Inventory Settings", group: "Finance", description: "Inventory categories, units, reorder settings, and stock defaults.", mode: "settings", backend: "generic", actions: ["view", "update"], fields: [] },
  { key: "payroll-settings", label: "Payroll Settings", group: "Finance", description: "Earnings, deductions, pension defaults, tax labels, and pay frequency.", mode: "settings", backend: "generic", actions: ["view", "update"], fields: [] },
  { key: "subjects", label: "Subjects", group: "Academics", description: "Subject codes, departments, category, class applicability, and core/elective flags.", mode: "table", backend: "subjects", actions: ["view", "create", "update", "delete"], fields: [] },
  { key: "departments", label: "Departments", group: "Academics", description: "Teaching departments, their codes, and the subjects and staff each one holds.", mode: "readonly", backend: "departments", actions: ["view", "export"], fields: [] },
  { key: "curricula", label: "Curricula", group: "Academics", description: "Whole curricula: name, basis, levels, subjects, assessment, grading, report card, and rollout.", mode: "table", backend: "generic", actions: ["view", "create", "update", "delete", "manage"], fields: [] },
  { key: "performance-configuration", label: "Performance Configuration", group: "Academics", description: "Grading scales, score bands, assessment weights, and comment templates.", mode: "settings", backend: "generic", actions: ["view", "update", "manage"], fields: [] },
  { key: "report-templates", label: "Report Templates", group: "Academics", description: "Report card template metadata, default templates, and applicability.", mode: "table", backend: "generic", actions: ["view", "create", "update", "delete", "manage"], fields: [] },
  { key: "promotions", label: "Promotions", group: "Academics", description: "Promotion thresholds, repeat criteria, and approval workflow defaults.", mode: "settings", backend: "generic", actions: ["view", "update", "manage"], fields: [] },
  { key: "exam", label: "Exam", group: "Academics", description: "Exam types, score weights, approval settings, and result locks.", mode: "settings", backend: "generic", actions: ["view", "update", "manage"], fields: [] },
  { key: "attendance", label: "Attendance", group: "Academics", description: "Attendance statuses, late thresholds, alert rules, and default windows.", mode: "settings", backend: "generic", actions: ["view", "update", "manage"], fields: [] },
  { key: "id-card", label: "ID Card", group: "Academics", description: "ID templates, numbering, printed fields, and default layouts.", mode: "settings", backend: "generic", actions: ["view", "update", "manage"], fields: [] },
  { key: "messaging", label: "Messaging", group: "Others", description: "SMS, email, in-app defaults, sender names, and template metadata.", mode: "settings", backend: "generic", actions: ["view", "update", "manage"], fields: [] },
  { key: "login-history", label: "Login History", group: "Others", description: "Read-only login attempt history with status, device, IP, and timestamp.", mode: "readonly", backend: "login_history", actions: ["view", "export"], fields: [] }
];

const genericSchema = z.object({
  name: z.string().trim().min(2),
  code: z.string().trim().optional().or(z.literal("")),
  description: z.string().trim().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
  displayOrder: z.coerce.number().int().min(0).default(0),
  isDefault: z.coerce.boolean().default(false),
  data: z.unknown().optional()
});

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

const sessionSchema = z.object({
  recordType: z.enum(["session", "term"]),
  name: z.string().trim().min(2),
  academicSessionId: z.string().optional().or(z.literal("")),
  startDate: z.string().min(4),
  endDate: z.string().min(4),
  order: z.coerce.number().int().min(1).default(1),
  isCurrent: z.coerce.boolean().default(false),
  breakStart: z.string().optional().or(z.literal("")),
  breakEnd: z.string().optional().or(z.literal("")),
  // The form says "Mon"; the column holds "MON". Either is accepted.
  schoolDays: z
    .array(z.string().transform((value) => value.trim().toUpperCase().slice(0, 3)).pipe(z.enum(WEEKDAYS)))
    .min(1, "Pick at least one school day.")
    .optional(),
  activateOnOpen: z.coerce.boolean().optional()
});

/** A date the form may leave blank: blank clears it, absent leaves it alone. */
function optionalDate(value: string | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException("That date is not a real date.");
  return date;
}

function assertTermDates(startDate: Date, endDate: Date, breakStart?: Date | null, breakEnd?: Date | null) {
  if (endDate.getTime() <= startDate.getTime()) {
    throw new BadRequestException("A term has to close after the day it opens.");
  }
  if ((breakStart && !breakEnd) || (!breakStart && breakEnd)) {
    throw new BadRequestException("Give the mid-term break both a first and a last day, or neither.");
  }
  if (breakStart && breakEnd) {
    if (breakEnd.getTime() < breakStart.getTime()) throw new BadRequestException("The break cannot end before it starts.");
    if (breakStart.getTime() < startDate.getTime() || breakEnd.getTime() > endDate.getTime()) {
      throw new BadRequestException("The mid-term break has to fall inside the term.");
    }
  }
}

const stringList = z.array(z.string().trim().min(1)).optional();

const schoolSchema = z.object({
  name: z.string().trim().min(2).optional(),
  schoolType: z.string().trim().max(60).optional().or(z.literal("")),
  composition: z.string().trim().max(40).optional().or(z.literal("")),
  attendancePattern: stringList,
  stagesOperated: stringList,
  foundedYear: z.union([z.coerce.number().int().min(1800).max(2100), z.literal("")]).optional(),
  mainPhone: z.string().trim().max(40).optional().or(z.literal("")),
  postalCode: z.string().trim().max(20).optional().or(z.literal("")),
  cacNumber: z.string().trim().max(80).optional().or(z.literal("")),
  ministryApprovalNumber: z.string().trim().max(80).optional().or(z.literal("")),
  regulatingAuthority: z.string().trim().max(120).optional().or(z.literal("")),
  approvalExpiresAt: z.string().optional().or(z.literal("")),
  showMottoUnderLogo: z.coerce.boolean().optional(),
  brandingAppliesTo: stringList,
  logoUrl: z.string().trim().max(100000).optional().or(z.literal("")),
  signatureUrl: z.string().trim().max(100000).optional().or(z.literal("")),
  stampUrl: z.string().trim().max(100000).optional().or(z.literal("")),
  shortName: z.string().trim().max(24).optional().or(z.literal("")),
  motto: z.string().trim().max(200).optional().or(z.literal("")),
  vision: z.string().trim().max(600).optional().or(z.literal("")),
  schoolCode: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().optional().or(z.literal("")),
  state: z.string().trim().optional().or(z.literal("")),
  country: z.string().trim().optional().or(z.literal("")),
  ownerName: z.string().trim().optional().or(z.literal("")),
  ownerEmail: z.string().trim().email().optional().or(z.literal("")),
  ownerPhone: z.string().trim().optional().or(z.literal("")),
  timezone: z.string().trim().default("Africa/Lagos"),
  primaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Write the colour as a hex code, like #0D2315.").optional().or(z.literal("")),
  secondaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Write the colour as a hex code, like #12796A.").optional().or(z.literal(""))
});

const classLevelSchema = z.object({
  name: z.string().trim().min(2),
  section: z.nativeEnum(SchoolCategory).default(SchoolCategory.PRIMARY),
  schoolSection: z.nativeEnum(SchoolSection).optional().nullable(),
  order: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().default(true)
});

const calendarSchema = z.object({
  title: z.string().trim().min(2),
  description: z.string().trim().optional().or(z.literal("")),
  audience: z.string().trim().default("ALL"),
  startsAt: z.string().min(4),
  endsAt: z.string().optional().or(z.literal("")),
  type: z.string().trim().max(60).optional(),
  location: z.string().trim().max(160).optional().or(z.literal("")),
  startTime: z.string().trim().max(10).optional().or(z.literal("")),
  endTime: z.string().trim().max(10).optional().or(z.literal("")),
  allDay: z.coerce.boolean().optional(),
  schoolClosed: z.coerce.boolean().optional(),
  visibleTo: stringList,
  reminder: z.string().trim().max(60).optional().or(z.literal("")),
  secondReminder: z.string().trim().max(60).optional().or(z.literal("")),
  reminderChannels: stringList
});

const assessmentWindowSchema = z.object({
  termId: z.string().min(1, "Choose the term this window belongs to."),
  componentId: z.string().min(1, "Choose the component this window opens."),
  opensAt: z.string().min(4, "When does it open?"),
  closesAt: z.string().min(4, "When does it close?"),
  releaseAt: z.string().min(4, "When does the result reach a guardian?"),
  appliesTo: z.string().trim().max(80).optional(),
  remindTeachers: z.coerce.boolean().optional(),
  allowLateEntry: z.coerce.boolean().optional(),
  // A blank box means "leave the component as it is", not "make it zero".
  maxScore: z.preprocess((value) => (value === "" ? undefined : value), z.coerce.number().positive().max(1000).optional()),
  weight: z.preprocess((value) => (value === "" ? undefined : value), z.coerce.number().min(0).max(100).optional()),
  reopenReason: z.string().trim().optional()
});

const subjectSchema = z.object({
  name: z.string().trim().min(2),
  code: z.string().trim().min(1),
  departmentId: z.string().optional().or(z.literal("")),
  section: z.nativeEnum(SchoolSection).optional().nullable(),
  isCore: z.coerce.boolean().default(false),
  isOptional: z.coerce.boolean().default(false),
  trackSpecific: z.string().optional().or(z.literal("")),
  status: z.string().default("ACTIVE")
});

/**
 * Resources that ride on another resource's permission rather than minting a
 * key of their own: a window is part of the calendar, a policy is part of how
 * the school is set up. A new key would need granting to every role before
 * anyone could use the screen it belongs to.
 */
const permissionAlias: Record<string, string> = {
  "assessment-windows": "school-calendar",
  "school-policies": "school-information"
};

function permissionKey(resource: string, action: ConfigAction) {
  const key = (permissionAlias[resource] ?? resource).replace(/-/g, "_");
  const normalizedAction = action === "update" ? "update" : action;
  return `config.${key}.${normalizedAction}`;
}

function asJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Prisma.InputJsonValue;
    } catch {
      return { value } as Prisma.InputJsonObject;
    }
  }
  return value as Prisma.InputJsonValue;
}

@Injectable()
export class ConfigurationService {
  constructor(private readonly rolesManagementService: RolesManagementService) {}

  async ok<T>(dataPromise: Promise<T>, message?: string) {
    return { ok: true, success: true, ...(message ? { message } : {}), data: await dataPromise };
  }

  private definition(resource: string) {
    const definition = resourceDefinitions.find((item) => item.key === resource);
    if (!definition) throw new NotFoundException("Configuration resource not found.");
    return definition;
  }

  private async permissions(session: SessionPayload) {
    return new Set(await this.rolesManagementService.resolveUserPermissions(session.userId, session.schoolId, session));
  }

  private async assertPermission(session: SessionPayload, resource: string, action: ConfigAction) {
    const permissions = await this.permissions(session);
    const required = permissionKey(resource, action);
    const manage = permissionKey(resource, "manage");
    if (!permissions.has(required) && !permissions.has(manage) && !permissions.has("config.manage")) {
      throw new ForbiddenException(`Missing permission: ${required}`);
    }
  }

  private async audit(session: SessionPayload, action: AuditAction, entityType: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    await prisma.auditLog.create({
      data: {
        schoolId: session.schoolId,
        actorId: session.userId,
        action,
        entityType,
        entityId,
        metadata
      }
    });
  }

  async overview(session: SessionPayload) {
    const permissions = await this.permissions(session);
    const permitted = resourceDefinitions
      .map((resource) => {
        const actions = resource.actions.filter((action) => permissions.has(permissionKey(resource.key, action)) || permissions.has(permissionKey(resource.key, "manage")) || permissions.has("config.manage"));
        return { ...resource, permissions: actions };
      })
      .filter((resource) => resource.permissions.includes("view") || resource.permissions.includes("manage"));

    const groups = ["General", "Finance", "Academics", "Others"].map((group) => ({
      group,
      resources: permitted.filter((resource) => resource.group === group)
    }));

    return { groups, resources: permitted };
  }

  async listResource(session: SessionPayload, resourceKey: string, query: Record<string, string | undefined>) {
    const definition = this.definition(resourceKey);
    await this.assertPermission(session, resourceKey, query.export === "true" ? "export" : "view");
    const search = query.search?.trim();

    if (definition.backend === "school") return this.schoolInformation(session);
    if (definition.backend === "sessions_terms") return this.sessionsTerms(session);
    if (definition.backend === "class_levels") return this.classLevels(session);
    if (definition.backend === "calendar") return this.calendarEvents(session, search);
    if (definition.backend === "assessment_windows") return this.assessmentWindows(session, query.termId);
    if (definition.backend === "subjects") return this.subjects(session, search);
    if (definition.backend === "departments") return this.departments(session, search);
    if (definition.backend === "login_history") return this.loginHistory(session, query);
    return this.genericItems(session, resourceKey, search);
  }

  /**
   * A term flagged "become active when it opens" is made active the first time
   * anyone looks after its opening day. There is no scheduler behind this, so the
   * promotion happens on read; the promise it keeps is that nobody has to
   * remember to switch the term themselves.
   */
  private async promoteDueTerm(schoolId: string) {
    const due = await prisma.term.findFirst({
      where: { schoolId, activateOnOpen: true, isCurrent: false, startDate: { lte: new Date() }, endDate: { gte: new Date() } },
      orderBy: { startDate: "desc" }
    });
    if (!due) return;
    await prisma.$transaction([
      prisma.term.updateMany({ where: { schoolId }, data: { isCurrent: false } }),
      prisma.term.update({ where: { id: due.id }, data: { isCurrent: true, activateOnOpen: false } }),
      prisma.academicSession.updateMany({ where: { schoolId }, data: { isCurrent: false } }),
      prisma.academicSession.update({ where: { id: due.academicSessionId }, data: { isCurrent: true } })
    ]);
  }

  private async sessionsTerms(session: SessionPayload) {
    await this.promoteDueTerm(session.schoolId);
    const sessions = await prisma.academicSession.findMany({
      where: { schoolId: session.schoolId },
      include: { terms: { orderBy: { order: "asc" } } },
      orderBy: { startDate: "desc" }
    });
    return {
      mode: "sessions_terms",
      records: sessions.map((item) => ({
        id: item.id,
        recordType: "session",
        name: item.name,
        startDate: item.startDate.toISOString().slice(0, 10),
        endDate: item.endDate.toISOString().slice(0, 10),
        isCurrent: item.isCurrent,
        terms: item.terms.map((term) => ({
          id: term.id,
          recordType: "term",
          academicSessionId: item.id,
          name: term.name,
          order: term.order,
          startDate: term.startDate.toISOString().slice(0, 10),
          endDate: term.endDate.toISOString().slice(0, 10),
          isCurrent: term.isCurrent,
          breakStart: term.breakStart ? term.breakStart.toISOString().slice(0, 10) : null,
          breakEnd: term.breakEnd ? term.breakEnd.toISOString().slice(0, 10) : null,
          schoolDays: term.schoolDays,
          activateOnOpen: term.activateOnOpen
        }))
      }))
    };
  }

  private async schoolInformation(session: SessionPayload) {
    const [school, principal, levels, lastEdit] = await Promise.all([
      prisma.school.findUnique({ where: { id: session.schoolId } }),
      prisma.user.findFirst({
        where: { schoolId: session.schoolId, role: "PRINCIPAL", deletedAt: null },
        select: { firstName: true, lastName: true, phone: true, email: true }
      }),
      prisma.classLevel.findMany({
        where: { schoolId: session.schoolId },
        select: { name: true, order: true, schoolSection: true },
        orderBy: { order: "asc" }
      }),
      prisma.auditLog.findFirst({
        where: { schoolId: session.schoolId, entityType: "School", entityId: session.schoolId, action: AuditAction.SETTINGS_UPDATE },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, actorId: true }
      })
    ]);
    const editor = lastEdit?.actorId
      ? await prisma.user.findUnique({ where: { id: lastEdit.actorId }, select: { firstName: true, lastName: true } })
      : null;
    const stageNames: Record<string, string> = {
      CRECHE: "Early Years",
      NURSERY: "Nursery",
      PRIMARY: "Primary",
      JUNIOR_SECONDARY: "Junior Secondary",
      SENIOR_SECONDARY: "Senior Secondary"
    };
    const derivedStages = Array.from(
      new Set(levels.map((level) => (level.schoolSection ? stageNames[level.schoolSection] : null)).filter((name): name is string => Boolean(name)))
    );

    return {
      mode: "settings",
      record: school
        ? {
            ...school,
            // Both are shown on the profile and neither is stored there: the
            // principal is a user, and the levels are the class levels the
            // school actually operates rather than a field somebody typed.
            principalName: principal
              ? [principal.firstName, principal.lastName].filter(Boolean).join(" ")
              : null,
            principalPhone: principal?.phone ?? null,
            principalEmail: principal?.email ?? null,
            levelsOperated: levels.map((level) => level.name),
            derivedStages,
            lastEdited: lastEdit
              ? {
                  at: lastEdit.createdAt.toISOString(),
                  by: editor ? [editor.firstName, editor.lastName].filter(Boolean).join(" ") : null,
                  byYou: lastEdit.actorId === session.userId
                }
              : null
          }
        : null
    };
  }

  private async classLevels(session: SessionPayload) {
    const records = await prisma.classLevel.findMany({ where: { schoolId: session.schoolId }, orderBy: { order: "asc" } });
    return { mode: "table", records };
  }

  private async calendarEvents(session: SessionPayload, search?: string) {
    const records = await prisma.calendarEvent.findMany({
      where: {
        schoolId: session.schoolId,
        ...(search ? { title: { contains: search, mode: "insensitive" } } : {})
      },
      orderBy: { startsAt: "asc" }
    });
    return {
      mode: "table",
      records: records.map((event) => ({
        ...event,
        startsAt: event.startsAt.toISOString().slice(0, 10),
        endsAt: event.endsAt.toISOString().slice(0, 10)
      }))
    };
  }

  private async subjects(session: SessionPayload, search?: string) {
    const records = await prisma.subject.findMany({
      where: {
        schoolId: session.schoolId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: { name: "asc" }
    });
    return { mode: "table", records };
  }

  /**
   * Departments, each with what it actually holds.
   *
   * The subjects resource returns `departmentId` and nothing else, so every
   * screen that wanted a department name had either to show a cuid or drop the
   * column. The counts come back with it because a department is only
   * meaningful as the subjects and staff sitting under it.
   */
  /**
   * Put a curriculum built in the builder into force.
   *
   * The builder writes a curriculum as one record and deliberately changes
   * nothing live — "nothing is in force until you say so". This is the step
   * that says so: it reads the stored design, checks it is actually usable,
   * and writes the two layers the product computes results from — the grading
   * bands and each section's assessment components.
   *
   * It refuses to do that mid-term when scores already exist, because the
   * scores were entered against the framework in force and changing the
   * weights underneath them silently restates results families have already
   * been given.
   */
  async applyCurriculum(session: SessionPayload, id: string, body: Record<string, unknown>) {
    await this.assertPermission(session, "curricula", "manage");

    const record = await prisma.configurationItem.findFirst({
      where: { schoolId: session.schoolId, resource: "curricula", id, deletedAt: null }
    });
    if (!record) throw new NotFoundException("That curriculum does not exist.");

    const data = (record.data ?? {}) as {
      assessment?: { components?: Array<{ name?: string; max?: number; weight?: number }> };
      grading?: { bands?: Array<{ grade?: string; lo?: number; hi?: number; label?: string; points?: number }> };
    };
    const components = data.assessment?.components ?? [];
    const bands = data.grading?.bands ?? [];

    if (!components.length) throw new BadRequestException("This curriculum sets no assessment components.");
    if (!bands.length) throw new BadRequestException("This curriculum sets no grading bands.");

    const weightTotal = Number(components.reduce((sum, item) => sum + Number(item.weight ?? 0), 0).toFixed(2));
    if (Math.abs(weightTotal - 100) > 0.01) {
      throw new BadRequestException(`Assessment weights total ${weightTotal}. They must total 100 before this can go in force.`);
    }

    const ordered = bands
      .map((band) => ({
        label: String(band.grade ?? "").trim(),
        minScore: Number(band.lo ?? 0),
        maxScore: Number(band.hi ?? 0),
        remark: String(band.label ?? band.grade ?? "").trim(),
        order: Number(band.points ?? 0)
      }))
      .sort((a, b) => a.minScore - b.minScore);

    if (ordered.some((band) => !band.label)) throw new BadRequestException("Every grading band needs a grade.");
    if (ordered[0].minScore !== 0 || ordered[ordered.length - 1].maxScore !== 100) {
      throw new BadRequestException("Grading bands must cover every mark from 0 to 100.");
    }
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const current = ordered[index];
      const next = ordered[index + 1];
      if (next.minScore <= current.maxScore) throw new BadRequestException(`${current.label} and ${next.label} overlap.`);
      if (next.minScore > current.maxScore + 1) {
        throw new BadRequestException(`Nothing covers ${current.maxScore + 1} to ${next.minScore - 1}.`);
      }
    }

    const term = await prisma.term.findFirst({ where: { schoolId: session.schoolId, isCurrent: true } });
    const scored = await prisma.scoreEntry.count({
      where: { schoolId: session.schoolId, isDraft: false }
    });
    const effectiveFrom = body.effectiveFrom === "NOW" ? "NOW" : "NEXT_TERM";
    if (scored > 0 && effectiveFrom === "NOW") {
      throw new BadRequestException(
        `${scored} score(s) have already been submitted against the framework in force. A curriculum in force cannot be swapped mid-term — put this one in force from the next term instead.`
      );
    }

    // The sections the school actually runs; a section with no components
    // today gets this curriculum's set like any other.
    const sections = await prisma.sectionAssessmentComponent.findMany({
      where: { schoolId: session.schoolId },
      select: { section: true },
      distinct: ["section"]
    });
    const targetSections = sections.length
      ? sections.map((row) => row.section)
      : ((await prisma.subject.findMany({
          where: { schoolId: session.schoolId, section: { not: null } },
          select: { section: true },
          distinct: ["section"]
        })).map((row) => row.section!) as typeof sections[number]["section"][]);

    const codeFor = (name: string, index: number) =>
      (name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").toUpperCase() || `COMPONENT_${index + 1}`).slice(0, 30);

    const typeFor = (name: string) => {
      const lower = name.toLowerCase();
      if (lower.includes("exam")) return "EXAMINATION" as const;
      if (lower.includes("project")) return "PROJECT" as const;
      if (lower.includes("practical")) return "PRACTICAL" as const;
      if (lower.includes("assign")) return "ASSIGNMENT" as const;
      if (lower.includes("class")) return "CLASSWORK" as const;
      return "TEST" as const;
    };

    const scheme = await prisma.$transaction(async (tx) => {
      await tx.gradingScheme.updateMany({ where: { schoolId: session.schoolId }, data: { isActive: false } });

      const created = await tx.gradingScheme.create({
        data: {
          schoolId: session.schoolId,
          name: record.name,
          description: record.description,
          isActive: true,
          rankingEnabled: true,
          passMark: ordered.find((band) => band.remark.toLowerCase().includes("pass"))?.minScore ?? 40,
          bands: {
            create: ordered
              .slice()
              .sort((a, b) => b.minScore - a.minScore)
              .map((band, index) => ({
                schoolId: session.schoolId,
                label: band.label,
                minScore: band.minScore,
                maxScore: band.maxScore,
                remark: band.remark,
                order: band.order || index + 1
              }))
          }
        },
        include: { bands: { orderBy: { order: "asc" } } }
      });

      for (const section of targetSections) {
        const codes = components.map((item, index) => codeFor(String(item.name ?? ""), index));
        await tx.sectionAssessmentComponent.updateMany({
          where: { schoolId: session.schoolId, section, termId: term?.id ?? null, code: { notIn: codes } },
          data: { isActive: false }
        });

        for (const [index, item] of components.entries()) {
          const code = codes[index];
          const name = String(item.name ?? `Component ${index + 1}`);
          const existing = await tx.sectionAssessmentComponent.findFirst({
            where: { schoolId: session.schoolId, section, termId: term?.id ?? null, code }
          });
          const values = {
            name,
            type: typeFor(name),
            weight: Number(item.weight ?? 0),
            maxScore: Number(item.max ?? 100),
            order: index + 1,
            isActive: true
          };
          if (existing) {
            await tx.sectionAssessmentComponent.update({ where: { id: existing.id }, data: values });
          } else {
            await tx.sectionAssessmentComponent.create({
              data: { schoolId: session.schoolId, section, termId: term?.id, code, ...values }
            });
          }
        }
      }

      // Exactly one curriculum is in force at a time.
      await tx.configurationItem.updateMany({
        where: { schoolId: session.schoolId, resource: "curricula", status: "ACTIVE" },
        data: { status: "INACTIVE" }
      });
      await tx.configurationItem.update({ where: { id: record.id }, data: { status: "ACTIVE" } });

      return created;
    });

    await this.audit(session, AuditAction.UPDATE, "ConfigurationItem", record.id, {
      action: "curriculum-in-force",
      curriculum: record.name,
      effectiveFrom,
      sections: targetSections.length,
      components: components.length,
      bands: ordered.length
    });

    return {
      curriculum: { id: record.id, name: record.name, status: "ACTIVE" },
      effectiveFrom,
      gradingSchemeId: scheme.id,
      bands: scheme.bands.length,
      sections: targetSections,
      componentsPerSection: components.length
    };
  }

  private async departments(session: SessionPayload, search?: string) {
    const records = await prisma.department.findMany({
      where: {
        schoolId: session.schoolId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: { name: "asc" },
      include: { _count: { select: { subjects: true, staff: true, classRooms: true } } }
    });

    return {
      mode: "readonly",
      records: records.map((department) => ({
        id: department.id,
        name: department.name,
        code: department.code,
        subjectCount: department._count.subjects,
        staffCount: department._count.staff,
        classRoomCount: department._count.classRooms
      }))
    };
  }

  private async loginHistory(session: SessionPayload, query: Record<string, string | undefined>) {
    const records = await prisma.loginAttempt.findMany({
      where: {
        schoolId: session.schoolId,
        ...(query.status === "success" ? { success: true } : query.status === "failed" ? { success: false } : {}),
        ...(query.search ? { email: { contains: query.search, mode: "insensitive" } } : {})
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(200, Number(query.pageSize ?? 50))
    });
    return { mode: "readonly", records };
  }

  private async genericItems(session: SessionPayload, resource: string, search?: string) {
    const records = await prisma.configurationItem.findMany({
      where: {
        schoolId: session.schoolId,
        resource,
        deletedAt: null,
        ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { code: { contains: search, mode: "insensitive" } }] } : {})
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }]
    });
    return { mode: "table", records };
  }

  async createResource(session: SessionPayload, resource: string, body: Record<string, unknown>) {
    this.definition(resource);
    await this.assertPermission(session, resource, "create");
    if (resource === "sessions-terms") return this.createSessionTerm(session, body);
    if (resource === "class-levels") return this.createClassLevel(session, body);
    if (resource === "school-calendar") return this.createCalendarEvent(session, body);
    if (resource === "subjects") return this.createSubject(session, body);
    if (resource === "assessment-windows") return this.createAssessmentWindow(session, body);
    if (resource === "school-policies") throw new BadRequestException("A policy is set by saving it, not created.");
    return this.createGeneric(session, resource, body);
  }

  async updateResource(session: SessionPayload, resource: string, id: string, body: Record<string, unknown>) {
    this.definition(resource);
    await this.assertPermission(session, resource, "update");
    if (resource === "school-information") return this.updateSchool(session, body);
    if (resource === "sessions-terms" && id === "active") return this.setActiveTerm(session, body);
    if (resource === "sessions-terms") return this.updateSessionTerm(session, id, body);
    if (resource === "class-levels") return this.updateClassLevel(session, id, body);
    if (resource === "school-calendar") return this.updateCalendarEvent(session, id, body);
    if (resource === "subjects") return this.updateSubject(session, id, body);
    if (resource === "assessment-windows") return this.updateAssessmentWindow(session, id, body);
    if (resource === "school-policies") return this.savePolicy(session, id, body);
    return this.updateGeneric(session, resource, id, body);
  }

  async deleteResource(session: SessionPayload, resource: string, id: string) {
    const definition = this.definition(resource);
    if (definition.mode === "readonly" || definition.mode === "settings") throw new BadRequestException("This configuration cannot be deleted.");
    await this.assertPermission(session, resource, "delete");
    if (resource === "sessions-terms") return this.deleteSessionTerm(session, id);
    if (resource === "class-levels") return this.deleteClassLevel(session, id);
    if (resource === "school-calendar") return this.deleteCalendarEvent(session, id);
    if (resource === "subjects") return this.deleteSubject(session, id);
    if (resource === "assessment-windows") return this.deleteAssessmentWindow(session, id);
    return this.deleteGeneric(session, resource, id);
  }

  private async createSessionTerm(session: SessionPayload, body: Record<string, unknown>) {
    const parsed = sessionSchema.parse(body);
    if (parsed.recordType === "session") {
      if (parsed.isCurrent) await prisma.academicSession.updateMany({ where: { schoolId: session.schoolId }, data: { isCurrent: false } });
      const created = await prisma.academicSession.create({
        data: { schoolId: session.schoolId, name: parsed.name, startDate: new Date(parsed.startDate), endDate: new Date(parsed.endDate), isCurrent: parsed.isCurrent }
      });
      await this.audit(session, AuditAction.CREATE, "AcademicSession", created.id, { name: created.name });
      return created;
    }
    if (!parsed.academicSessionId) throw new BadRequestException("Select the academic session for this term.");
    const startDate = new Date(parsed.startDate);
    const endDate = new Date(parsed.endDate);
    const breakStart = optionalDate(parsed.breakStart) ?? null;
    const breakEnd = optionalDate(parsed.breakEnd) ?? null;
    assertTermDates(startDate, endDate, breakStart, breakEnd);
    const siblings = await prisma.term.findMany({ where: { academicSessionId: parsed.academicSessionId }, select: { order: true } });
    const order = siblings.some((item) => item.order === parsed.order)
      ? Math.max(...siblings.map((item) => item.order)) + 1
      : parsed.order;
    if (parsed.isCurrent) await prisma.term.updateMany({ where: { schoolId: session.schoolId }, data: { isCurrent: false } });
    const created = await prisma.term.create({
      data: {
        schoolId: session.schoolId,
        academicSessionId: parsed.academicSessionId,
        name: parsed.name,
        order,
        startDate,
        endDate,
        isCurrent: parsed.isCurrent,
        breakStart,
        breakEnd,
        ...(parsed.schoolDays ? { schoolDays: parsed.schoolDays } : {}),
        activateOnOpen: parsed.isCurrent ? false : Boolean(parsed.activateOnOpen)
      }
    });
    await this.audit(session, AuditAction.CREATE, "Term", created.id, { name: created.name });
    return created;
  }

  private async updateSessionTerm(session: SessionPayload, id: string, body: Record<string, unknown>) {
    const parsed = sessionSchema.partial({ startDate: true, endDate: true, recordType: true, name: true }).parse(body);
    // The schema defaults `isCurrent` to false, which is right for a create and
    // wrong for a patch: a rename must not quietly deactivate the active term.
    const makeCurrent = "isCurrent" in body ? parsed.isCurrent : undefined;
    const term = await prisma.term.findFirst({ where: { id, schoolId: session.schoolId } });
    if (term) {
      const startDate = parsed.startDate ? new Date(parsed.startDate) : term.startDate;
      const endDate = parsed.endDate ? new Date(parsed.endDate) : term.endDate;
      const breakStart = parsed.breakStart === undefined ? term.breakStart : optionalDate(parsed.breakStart) ?? null;
      const breakEnd = parsed.breakEnd === undefined ? term.breakEnd : optionalDate(parsed.breakEnd) ?? null;
      assertTermDates(startDate, endDate, breakStart, breakEnd);
      if (makeCurrent) await prisma.term.updateMany({ where: { schoolId: session.schoolId }, data: { isCurrent: false } });
      const updated = await prisma.term.update({
        where: { id },
        data: {
          name: parsed.name,
          startDate: parsed.startDate ? startDate : undefined,
          endDate: parsed.endDate ? endDate : undefined,
          isCurrent: makeCurrent,
          breakStart: parsed.breakStart === undefined ? undefined : breakStart,
          breakEnd: parsed.breakEnd === undefined ? undefined : breakEnd,
          schoolDays: parsed.schoolDays,
          activateOnOpen: makeCurrent ? false : parsed.activateOnOpen
        }
      });
      await this.audit(session, AuditAction.UPDATE, "Term", id, { name: updated.name });
      return updated;
    }
    const academicSession = await prisma.academicSession.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!academicSession) throw new NotFoundException("Session or term not found.");
    if (makeCurrent) await prisma.academicSession.updateMany({ where: { schoolId: session.schoolId }, data: { isCurrent: false } });
    const updated = await prisma.academicSession.update({
      where: { id },
      data: {
        name: parsed.name,
        startDate: parsed.startDate ? new Date(parsed.startDate) : undefined,
        endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
        isCurrent: makeCurrent
      }
    });
    await this.audit(session, AuditAction.UPDATE, "AcademicSession", id, { name: updated.name });
    return updated;
  }

  /**
   * Make one term the active term. Every dated figure in the product — attendance
   * rates, collection, report cards — is computed against the active term, so
   * there is exactly one, and it moves the session it belongs to with it.
   */
  private async setActiveTerm(session: SessionPayload, body: Record<string, unknown>) {
    const termId = typeof body.termId === "string" ? body.termId : "";
    const term = await prisma.term.findFirst({ where: { id: termId, schoolId: session.schoolId } });
    if (!term) throw new BadRequestException("Choose the term that is to become active.");
    await prisma.$transaction([
      prisma.term.updateMany({ where: { schoolId: session.schoolId }, data: { isCurrent: false } }),
      prisma.term.update({ where: { id: term.id }, data: { isCurrent: true, activateOnOpen: false } }),
      prisma.academicSession.updateMany({ where: { schoolId: session.schoolId }, data: { isCurrent: false } }),
      prisma.academicSession.update({ where: { id: term.academicSessionId }, data: { isCurrent: true } })
    ]);
    await this.audit(session, AuditAction.UPDATE, "Term", term.id, {
      name: term.name,
      change: "made the active term",
      reason: typeof body.reason === "string" ? body.reason : undefined
    });
    return { id: term.id };
  }

  private async deleteSessionTerm(session: SessionPayload, id: string) {
    const term = await prisma.term.findFirst({ where: { id, schoolId: session.schoolId } });
    if (term) {
      const [attendance, fees, timetable] = await Promise.all([
        prisma.studentAttendance.count({ where: { termId: id } }),
        prisma.feeStructure.count({ where: { termId: id } }),
        prisma.timetableEntry.count({ where: { termId: id } })
      ]);
      if (attendance + fees + timetable > 0) throw new BadRequestException("This term is already in use and cannot be deleted.");
      await prisma.term.delete({ where: { id } });
      await this.audit(session, AuditAction.DELETE, "Term", id);
      return { id };
    }
    const academicSession = await prisma.academicSession.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!academicSession) throw new NotFoundException("Session or term not found.");
    const terms = await prisma.term.count({ where: { academicSessionId: id } });
    if (terms > 0) throw new BadRequestException("Delete terms under this session before deleting the session.");
    await prisma.academicSession.delete({ where: { id } });
    await this.audit(session, AuditAction.DELETE, "AcademicSession", id);
    return { id };
  }

  private async updateSchool(session: SessionPayload, body: Record<string, unknown>) {
    const parsed = schoolSchema.parse(body);

    // A PATCH patches. Previously every optional field was written on every
    // save, so a caller that sent only the name silently nulled the address,
    // the proprietor and everything else it had not mentioned — which is a
    // data-loss bug rather than a validation one. A field that is absent from
    // the payload is now left alone; an empty string still clears it, which is
    // how a form distinguishes "not editing this" from "remove this".
    const whenGiven = <T>(value: T | undefined, map: (input: T) => unknown) =>
      value === undefined ? undefined : map(value);

    if (parsed.stagesOperated) await this.assertStagesRemovable(session.schoolId, parsed.stagesOperated);

    const before = await prisma.school.findUnique({
      where: { id: session.schoolId },
      select: { primaryColor: true, secondaryColor: true, logoUrl: true, brandingAppliesTo: true }
    });

    const updated = await prisma.school.update({
      where: { id: session.schoolId },
      data: {
        name: parsed.name,
        schoolType: whenGiven(parsed.schoolType, (value) => value || null) as string | null | undefined,
        composition: whenGiven(parsed.composition, (value) => value || null) as string | null | undefined,
        attendancePattern: parsed.attendancePattern,
        stagesOperated: parsed.stagesOperated,
        foundedYear: parsed.foundedYear === undefined ? undefined : parsed.foundedYear === "" ? null : parsed.foundedYear,
        mainPhone: whenGiven(parsed.mainPhone, (value) => value || null) as string | null | undefined,
        postalCode: whenGiven(parsed.postalCode, (value) => value || null) as string | null | undefined,
        cacNumber: whenGiven(parsed.cacNumber, (value) => value || null) as string | null | undefined,
        ministryApprovalNumber: whenGiven(parsed.ministryApprovalNumber, (value) => value || null) as string | null | undefined,
        regulatingAuthority: whenGiven(parsed.regulatingAuthority, (value) => value || null) as string | null | undefined,
        approvalExpiresAt: optionalDate(parsed.approvalExpiresAt),
        showMottoUnderLogo: parsed.showMottoUnderLogo,
        brandingAppliesTo: parsed.brandingAppliesTo,
        logoUrl: whenGiven(parsed.logoUrl, (value) => value || null) as string | null | undefined,
        signatureUrl: whenGiven(parsed.signatureUrl, (value) => value || null) as string | null | undefined,
        stampUrl: whenGiven(parsed.stampUrl, (value) => value || null) as string | null | undefined,
        shortName: whenGiven(parsed.shortName, (value) => value || null) as string | null | undefined,
        motto: whenGiven(parsed.motto, (value) => value || null) as string | null | undefined,
        vision: whenGiven(parsed.vision, (value) => value || null) as string | null | undefined,
        schoolCode: whenGiven(parsed.schoolCode, (value) => value || null) as string | null | undefined,
        address: whenGiven(parsed.address, (value) => value || null) as string | null | undefined,
        city: whenGiven(parsed.city, (value) => value || null) as string | null | undefined,
        state: whenGiven(parsed.state, (value) => value || null) as string | null | undefined,
        country: whenGiven(parsed.country, (value) => value || "Nigeria") as string | undefined,
        ownerName: whenGiven(parsed.ownerName, (value) => value || null) as string | null | undefined,
        ownerEmail: whenGiven(parsed.ownerEmail, (value) => value || null) as string | null | undefined,
        ownerPhone: whenGiven(parsed.ownerPhone, (value) => value || null) as string | null | undefined,
        timezone: parsed.timezone,
        primaryColor: parsed.primaryColor || undefined,
        secondaryColor: parsed.secondaryColor || undefined
      }
    });
    await this.recordBrandingVersion(session, before, updated);
    await this.audit(session, AuditAction.SETTINGS_UPDATE, "School", session.schoolId, { name: updated.name });
    return updated;
  }

  /**
   * "Anything already printed keeps the branding it was printed with" is only
   * true if the branding it was printed with is still on record. So a change to
   * the colours, the logo or what they apply to is written as a new version, and
   * the one before it is kept, marked as superseded rather than overwritten.
   */
  private async recordBrandingVersion(
    session: SessionPayload,
    before: { primaryColor: string | null; secondaryColor: string | null; logoUrl: string | null; brandingAppliesTo: string[] } | null,
    after: { primaryColor: string | null; secondaryColor: string | null; logoUrl: string | null; brandingAppliesTo: string[] }
  ) {
    if (!before) return;
    const changed =
      before.primaryColor !== after.primaryColor ||
      before.secondaryColor !== after.secondaryColor ||
      before.logoUrl !== after.logoUrl ||
      before.brandingAppliesTo.join("|") !== after.brandingAppliesTo.join("|");
    if (!changed) return;
    await prisma.$transaction([
      prisma.brandingAsset.updateMany({ where: { schoolId: session.schoolId, status: "APPLIED" }, data: { status: "SUPERSEDED" } }),
      prisma.brandingAsset.create({
        data: {
          schoolId: session.schoolId,
          logoUrl: after.logoUrl,
          primaryColour: after.primaryColor ?? "#0D2315",
          secondaryColour: after.secondaryColor ?? "#12796A",
          appliedTo: after.brandingAppliesTo.length ? after.brandingAppliesTo.join(", ") : "report_card",
          status: "APPLIED",
          approvedById: session.userId,
          appliedAt: new Date()
        }
      })
    ]);
  }

  /** A school cannot stop operating a stage it still has children in. */
  private async assertStagesRemovable(schoolId: string, next: string[]) {
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { stagesOperated: true } });
    const removed = (school?.stagesOperated ?? []).filter((stage) => !next.includes(stage));
    const bySection: Record<string, SchoolSection> = {
      "Early Years": SchoolSection.CRECHE,
      Nursery: SchoolSection.NURSERY,
      Primary: SchoolSection.PRIMARY,
      "Junior Secondary": SchoolSection.JUNIOR_SECONDARY,
      "Senior Secondary": SchoolSection.SENIOR_SECONDARY
    };
    for (const stage of removed) {
      const section = bySection[stage];
      if (!section) continue;
      const enrolled = await prisma.student.count({
        where: { schoolId, status: "ACTIVE", currentClass: { classLevel: { schoolSection: section } } }
      });
      if (enrolled > 0) {
        throw new BadRequestException(
          `${stage} still has ${enrolled} enrolled student${enrolled === 1 ? "" : "s"}. Move or withdraw them before the school stops operating it.`
        );
      }
    }
  }

  private async createClassLevel(session: SessionPayload, body: Record<string, unknown>) {
    const parsed = classLevelSchema.parse(body);
    const created = await prisma.classLevel.create({ data: { schoolId: session.schoolId, ...parsed } });
    await this.audit(session, AuditAction.CREATE, "ClassLevel", created.id, { name: created.name });
    return created;
  }

  private async updateClassLevel(session: SessionPayload, id: string, body: Record<string, unknown>) {
    const parsed = classLevelSchema.partial().parse(body);
    const existing = await prisma.classLevel.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!existing) throw new NotFoundException("Class level not found.");
    const updated = await prisma.classLevel.update({ where: { id }, data: parsed });
    await this.audit(session, AuditAction.UPDATE, "ClassLevel", id, { name: updated.name });
    return updated;
  }

  private async deleteClassLevel(session: SessionPayload, id: string) {
    const count = await prisma.classRoom.count({ where: { schoolId: session.schoolId, classLevelId: id, deletedAt: null } });
    if (count > 0) throw new BadRequestException("This class level has classes and cannot be deleted.");
    await prisma.classLevel.delete({ where: { id } });
    await this.audit(session, AuditAction.DELETE, "ClassLevel", id);
    return { id };
  }

  private calendarData(parsed: z.infer<typeof calendarSchema>) {
    const startsAt = new Date(parsed.startsAt);
    const endsAt = parsed.endsAt ? new Date(parsed.endsAt) : startsAt;
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException("Those dates are not real dates.");
    }
    if (endsAt.getTime() < startsAt.getTime()) {
      throw new BadRequestException("An event cannot end before it starts.");
    }
    return { startsAt, endsAt };
  }

  /** The audience string the portals match against, written from who the event is visible to. */
  private audienceFor(parsed: { audience?: string; visibleTo?: string[] }) {
    return parsed.visibleTo?.length ? parsed.visibleTo.join(", ") : parsed.audience ?? "ALL";
  }

  private async createCalendarEvent(session: SessionPayload, body: Record<string, unknown>) {
    const parsed = calendarSchema.parse(body);
    const { startsAt, endsAt } = this.calendarData(parsed);
    const created = await prisma.calendarEvent.create({
      data: {
        schoolId: session.schoolId,
        createdById: session.userId,
        title: parsed.title,
        description: parsed.description || null,
        audience: this.audienceFor(parsed),
        startsAt,
        endsAt,
        type: parsed.type ?? "School event",
        location: parsed.location || null,
        startTime: parsed.allDay ? null : parsed.startTime || null,
        endTime: parsed.allDay ? null : parsed.endTime || null,
        allDay: Boolean(parsed.allDay),
        schoolClosed: Boolean(parsed.schoolClosed),
        visibleTo: parsed.visibleTo ?? [],
        reminder: parsed.reminder || null,
        secondReminder: parsed.secondReminder || null,
        reminderChannels: parsed.reminderChannels ?? []
      }
    });
    await this.audit(session, AuditAction.CREATE, "CalendarEvent", created.id, { title: created.title });
    return created;
  }

  private async updateCalendarEvent(session: SessionPayload, id: string, body: Record<string, unknown>) {
    const parsed = calendarSchema.partial().parse(body);
    const existing = await prisma.calendarEvent.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!existing) throw new NotFoundException("Calendar event not found.");
    const startsAt = parsed.startsAt ? new Date(parsed.startsAt) : existing.startsAt;
    const endsAt = parsed.endsAt === undefined ? existing.endsAt : parsed.endsAt ? new Date(parsed.endsAt) : startsAt;
    if (endsAt.getTime() < startsAt.getTime()) throw new BadRequestException("An event cannot end before it starts.");
    const allDay = parsed.allDay ?? existing.allDay;
    const updated = await prisma.calendarEvent.update({
      where: { id },
      data: {
        title: parsed.title,
        description: parsed.description === undefined ? undefined : parsed.description || null,
        audience: parsed.visibleTo ? this.audienceFor(parsed) : parsed.audience,
        startsAt,
        endsAt,
        type: parsed.type,
        location: parsed.location === undefined ? undefined : parsed.location || null,
        startTime: allDay ? null : parsed.startTime === undefined ? undefined : parsed.startTime || null,
        endTime: allDay ? null : parsed.endTime === undefined ? undefined : parsed.endTime || null,
        allDay: parsed.allDay,
        schoolClosed: parsed.schoolClosed,
        visibleTo: parsed.visibleTo,
        reminder: parsed.reminder === undefined ? undefined : parsed.reminder || null,
        secondReminder: parsed.secondReminder === undefined ? undefined : parsed.secondReminder || null,
        reminderChannels: parsed.reminderChannels
      }
    });
    await this.audit(session, AuditAction.UPDATE, "CalendarEvent", id, { title: updated.title });
    return updated;
  }

  private async deleteCalendarEvent(session: SessionPayload, id: string) {
    const existing = await prisma.calendarEvent.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!existing) throw new NotFoundException("Calendar event not found.");
    await prisma.calendarEvent.delete({ where: { id } });
    await this.audit(session, AuditAction.DELETE, "CalendarEvent", id);
    return { id };
  }

  private async createSubject(session: SessionPayload, body: Record<string, unknown>) {
    const parsed = subjectSchema.parse(body);
    const created = await prisma.subject.create({ data: { schoolId: session.schoolId, ...parsed, departmentId: parsed.departmentId || null, trackSpecific: parsed.trackSpecific || null } });
    await this.audit(session, AuditAction.CREATE, "Subject", created.id, { code: created.code });
    return created;
  }

  private async updateSubject(session: SessionPayload, id: string, body: Record<string, unknown>) {
    const parsed = subjectSchema.partial().parse(body);
    const existing = await prisma.subject.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!existing) throw new NotFoundException("Subject not found.");
    const updated = await prisma.subject.update({ where: { id }, data: { ...parsed, departmentId: parsed.departmentId || undefined, trackSpecific: parsed.trackSpecific || undefined } });
    await this.audit(session, AuditAction.UPDATE, "Subject", id, { code: updated.code });
    return updated;
  }

  private async deleteSubject(session: SessionPayload, id: string) {
    const [classSubjects, scores, timetable] = await Promise.all([
      prisma.classSubject.count({ where: { schoolId: session.schoolId, subjectId: id } }),
      prisma.scoreEntry.count({ where: { schoolId: session.schoolId, subjectId: id } }),
      prisma.timetableEntry.count({ where: { schoolId: session.schoolId, subjectId: id } })
    ]);
    if (classSubjects + scores + timetable > 0) throw new BadRequestException("This subject is in use and cannot be deleted.");
    await prisma.subject.delete({ where: { id } });
    await this.audit(session, AuditAction.DELETE, "Subject", id);
    return { id };
  }

  private async createGeneric(session: SessionPayload, resource: string, body: Record<string, unknown>) {
    const parsed = genericSchema.parse(body);
    const created = await prisma.configurationItem.create({
      data: {
        schoolId: session.schoolId,
        resource,
        name: parsed.name,
        code: parsed.code || null,
        description: parsed.description || null,
        status: parsed.status,
        displayOrder: parsed.displayOrder,
        isDefault: parsed.isDefault,
        data: asJson(parsed.data)
      }
    });
    if (parsed.isDefault) await this.clearOtherDefaults(session.schoolId, resource, created.id);
    await this.audit(session, AuditAction.CREATE, "ConfigurationItem", created.id, { resource, name: created.name });
    return created;
  }

  private async updateGeneric(session: SessionPayload, resource: string, id: string, body: Record<string, unknown>) {
    const parsed = genericSchema.partial().parse(body);
    const existing = await prisma.configurationItem.findFirst({ where: { schoolId: session.schoolId, resource, id, deletedAt: null } });
    if (!existing) throw new NotFoundException("Configuration item not found.");
    const updated = await prisma.configurationItem.update({
      where: { id },
      data: {
        name: parsed.name,
        code: parsed.code === "" ? null : parsed.code,
        description: parsed.description,
        status: parsed.status,
        displayOrder: parsed.displayOrder,
        isDefault: parsed.isDefault,
        data: asJson(parsed.data)
      }
    });
    if (updated.isDefault) await this.clearOtherDefaults(session.schoolId, resource, id);
    await this.audit(session, AuditAction.UPDATE, "ConfigurationItem", id, { resource, name: updated.name });
    return updated;
  }

  private async clearOtherDefaults(schoolId: string, resource: string, id: string) {
    await prisma.configurationItem.updateMany({ where: { schoolId, resource, id: { not: id } }, data: { isDefault: false } });
  }

  private async deleteGeneric(session: SessionPayload, resource: string, id: string) {
    const existing = await prisma.configurationItem.findFirst({ where: { schoolId: session.schoolId, resource, id, deletedAt: null } });
    if (!existing) throw new NotFoundException("Configuration item not found.");
    await prisma.configurationItem.update({ where: { id }, data: { status: "ARCHIVED", deletedAt: new Date() } });
    await this.audit(session, AuditAction.DELETE, "ConfigurationItem", id, { resource, name: existing.name });
    return { id };
  }

  /* ───────────── assessment windows ───────────── */

  private async assessmentWindows(session: SessionPayload, termId?: string) {
    const rows = await prisma.assessmentWindow.findMany({
      where: { schoolId: session.schoolId, ...(termId ? { termId } : {}) },
      include: { component: { select: { id: true, name: true, code: true, maxScore: true, weight: true } }, term: { select: { id: true, name: true } } },
      orderBy: [{ opensAt: "asc" }]
    });
    const day = (value: Date) => value.toISOString().slice(0, 10);
    return {
      mode: "table",
      records: rows.map((row) => ({
        id: row.id,
        termId: row.termId,
        termName: row.term.name,
        componentId: row.componentId,
        componentName: row.component.name,
        componentCode: row.component.code,
        maxScore: row.component.maxScore,
        weight: row.component.weight,
        opensAt: day(row.opensAt),
        closesAt: day(row.closesAt),
        releaseAt: day(row.releaseAt),
        appliesTo: row.appliesTo,
        remindTeachers: row.remindTeachers,
        allowLateEntry: row.allowLateEntry,
        reopenedAt: row.reopenedAt ? row.reopenedAt.toISOString() : null,
        reopenedReason: row.reopenedReason
      }))
    };
  }

  private windowDates(parsed: { opensAt: string; closesAt: string; releaseAt: string }) {
    const opensAt = new Date(parsed.opensAt);
    const closesAt = new Date(parsed.closesAt);
    const releaseAt = new Date(parsed.releaseAt);
    if ([opensAt, closesAt, releaseAt].some((date) => Number.isNaN(date.getTime()))) {
      throw new BadRequestException("Those dates are not real dates.");
    }
    if (closesAt.getTime() < opensAt.getTime()) throw new BadRequestException("A window cannot close before it opens.");
    if (releaseAt.getTime() < closesAt.getTime()) {
      throw new BadRequestException("A result cannot reach a guardian before the window that produces it has closed.");
    }
    return { opensAt, closesAt, releaseAt };
  }

  /** Weight and maximum live on the component, so editing them from the window edits the component. */
  private async syncComponent(schoolId: string, componentId: string, parsed: { maxScore?: number; weight?: number }) {
    if (parsed.maxScore === undefined && parsed.weight === undefined) return;
    await prisma.assessmentComponent.updateMany({
      where: { id: componentId, schoolId },
      data: { maxScore: parsed.maxScore, weight: parsed.weight }
    });
  }

  private async createAssessmentWindow(session: SessionPayload, body: Record<string, unknown>) {
    const parsed = assessmentWindowSchema.parse(body);
    const dates = this.windowDates(parsed);
    const [term, component] = await Promise.all([
      prisma.term.findFirst({ where: { id: parsed.termId, schoolId: session.schoolId } }),
      prisma.assessmentComponent.findFirst({ where: { id: parsed.componentId, schoolId: session.schoolId } })
    ]);
    if (!term) throw new NotFoundException("That term does not exist.");
    if (!component) throw new NotFoundException("That assessment component does not exist.");
    const existing = await prisma.assessmentWindow.findUnique({ where: { termId_componentId: { termId: term.id, componentId: component.id } } });
    if (existing) {
      throw new BadRequestException(`${component.name} already has a window in ${term.name}. Edit that one instead of making a second.`);
    }
    await this.syncComponent(session.schoolId, component.id, parsed);
    const created = await prisma.assessmentWindow.create({
      data: {
        schoolId: session.schoolId,
        termId: term.id,
        componentId: component.id,
        ...dates,
        appliesTo: parsed.appliesTo ?? "Every class",
        remindTeachers: parsed.remindTeachers ?? true,
        allowLateEntry: parsed.allowLateEntry ?? false,
        createdById: session.userId
      }
    });
    await this.audit(session, AuditAction.CREATE, "AssessmentWindow", created.id, { component: component.name, term: term.name });
    return created;
  }

  private async updateAssessmentWindow(session: SessionPayload, id: string, body: Record<string, unknown>) {
    const existing = await prisma.assessmentWindow.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!existing) throw new NotFoundException("Assessment window not found.");
    const parsed = assessmentWindowSchema.partial().parse(body);
    const next = this.windowDates({
      opensAt: parsed.opensAt ?? existing.opensAt.toISOString(),
      closesAt: parsed.closesAt ?? existing.closesAt.toISOString(),
      releaseAt: parsed.releaseAt ?? existing.releaseAt.toISOString()
    });
    const reopening = Boolean(parsed.reopenReason) && next.closesAt.getTime() > existing.closesAt.getTime() && existing.closesAt.getTime() < Date.now();
    await this.syncComponent(session.schoolId, existing.componentId, parsed);
    const updated = await prisma.assessmentWindow.update({
      where: { id },
      data: {
        ...next,
        appliesTo: parsed.appliesTo,
        remindTeachers: parsed.remindTeachers,
        allowLateEntry: parsed.allowLateEntry,
        ...(reopening ? { reopenedAt: new Date(), reopenedReason: parsed.reopenReason } : {})
      }
    });
    await this.audit(session, AuditAction.UPDATE, "AssessmentWindow", id, { reopened: reopening, reason: parsed.reopenReason });
    return updated;
  }

  private async deleteAssessmentWindow(session: SessionPayload, id: string) {
    const existing = await prisma.assessmentWindow.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!existing) throw new NotFoundException("Assessment window not found.");
    await prisma.assessmentWindow.delete({ where: { id } });
    await this.audit(session, AuditAction.DELETE, "AssessmentWindow", id);
    return { id };
  }

  /* ───────────── policies ───────────── */

  /**
   * Save one policy by its code, creating the record the first time. A policy is
   * either at the product's default or set by this school; there is no third state
   * to model, so the caller never has to know which it is.
   */
  private async savePolicy(session: SessionPayload, code: string, body: Record<string, unknown>) {
    const definition = policyDefinition(code);
    if (!definition) throw new NotFoundException("There is no such policy.");
    const problem = validatePolicyValues(definition, body);
    if (problem) throw new BadRequestException(problem);
    const values = Object.fromEntries(definition.fields.map((field) => [field.key, body[field.key]]));
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const existing = await prisma.configurationItem.findFirst({
      where: { schoolId: session.schoolId, resource: "school-policies", code, deletedAt: null }
    });
    const data = { values, ...(reason ? { lastReason: reason } : {}), changedAt: new Date().toISOString() } as Prisma.InputJsonObject;
    const saved = existing
      ? await prisma.configurationItem.update({ where: { id: existing.id }, data: { data, status: "ACTIVE" } })
      : await prisma.configurationItem.create({
          data: {
            schoolId: session.schoolId,
            resource: "school-policies",
            code,
            name: definition.label,
            description: definition.changes,
            data,
            displayOrder: 0
          }
        });
    await this.audit(session, AuditAction.SETTINGS_UPDATE, "ConfigurationItem", saved.id, {
      resource: "school-policies",
      policy: code,
      values: values as Prisma.InputJsonObject,
      reason: reason || undefined,
      previous: (existing?.data ?? null) as Prisma.InputJsonValue
    });
    return saved;
  }

  /** Branding versions, so a card's history is readable rather than asserted. */
  async brandingVersions(session: SessionPayload) {
    const rows = await prisma.brandingAsset.findMany({
      where: { schoolId: session.schoolId },
      orderBy: { createdAt: "desc" },
      take: 20
    });
    return rows.map((row) => ({
      id: row.id,
      logoUrl: row.logoUrl,
      primaryColour: row.primaryColour,
      secondaryColour: row.secondaryColour,
      appliedTo: row.appliedTo,
      status: row.status,
      createdAt: row.createdAt.toISOString()
    }));
  }

}
