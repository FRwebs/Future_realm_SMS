import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit, Logger } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { sendEmail } from "../../../../src/lib/integrations/mailer";

const DAY = 86_400_000;
const PLATFORM_ROLES = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER", "SUPER_ADMIN"] as const;
const OWNER_ROLES = ["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL"] as const;
/** The NDPA's window for telling the regulator about a breach that puts people at risk. */
const REGULATOR_WINDOW_HOURS = 72;
const EXPORT_ROW_CAP = 20_000;

/** What the platform owes a regulator. Seeded once; every row is then edited by the people who own it. */
const OBLIGATIONS = [
  { code: "REGISTRATION", title: "Registration as controller and processor of major importance", cadence: "At launch, then per cycle", ownerRole: "Data Protection Officer" },
  { code: "ANNUAL_AUDIT", title: "Annual compliance audit filing", cadence: "Annual", ownerRole: "DPO with Finance" },
  { code: "DPO", title: "DPO appointed, details published and registered", cadence: "At launch; on change", ownerRole: "Super Admin" },
  { code: "DPIA", title: "Data protection impact assessment", cadence: "Before launch; on new processing", ownerRole: "DPO with CTO" },
  { code: "ROPA", title: "Record of processing activities", cadence: "Continuous", ownerRole: "Data Protection Officer" },
  { code: "BREACH", title: "Breach notification", cadence: "Within the applicable window", ownerRole: "CTO and DPO" },
  { code: "GRIEVANCE", title: "Grievance mechanism", cadence: "Continuous", ownerRole: "Support Lead with DPO" },
  { code: "CROSS_BORDER", title: "Cross-border transfer record", cadence: "On any provider or region change", ownerRole: "CTO with DPO" },
  { code: "DPA_SCHOOLS", title: "Data processing agreement with every school", cadence: "At onboarding; on version change", ownerRole: "Legal with Onboarding" }
] as const;

/** How long each class of data is kept. `enforced` ones are deleted by this service on a schedule; the rest are policy a person acts on. */
const RETENTION_DEFAULTS = [
  { dataClass: "Sign-in records", retentionDays: 365, basis: "Security monitoring and account protection", trigger: "Date of the sign-in" },
  { dataClass: "API request log", retentionDays: 90, basis: "Reliability and capacity monitoring", trigger: "Date of the request" },
  { dataClass: "Page-load telemetry", retentionDays: 90, basis: "Performance monitoring", trigger: "Date of the page load" },
  { dataClass: "Audit log", retentionDays: 2555, basis: "Accountability — who did what, kept seven years", trigger: "Date of the event" },
  { dataClass: "Payments and invoices", retentionDays: 2190, basis: "Financial record-keeping, six years", trigger: "Date of the transaction" },
  { dataClass: "Messages sent to families", retentionDays: 730, basis: "Proof of what a school told a family", trigger: "Date sent" },
  { dataClass: "School data after closure", retentionDays: 90, basis: "Contract — time to retrieve an export before permanent deletion", trigger: "Closure request" }
] as const;

const ENFORCERS: Record<string, { label: string; count: (before: Date) => Promise<number>; oldest: () => Promise<Date | null>; purge: (before: Date) => Promise<number> }> = {
  "Sign-in records": {
    label: "Deleted automatically",
    count: (before) => prisma.loginAttempt.count({ where: { createdAt: { lt: before } } }),
    oldest: async () => (await prisma.loginAttempt.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }))?.createdAt ?? null,
    purge: async (before) => (await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: before } } })).count
  },
  "API request log": {
    label: "Deleted automatically",
    count: (before) => prisma.apiUsageLog.count({ where: { createdAt: { lt: before } } }),
    oldest: async () => (await prisma.apiUsageLog.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }))?.createdAt ?? null,
    purge: async (before) => (await prisma.apiUsageLog.deleteMany({ where: { createdAt: { lt: before } } })).count
  },
  "Page-load telemetry": {
    label: "Deleted automatically",
    count: (before) => prisma.pageLoadSample.count({ where: { createdAt: { lt: before } } }),
    oldest: async () => (await prisma.pageLoadSample.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }))?.createdAt ?? null,
    purge: async (before) => (await prisma.pageLoadSample.deleteMany({ where: { createdAt: { lt: before } } })).count
  }
};

