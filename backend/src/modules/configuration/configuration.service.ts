import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, SchoolCategory, SchoolSection } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { RolesManagementService } from "../roles-management/roles-management.service";

type ConfigGroup = "General" | "Finance" | "Academics" | "Others";
type ConfigAction = "view" | "create" | "update" | "delete" | "manage" | "export";

type ResourceDefinition = {
  key: string;
  label: string;
  group: ConfigGroup;
  description: string;
  mode: "table" | "settings" | "readonly";
  backend: "sessions_terms" | "school" | "class_levels" | "calendar" | "subjects" | "login_history" | "generic";
  actions: ConfigAction[];
  fields: Array<{ name: string; label: string; type: "text" | "number" | "date" | "textarea" | "select"; required?: boolean; options?: Array<{ label: string; value: string }> }>;
};

const resourceDefinitions: ResourceDefinition[] = [
  { key: "sessions-terms", label: "Sessions & Terms", group: "General", description: "Academic sessions, terms, and current period controls.", mode: "table", backend: "sessions_terms", actions: ["view", "create", "update", "delete", "manage"], fields: [] },
  { key: "school-information", label: "School Information", group: "General", description: "Registered school identity, contacts, branding, and locale.", mode: "settings", backend: "school", actions: ["view", "update"], fields: [] },
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

const sessionSchema = z.object({
  recordType: z.enum(["session", "term"]),
  name: z.string().trim().min(2),
  academicSessionId: z.string().optional().or(z.literal("")),
  startDate: z.string().min(4),
  endDate: z.string().min(4),
  order: z.coerce.number().int().min(1).default(1),
  isCurrent: z.coerce.boolean().default(false)
});

const schoolSchema = z.object({
  name: z.string().trim().min(2),
  schoolCode: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().optional().or(z.literal("")),
  state: z.string().trim().optional().or(z.literal("")),
  country: z.string().trim().optional().or(z.literal("")),
  ownerName: z.string().trim().optional().or(z.literal("")),
  ownerEmail: z.string().trim().email().optional().or(z.literal("")),
  ownerPhone: z.string().trim().optional().or(z.literal("")),
  timezone: z.string().trim().default("Africa/Lagos"),
  primaryColor: z.string().trim().optional().or(z.literal("")),
  secondaryColor: z.string().trim().optional().or(z.literal(""))
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
  endsAt: z.string().min(4)
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

function permissionKey(resource: string, action: ConfigAction) {
  const key = resource.replace(/-/g, "_");
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
    if (definition.backend === "subjects") return this.subjects(session, search);
    if (definition.backend === "login_history") return this.loginHistory(session, query);
    return this.genericItems(session, resourceKey, search);
  }

  private async sessionsTerms(session: SessionPayload) {
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
          isCurrent: term.isCurrent
        }))
      }))
    };
  }

  private async schoolInformation(session: SessionPayload) {
    const school = await prisma.school.findUnique({ where: { id: session.schoolId } });
    return { mode: "settings", record: school };
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
    return this.createGeneric(session, resource, body);
  }

  async updateResource(session: SessionPayload, resource: string, id: string, body: Record<string, unknown>) {
    this.definition(resource);
    await this.assertPermission(session, resource, "update");
    if (resource === "school-information") return this.updateSchool(session, body);
    if (resource === "sessions-terms") return this.updateSessionTerm(session, id, body);
    if (resource === "class-levels") return this.updateClassLevel(session, id, body);
    if (resource === "school-calendar") return this.updateCalendarEvent(session, id, body);
    if (resource === "subjects") return this.updateSubject(session, id, body);
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
    if (parsed.isCurrent) await prisma.term.updateMany({ where: { schoolId: session.schoolId }, data: { isCurrent: false } });
    const created = await prisma.term.create({
      data: {
        schoolId: session.schoolId,
        academicSessionId: parsed.academicSessionId,
        name: parsed.name,
        order: parsed.order,
        startDate: new Date(parsed.startDate),
        endDate: new Date(parsed.endDate),
        isCurrent: parsed.isCurrent
      }
    });
    await this.audit(session, AuditAction.CREATE, "Term", created.id, { name: created.name });
    return created;
  }

  private async updateSessionTerm(session: SessionPayload, id: string, body: Record<string, unknown>) {
    const parsed = sessionSchema.partial({ startDate: true, endDate: true, recordType: true, name: true }).parse(body);
    const term = await prisma.term.findFirst({ where: { id, schoolId: session.schoolId } });
    if (term) {
      if (parsed.isCurrent) await prisma.term.updateMany({ where: { schoolId: session.schoolId }, data: { isCurrent: false } });
      const updated = await prisma.term.update({
        where: { id },
        data: {
          name: parsed.name,
          order: parsed.order,
          startDate: parsed.startDate ? new Date(parsed.startDate) : undefined,
          endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
          isCurrent: parsed.isCurrent
        }
      });
      await this.audit(session, AuditAction.UPDATE, "Term", id, { name: updated.name });
      return updated;
    }
    const academicSession = await prisma.academicSession.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!academicSession) throw new NotFoundException("Session or term not found.");
    if (parsed.isCurrent) await prisma.academicSession.updateMany({ where: { schoolId: session.schoolId }, data: { isCurrent: false } });
    const updated = await prisma.academicSession.update({
      where: { id },
      data: {
        name: parsed.name,
        startDate: parsed.startDate ? new Date(parsed.startDate) : undefined,
        endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
        isCurrent: parsed.isCurrent
      }
    });
    await this.audit(session, AuditAction.UPDATE, "AcademicSession", id, { name: updated.name });
    return updated;
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
    const updated = await prisma.school.update({
      where: { id: session.schoolId },
      data: {
        name: parsed.name,
        schoolCode: parsed.schoolCode || null,
        address: parsed.address || null,
        city: parsed.city || null,
        state: parsed.state || null,
        country: parsed.country || "Nigeria",
        ownerName: parsed.ownerName || null,
        ownerEmail: parsed.ownerEmail || null,
        ownerPhone: parsed.ownerPhone || null,
        timezone: parsed.timezone,
        primaryColor: parsed.primaryColor || undefined,
        secondaryColor: parsed.secondaryColor || undefined
      }
    });
    await this.audit(session, AuditAction.SETTINGS_UPDATE, "School", session.schoolId, { name: updated.name });
    return updated;
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

  private async createCalendarEvent(session: SessionPayload, body: Record<string, unknown>) {
    const parsed = calendarSchema.parse(body);
    const created = await prisma.calendarEvent.create({
      data: { schoolId: session.schoolId, createdById: session.userId, title: parsed.title, description: parsed.description || null, audience: parsed.audience, startsAt: new Date(parsed.startsAt), endsAt: new Date(parsed.endsAt) }
    });
    await this.audit(session, AuditAction.CREATE, "CalendarEvent", created.id, { title: created.title });
    return created;
  }

  private async updateCalendarEvent(session: SessionPayload, id: string, body: Record<string, unknown>) {
    const parsed = calendarSchema.partial().parse(body);
    const existing = await prisma.calendarEvent.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!existing) throw new NotFoundException("Calendar event not found.");
    const updated = await prisma.calendarEvent.update({
      where: { id },
      data: { title: parsed.title, description: parsed.description, audience: parsed.audience, startsAt: parsed.startsAt ? new Date(parsed.startsAt) : undefined, endsAt: parsed.endsAt ? new Date(parsed.endsAt) : undefined }
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
}