const obligationSchema = z.object({
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLIANT"]).optional(),
  dueAt: z.preprocess((v) => (v === "" || v === null ? null : v), z.coerce.date().nullable()).optional(),
  lastDoneAt: z.preprocess((v) => (v === "" || v === null ? null : v), z.coerce.date().nullable()).optional(),
  reference: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional()
});
const retentionSchema = z.object({ retentionDays: z.coerce.number().int().min(0).max(36_500), basis: z.string().trim().min(3).max(300).optional(), trigger: z.string().trim().min(3).max(200).optional() });
const dpaSchema = z.object({
  version: z.string().trim().min(1).max(20),
  summary: z.string().trim().max(1000).optional(),
  effectiveFrom: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.date().optional()),
  notifySchools: z.preprocess((v) => v === true || v === "true", z.boolean()).default(true)
});
const containSchema = z.object({
  scope: z.enum(["AFFECTED_SCHOOLS", "ALL_SCHOOL_USERS", "NONE"]),
  note: z.string().trim().min(5).max(2000)
});
const assessSchema = z.object({
  assessment: z.string().trim().min(10).max(4000),
  affectedSchoolIds: z.preprocess((v) => (Array.isArray(v) ? v : typeof v === "string" && v ? v.split(",") : []), z.array(z.string())).default([])
});
const regulatorSchema = z.object({
  reference: z.string().trim().min(2).max(120),
  notifiedAt: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.date().optional()),
  notes: z.string().trim().max(1000).optional()
});
const schoolsNoticeSchema = z.object({ message: z.string().trim().min(20).max(3000) });
const exportSchema = z.object({
  reason: z.string().trim().min(8, "Say why this copy is needed (at least a few words)."),
  dateFrom: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.date().optional()),
  dateTo: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.date().optional()),
  schoolId: z.string().trim().optional().transform((v) => v || undefined),
  action: z.string().trim().optional().transform((v) => v || undefined),
  actorId: z.string().trim().optional().transform((v) => v || undefined),
  entityType: z.string().trim().optional().transform((v) => v || undefined),
  origin: z.enum(["BACK_OFFICE", "SCHOOL", "SYSTEM", ""]).optional().transform((v) => v || undefined),
  format: z.enum(["CSV", "JSON"]).default("CSV")
});

const iso = (date: Date | null | undefined) => date?.toISOString() ?? null;
const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

@Injectable()
export class ComplianceService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("Retention");
  private timer: NodeJS.Timeout | null = null;

  onModuleInit() {
    if (process.env.RETENTION_SCHEDULER === "off") return;
    // Every six hours is plenty for a rule measured in months.
    this.timer = setInterval(() => void this.enforceRetention(null).catch((error) => this.log.error(error)), 6 * 3_600_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async audit(session: SessionPayload | null, action: AuditAction, entityType: string, entityId: string, metadata: Prisma.InputJsonValue, schoolId?: string | null) {
    const actor = session ? await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true } }) : null;
    await prisma.auditLog.create({ data: { schoolId: schoolId ?? null, actorId: actor?.id ?? null, action, entityType, entityId, metadata } });
  }

  /* ───────────────────────── seeds ───────────────────────── */

  private async seed() {
    const [obligations, rules, versions] = await Promise.all([prisma.complianceObligation.count(), prisma.retentionRule.count(), prisma.dpaVersion.count()]);
    if (!obligations) await prisma.complianceObligation.createMany({ data: OBLIGATIONS.map((row) => ({ ...row })), skipDuplicates: true });
    if (!rules) await prisma.retentionRule.createMany({ data: RETENTION_DEFAULTS.map((row) => ({ ...row })), skipDuplicates: true });
    if (!versions) await prisma.dpaVersion.create({ data: { version: "4.0", effectiveFrom: new Date("2026-01-01T00:00:00Z"), summary: "The agreement every school has been offered since launch.", isCurrent: true } });
  }

  /* ───────────────────────── the compliance picture ───────────────────────── */

  async overview() {
    await this.seed();
    const now = new Date();
    const [students, staffUsers] = await Promise.all([prisma.student.count({ where: { NOT: { admissionNumber: { startsWith: "SMP-" } }, school: { deletedAt: null } } }), prisma.user.count({ where: { deletedAt: null, isActive: true, role: { notIn: [...PLATFORM_ROLES] } } })]);
    const [obligations, versions, schools, guardianCounts, coreCounts, grievances, incidents, rules, closures, erasures, lockouts, ipRules] = await Promise.all([
      prisma.complianceObligation.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.dpaVersion.findMany({ orderBy: { effectiveFrom: "desc" } }),
      prisma.school.findMany({ where: { deletedAt: null, status: { not: "DELETED" } }, select: { id: true, name: true, dpaStatus: true, dpaVersion: true, dpaAcceptedAt: true } }),
      prisma.guardian.groupBy({ by: ["schoolId"], _count: { _all: true } }),
      prisma.familyConsent.groupBy({ by: ["schoolId"], where: { typeCode: "core", status: "GIVEN" }, _count: { _all: true } }),
      prisma.dataPrivacyRequest.groupBy({ by: ["status"], where: { type: "GRIEVANCE" }, _count: { _all: true } }),
      prisma.securityIncident.findMany({ select: { severity: true, status: true, detectedAt: true, regulatorNotifiedAt: true } }),
      prisma.retentionRule.findMany({ orderBy: { dataClass: "asc" } }),
      prisma.accountClosureRequest.findMany({ include: { school: { select: { name: true, status: true, deletedAt: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.dataPrivacyRequest.findMany({ where: { type: "ERASURE" }, include: { school: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.securityIncident.count({ where: { type: "BRUTE_FORCE_LOCKOUT", detectedAt: { gte: new Date(now.getTime() - 7 * DAY) } } }),
      prisma.ipAccessRule.findMany({ select: { type: true } })
    ]);

    // Obligations. "Overdue" is worked out here from the date, never stored.
    const grievanceOpen = grievances.filter((row) => row.status === "OPEN" || row.status === "IN_REVIEW").reduce((sum, row) => sum + row._count._all, 0);
    const grievanceTotal = grievances.reduce((sum, row) => sum + row._count._all, 0);
    const current = versions.find((version) => version.isCurrent) ?? null;
    const onCurrent = schools.filter((school) => current && school.dpaStatus === "SIGNED" && school.dpaVersion === current.version).length;
    const breachNotified = incidents.filter((row) => row.regulatorNotifiedAt).length;
    const evidence: Record<string, string> = {
      BREACH: `${incidents.length} incident${incidents.length === 1 ? "" : "s"} logged · ${breachNotified} reported to the regulator`,
      GRIEVANCE: `${grievanceTotal} logged · ${grievanceOpen} open`,
      DPA_SCHOOLS: `${onCurrent} of ${schools.length} schools on version ${current?.version ?? "—"}`
    };
    const obligationRows = obligations.map((row) => {
      const overdue = Boolean(row.dueAt && row.dueAt < now);
      return {
        id: row.id, code: row.code, title: row.title, cadence: row.cadence, ownerRole: row.ownerRole, status: row.status, state: overdue ? "OVERDUE" : row.status,
        dueAt: iso(row.dueAt), lastDoneAt: iso(row.lastDoneAt), reference: row.reference, notes: row.notes, evidence: evidence[row.code] ?? null,
        daysToDue: row.dueAt ? Math.ceil((row.dueAt.getTime() - now.getTime()) / DAY) : null
      };
    });
    const dated = obligationRows.filter((row) => row.dueAt && row.state !== "COMPLIANT").sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime());
    const nextFiling = dated[0] ? { title: dated[0].title, dueAt: dated[0].dueAt, days: dated[0].daysToDue } : null;

    // DPA coverage: what each school accepted, set against the version in force.
    const coverage = [
      ...(current ? [{ version: current.version, label: "Current", schools: schools.filter((s) => s.dpaStatus === "SIGNED" && s.dpaVersion === current.version).map((s) => s.name) }] : []),
      ...Array.from(new Set(schools.filter((s) => s.dpaStatus === "SIGNED" && s.dpaVersion && s.dpaVersion !== current?.version).map((s) => s.dpaVersion!))).map((version) => ({ version, label: "Outdated", schools: schools.filter((s) => s.dpaStatus === "SIGNED" && s.dpaVersion === version).map((s) => s.name) })),
      { version: "Version not recorded", label: "Signed before versions were kept", schools: schools.filter((s) => s.dpaStatus === "SIGNED" && !s.dpaVersion).map((s) => s.name) },
      { version: "Not accepted", label: "No agreement on file", schools: schools.filter((s) => s.dpaStatus !== "SIGNED").map((s) => s.name) }
    ].filter((row) => row.schools.length || row.label === "Current");

    // Consent: families with the core record-processing consent given, per school.
    const guardiansBySchool = new Map(guardianCounts.map((row) => [row.schoolId, row._count._all]));
    const coreBySchool = new Map(coreCounts.map((row) => [row.schoolId, row._count._all]));
    const consent = schools
      .filter((school) => (guardiansBySchool.get(school.id) ?? 0) > 0)
      .map((school) => {
        const total = guardiansBySchool.get(school.id) ?? 0;
        const have = coreBySchool.get(school.id) ?? 0;
        const pct = Math.round((have / total) * 100);
        return { school: school.name, guardians: total, consented: have, pct, state: pct >= 90 ? "COMPLIANT" : pct >= 60 ? "PARTIAL" : "GAP" };
      })
      .sort((a, b) => a.pct - b.pct);

    // Retention rules, with what is waiting to be deleted under each.
    const ruleRows = await Promise.all(
      rules.map(async (rule) => {
        const enforcer = ENFORCERS[rule.dataClass];
        const cutoff = new Date(now.getTime() - rule.retentionDays * DAY);
        const waiting = enforcer && rule.retentionDays > 0 ? await enforcer.count(cutoff) : null;
        const oldest = enforcer ? await enforcer.oldest() : null;
        return {
          id: rule.id, dataClass: rule.dataClass, retentionDays: rule.retentionDays, basis: rule.basis, trigger: rule.trigger,
          enforcement: enforcer ? enforcer.label : rule.dataClass === "School data after closure" ? "Run by a Super Admin after the closure clock ends" : "Policy — kept until a person deletes it",
          enforced: Boolean(enforcer), waiting, oldest: iso(oldest),
          nextDue: oldest && rule.retentionDays > 0 ? iso(new Date(oldest.getTime() + rule.retentionDays * DAY)) : null
        };
      })
    );
    const closureRule = rules.find((rule) => rule.dataClass === "School data after closure");

    // The deletion clocks that are running: closures a school asked for, and erasure requests.
    const deletionSchedule = [
      ...closures.map((row) => {
        const days = closureRule?.retentionDays ?? row.retentionDays;
        const due = new Date(row.createdAt.getTime() + days * DAY);
        const gone = row.school.status === "DELETED" || Boolean(row.school.deletedAt);
        return { id: row.id, subject: row.school.name, dataClass: "School data after closure", started: row.createdAt.toISOString(), due: due.toISOString(), state: gone ? "EXECUTED" : due < now ? "DUE" : "SCHEDULED", evidence: gone ? "School removed from the platform" : null };
      }),
      ...erasures.map((row) => {
        const due = new Date(row.createdAt.getTime() + 30 * DAY);
        return { id: row.id, subject: `${row.school?.name ?? "Platform"} — ${row.subject}`, dataClass: "Erasure request", started: row.createdAt.toISOString(), due: due.toISOString(), state: row.status === "COMPLETED" ? "EXECUTED" : row.status === "REJECTED" ? "REJECTED" : due < now ? "DUE" : "SCHEDULED", evidence: row.confirmationHash ? `Confirmation ${row.confirmationHash.slice(0, 16)}…` : null };
      })
    ].sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());

    return {
      obligations: obligationRows,
      nextFiling,
      dpa: { current: current?.version ?? null, versions: versions.map((v) => ({ id: v.id, version: v.version, effectiveFrom: v.effectiveFrom.toISOString(), summary: v.summary, isCurrent: v.isCurrent })), coverage, onCurrent, totalSchools: schools.length },
      consent,
      subjects: { students, guardians: guardianCounts.reduce((sum, row) => sum + row._count._all, 0), accounts: staffUsers },
      grievances: { open: grievanceOpen, total: grievanceTotal },
      retention: ruleRows,
      deletionSchedule,
      signIn: { lockouts7d: lockouts, ipAllow: ipRules.filter((r) => r.type === "ALLOW").length, ipDeny: ipRules.filter((r) => r.type === "DENY").length, idleMinutes: Number(process.env.PLATFORM_IDLE_MINUTES ?? 30) },
      generatedAt: now.toISOString()
    };
  }

  async updateObligation(session: SessionPayload, id: string, body: unknown) {
    const input = obligationSchema.parse(body);
    const existing = await prisma.complianceObligation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("That obligation does not exist.");
    if (input.status === "COMPLIANT" && !(input.reference || existing.reference)) throw new BadRequestException("Say what proves it — a filing reference, a document name or a link — before marking this compliant.");
    const row = await prisma.complianceObligation.update({
      where: { id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
        ...(input.lastDoneAt !== undefined ? { lastDoneAt: input.lastDoneAt } : input.status === "COMPLIANT" ? { lastDoneAt: new Date() } : {}),
        ...(input.reference !== undefined ? { reference: input.reference || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
        updatedById: session.userId
      }
    });
    await this.audit(session, AuditAction.SETTINGS_UPDATE, "ComplianceObligation", id, { code: row.code, status: row.status, dueAt: iso(row.dueAt), reference: row.reference });
    return { id: row.id };
  }

  /* ───────────────────────── agreement versions ───────────────────────── */

  async publishDpa(session: SessionPayload, body: unknown) {
    await this.seed();
    const input = dpaSchema.parse(body);
    if (await prisma.dpaVersion.findUnique({ where: { version: input.version } })) throw new BadRequestException(`Version ${input.version} already exists.`);
    const created = await prisma.$transaction(async (tx) => {
      await tx.dpaVersion.updateMany({ data: { isCurrent: false } });
      return tx.dpaVersion.create({ data: { version: input.version, summary: input.summary || null, effectiveFrom: input.effectiveFrom ?? new Date(), isCurrent: true, createdById: session.userId } });
    });
    let told = 0;
    if (input.notifySchools) {
      const behind = await prisma.school.findMany({ where: { deletedAt: null, status: { not: "DELETED" }, OR: [{ dpaVersion: null }, { dpaVersion: { not: input.version } }] }, select: { id: true } });
      const owners = await prisma.user.findMany({ where: { schoolId: { in: behind.map((s) => s.id) }, isActive: true, deletedAt: null, role: { in: [...OWNER_ROLES] } }, select: { id: true, schoolId: true } });
      if (owners.length) {
        await prisma.notificationLog.createMany({ data: owners.map((owner) => ({ schoolId: owner.schoolId, userId: owner.id, channel: "IN_APP" as const, title: `Data processing agreement ${input.version} is ready to accept`, body: `Future Realm has published version ${input.version} of the data processing agreement${input.summary ? ` — ${input.summary}` : ""}. Open Account → Agreement to read and accept it.`, status: "QUEUED", sentAt: new Date() })) });
      }
      told = new Set(owners.map((owner) => owner.schoolId)).size;
    }
    await this.audit(session, AuditAction.SETTINGS_UPDATE, "DpaVersion", created.id, { version: input.version, schoolsTold: told });
    return { id: created.id, version: created.version, schoolsTold: told };
  }

  /* ───────────────────────── retention ───────────────────────── */

  async updateRetention(session: SessionPayload, id: string, body: unknown) {
    const input = retentionSchema.parse(body);
    const rule = await prisma.retentionRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException("That rule does not exist.");
    // A rule that deletes on a schedule must not be able to wipe recent data by a slip of the finger.
    if (ENFORCERS[rule.dataClass] && input.retentionDays < 30) throw new BadRequestException("Data that is deleted automatically must be kept for at least 30 days.");
    const updated = await prisma.retentionRule.update({ where: { id }, data: { retentionDays: input.retentionDays, ...(input.basis ? { basis: input.basis } : {}), ...(input.trigger ? { trigger: input.trigger } : {}) } });
    await this.audit(session, AuditAction.SETTINGS_UPDATE, "RetentionRule", id, { dataClass: rule.dataClass, from: rule.retentionDays, to: updated.retentionDays });
    return { id };
  }

  /** Deletes what each automatic rule says is past its time. Safe to run any time; it only ever removes expired rows. */
  async enforceRetention(session: SessionPayload | null) {
    await this.seed();
    const rules = await prisma.retentionRule.findMany();
    const removed: Record<string, number> = {};
    for (const rule of rules) {
      const enforcer = ENFORCERS[rule.dataClass];
      if (!enforcer || rule.retentionDays < 30) continue;
      removed[rule.dataClass] = await enforcer.purge(new Date(Date.now() - rule.retentionDays * DAY));
    }
    const total = Object.values(removed).reduce((sum, n) => sum + n, 0);
    if (total > 0 || session) await this.audit(session, AuditAction.DELETE, "RetentionRun", "retention", { removed, automatic: !session });
    return { removed, total };
  }

  /* ───────────────────────── breach handling ───────────────────────── */

  private async incident(id: string) {
    const incident = await prisma.securityIncident.findUnique({ where: { id } });
    if (!incident) throw new NotFoundException("Incident not found.");
    if (incident.status === "RESOLVED") throw new BadRequestException("This incident is already resolved.");
    return incident;
  }

  async containIncident(session: SessionPayload, id: string, body: unknown) {
    const input = containSchema.parse(body);
    const incident = await this.incident(id);
    if (input.scope === "AFFECTED_SCHOOLS" && incident.affectedSchoolIds.length === 0) throw new BadRequestException("Name the affected schools in the assessment first, or choose a different scope.");
    let revoked = 0;
    if (input.scope !== "NONE") {
      const schoolFilter = input.scope === "AFFECTED_SCHOOLS" ? { schoolId: { in: incident.affectedSchoolIds } } : {};
      revoked = (await prisma.platformSession.updateMany({ where: { revokedAt: null, ...schoolFilter, user: { role: { notIn: [...PLATFORM_ROLES] } } }, data: { revokedAt: new Date() } })).count;
    }
    await prisma.securityIncident.update({ where: { id }, data: { containedAt: new Date(), containment: `${input.note}${input.scope === "NONE" ? "" : ` · ${revoked} sign-in${revoked === 1 ? "" : "s"} ended`}`, status: incident.status === "DETECTED" || incident.status === "INVESTIGATING" ? "CONTAINED" : incident.status } });
    await this.audit(session, AuditAction.UPDATE, "SecurityIncident", id, { step: "contain", scope: input.scope, sessionsEnded: revoked });
    return { revoked };
  }

  async assessIncident(session: SessionPayload, id: string, body: unknown) {
    const input = assessSchema.parse(body);
    await this.incident(id);
    const schools = await prisma.school.count({ where: { id: { in: input.affectedSchoolIds } } });
    if (schools !== input.affectedSchoolIds.length) throw new BadRequestException("One of the schools named does not exist.");
    await prisma.securityIncident.update({ where: { id }, data: { assessment: input.assessment, affectedSchoolIds: input.affectedSchoolIds, status: "INVESTIGATING" } });
    await this.audit(session, AuditAction.UPDATE, "SecurityIncident", id, { step: "assess", affectedSchools: input.affectedSchoolIds.length });
    return { affected: schools };
  }

  /** The filing itself happens with the regulator; this records that it was made, when, and the reference they gave. */
  async notifyRegulator(session: SessionPayload, id: string, body: unknown) {
    const input = regulatorSchema.parse(body);
    const incident = await this.incident(id);
    if (!incident.assessment) throw new BadRequestException("Assess the incident before recording the regulator notice — it has to say what was affected.");
    const at = input.notifiedAt ?? new Date();
    await prisma.securityIncident.update({ where: { id }, data: { regulatorNotifiedAt: at, regulatorReference: input.reference } });
    const hours = Math.round(((at.getTime() - incident.detectedAt.getTime()) / 3_600_000) * 10) / 10;
    await this.audit(session, AuditAction.UPDATE, "SecurityIncident", id, { step: "regulator", reference: input.reference, hoursAfterDetection: hours, withinWindow: hours <= REGULATOR_WINDOW_HOURS, notes: input.notes ?? null });
    return { hours, withinWindow: hours <= REGULATOR_WINDOW_HOURS };
  }

  /** Writes to every affected school's leadership — an in-app notice and an email — and keeps the count. */
  async notifySchools(session: SessionPayload, id: string, body: unknown) {
    const input = schoolsNoticeSchema.parse(body);
    const incident = await this.incident(id);
    if (!incident.affectedSchoolIds.length) throw new BadRequestException("No affected schools are recorded. Assess the incident first.");
    const schools = await prisma.school.findMany({ where: { id: { in: incident.affectedSchoolIds } }, select: { id: true, name: true, ownerEmail: true } });
    const owners = await prisma.user.findMany({ where: { schoolId: { in: schools.map((s) => s.id) }, isActive: true, deletedAt: null, role: { in: [...OWNER_ROLES] } }, select: { id: true, schoolId: true, email: true } });
    const title = "Important: a security incident affecting your school's data";
    if (owners.length) await prisma.notificationLog.createMany({ data: owners.map((owner) => ({ schoolId: owner.schoolId, userId: owner.id, channel: "IN_APP" as const, title, body: input.message, status: "QUEUED", sentAt: new Date() })) });
    const emails = new Set<string>();
    for (const school of schools) if (school.ownerEmail) emails.add(school.ownerEmail);
    for (const owner of owners) emails.add(owner.email);
    for (const to of emails) await sendEmail({ to, subject: title, text: input.message }).catch(() => undefined);
    await prisma.securityIncident.update({ where: { id }, data: { schoolsNotifiedAt: new Date(), schoolsNotifiedCount: schools.length } });
    await this.audit(session, AuditAction.UPDATE, "SecurityIncident", id, { step: "schools", schools: schools.length, people: owners.length, emails: emails.size });
    return { schools: schools.length, people: owners.length };
  }

  /* ───────────────────────── audit export ───────────────────────── */

  async createAuditExport(session: SessionPayload, body: unknown) {
    const input = exportSchema.parse(body);
    const where: Prisma.AuditLogWhereInput = {
      ...(input.schoolId ? { schoolId: input.schoolId } : {}),
      ...(input.action ? { action: input.action.toUpperCase() as AuditAction } : {}),
      ...(input.actorId ? { actorId: input.actorId } : {}),
      ...(input.entityType ? { entityType: input.entityType } : {}),
      ...(input.dateFrom || input.dateTo ? { createdAt: { ...(input.dateFrom ? { gte: input.dateFrom } : {}), ...(input.dateTo ? { lte: new Date(input.dateTo.getTime() + DAY - 1) } : {}) } } : {}),
      ...(input.origin === "BACK_OFFICE" ? { actor: { role: { in: [...PLATFORM_ROLES] } } } : input.origin === "SCHOOL" ? { actor: { role: { notIn: [...PLATFORM_ROLES] } } } : input.origin === "SYSTEM" ? { actorId: null } : {})
    };
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({ where, include: { actor: { select: { firstName: true, lastName: true, role: true } }, school: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: EXPORT_ROW_CAP })
    ]);
    const rows = logs.map((log) => ({
      timestamp: log.createdAt.toISOString(),
      actor: log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : "System",
      origin: !log.actor ? "System" : (PLATFORM_ROLES as readonly string[]).includes(log.actor.role) ? "Back Office" : "School app",
      action: log.action,
      entity: log.entityType,
      entityId: log.entityId,
      school: log.school?.name ?? "Platform",
      ipAddress: log.ipAddress ?? "",
      details: log.metadata ?? {}
    }));
    const content = input.format === "JSON"
      ? JSON.stringify(rows, null, 2)
      : [["Timestamp", "Actor", "Origin", "Action", "Entity", "Entity id", "School", "IP address", "Details"].map(csv).join(","), ...rows.map((r) => [r.timestamp, r.actor, r.origin, r.action, r.entity, r.entityId, r.school, r.ipAddress, JSON.stringify(r.details)].map(csv).join(","))].join("\n");
    const filters = { dateFrom: iso(input.dateFrom), dateTo: iso(input.dateTo), schoolId: input.schoolId ?? null, action: input.action ?? null, actorId: input.actorId ?? null, entityType: input.entityType ?? null, origin: input.origin ?? null };
    const actor = await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true } });
    const record = await prisma.auditExport.create({ data: { actorId: actor?.id ?? null, reason: input.reason, format: input.format, filters, rowCount: rows.length, truncated: total > rows.length, content } });
    await this.audit(session, AuditAction.EXPORT, "AuditLog", record.id, { reason: input.reason, filters, rowCount: rows.length, matched: total, format: input.format });
    return { id: record.id, rows: rows.length, matched: total, truncated: total > rows.length };
  }

  async listAuditExports() {
    const rows = await prisma.auditExport.findMany({ orderBy: { createdAt: "desc" }, take: 30, select: { id: true, reason: true, format: true, rowCount: true, truncated: true, filters: true, createdAt: true, actor: { select: { firstName: true, lastName: true } } } });
    return rows.map((row) => ({ id: row.id, by: row.actor ? `${row.actor.firstName} ${row.actor.lastName}` : "System", reason: row.reason, format: row.format, rowCount: row.rowCount, truncated: row.truncated, filters: row.filters, createdAt: row.createdAt.toISOString() }));
  }

  async auditExportFile(session: SessionPayload, id: string) {
    const row = await prisma.auditExport.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("That export no longer exists.");
    await this.audit(session, AuditAction.EXPORT, "AuditExport", id, { downloaded: true });
    return { name: `audit-log-${row.createdAt.toISOString().slice(0, 10)}.${row.format === "JSON" ? "json" : "csv"}`, type: row.format === "JSON" ? "application/json" : "text/csv", content: row.content };
  }

  /** People who have acted in the log, for the export's actor filter. */
  async auditActors() {
    const rows = await prisma.user.findMany({ where: { logs: { some: {} } }, select: { id: true, firstName: true, lastName: true, role: true }, orderBy: { firstName: "asc" }, take: 300 });
    return rows.map((row) => ({ id: row.id, name: `${row.firstName} ${row.lastName}`, role: row.role }));
  }
}
