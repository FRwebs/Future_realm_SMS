import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { sendEmail } from "../../../../src/lib/integrations/mailer";

const DAY = 86_400_000;
const WINDOW_DAYS = 60;
/** The sample class every new school starts with is not use. */
const REAL_STUDENT = { NOT: { admissionNumber: { startsWith: "SMP-" } } } satisfies Prisma.StudentWhereInput;

export const CORE_MODULES = ["admissions", "students", "staff", "classes", "subjects", "timetable", "attendance", "academics", "finance", "communications", "configuration", "operations"] as const;
export type CoreModule = (typeof CORE_MODULES)[number];

const reportSchema = z.object({
  name: z.string().trim().min(2),
  dimension: z.enum(["tier", "state", "status"]),
  metric: z.enum(["schoolCount", "studentCount", "mrr"]),
  question: z.string().trim().optional().transform((v) => v || undefined),
  groupName: z.string().trim().optional().transform((v) => v || undefined),
  visibility: z.enum(["ALL", "OWNER"]).default("ALL"),
  periodDays: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int().min(1).max(1825).optional()),
  compare: z.preprocess((v) => v === true || v === "true", z.boolean()).default(false),
  suppressUnder: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int().min(2).max(100).optional()),
  lockFilters: z.preprocess((v) => v === true || v === "true", z.boolean()).default(false),
  frequency: z.enum(["WEEKLY", "MONTHLY", ""]).optional().transform((v) => v || undefined),
  recipients: z.preprocess((v) => (Array.isArray(v) ? v : typeof v === "string" && v ? v.split(/[,\n]/).map((x) => x.trim()).filter(Boolean) : []), z.array(z.string().email("A recipient is not a valid email address."))).default([])
});

const dayOf = (date: Date) => date.toISOString().slice(0, 10);
const mondayOf = (date: Date) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const offset = (d.getUTCDay() + 6) % 7;
  return dayOf(new Date(d.getTime() - offset * DAY));
};

@Injectable()
export class AnalyticsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("Analytics");
  private timer: NodeJS.Timeout | null = null;

  onModuleInit() {
    if (process.env.ANALYTICS_SCHEDULER === "off") return;
    this.timer = setInterval(() => void this.tick().catch((error) => this.log.error(error)), 3_600_000);
    this.timer.unref();
    // Capture soon after start so a fresh install has its first snapshot the same day.
    setTimeout(() => void this.tick().catch((error) => this.log.error(error)), 30_000).unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    const snapshots = await this.snapshot();
    const sent = await this.sendDueReports();
    return { ...snapshots, sent };
  }

  private async audit(session: SessionPayload | null, action: AuditAction, entityType: string, entityId: string, metadata: Prisma.InputJsonValue) {
    const actor = session ? await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true } }) : null;
    await prisma.auditLog.create({ data: { actorId: actor?.id ?? null, action, entityType, entityId, metadata } });
  }

  /* ───────────────────────── what schools actually use ───────────────────────── */

  /** For each module, the schools that did something in it in the last 60 days. Counted from the records themselves — not from a switch a school may or may not have flipped. */
  async usage(): Promise<Map<CoreModule, Set<string>>> {
    const since = new Date(Date.now() - WINDOW_DAYS * DAY);
    const ids = (rows: Array<{ schoolId: string | null }>) => new Set(rows.map((row) => row.schoolId).filter((id): id is string => Boolean(id)));
    const [admissions, students, staff, classes, subjects, timetable, attendance, scores, payments, messages, settings, events] = await Promise.all([
      prisma.admissionApplication.groupBy({ by: ["schoolId"], where: { submittedAt: { gte: since } } }),
      prisma.student.groupBy({ by: ["schoolId"], where: { ...REAL_STUDENT, admissionDate: { gte: since } } }),
      prisma.staffProfile.groupBy({ by: ["schoolId"], where: { employmentDate: { gte: since } } }),
      prisma.classRoom.groupBy({ by: ["schoolId"], where: { createdAt: { gte: since } } }),
      prisma.classSubject.groupBy({ by: ["schoolId"], where: { assignedAt: { gte: since }, assignedById: { not: null } } }),
      prisma.timetableEntry.groupBy({ by: ["schoolId"], where: { createdAt: { gte: since } } }),
      prisma.studentAttendance.groupBy({ by: ["schoolId"], where: { student: REAL_STUDENT, date: { gte: since } } }),
      prisma.scoreEntry.groupBy({ by: ["schoolId"], where: { student: REAL_STUDENT, recordedAt: { gte: since } } }),
      prisma.payment.groupBy({ by: ["schoolId"], where: { paidAt: { gte: since } } }),
      prisma.notificationLog.groupBy({ by: ["schoolId"], where: { sentAt: { gte: since } } }),
      prisma.auditLog.groupBy({ by: ["schoolId"], where: { action: "SETTINGS_UPDATE", schoolId: { not: null }, createdAt: { gte: since } } }),
      prisma.calendarEvent.groupBy({ by: ["schoolId"], where: { startsAt: { gte: since } } })
    ]);
    const announcements = await prisma.announcement.groupBy({ by: ["schoolId"], where: { publishedAt: { gte: since } } });
    const operations = ids(events);
    for (const id of ids(announcements)) operations.add(id);
    return new Map<CoreModule, Set<string>>([
      ["admissions", ids(admissions)], ["students", ids(students)], ["staff", ids(staff)], ["classes", ids(classes)], ["subjects", ids(subjects)], ["timetable", ids(timetable)],
      ["attendance", ids(attendance)], ["academics", ids(scores)], ["finance", ids(payments)], ["communications", ids(messages)], ["configuration", ids(settings)], ["operations", operations]
    ]);
  }

  /* ───────────────────────── snapshots, so history exists ───────────────────────── */

  async snapshot() {
    const today = dayOf(new Date());
    const schools = await prisma.school.findMany({ where: { deletedAt: null }, select: { id: true, status: true, plan: true } });
    const have = new Set((await prisma.schoolSnapshot.findMany({ where: { day: today }, select: { schoolId: true } })).map((row) => row.schoolId));
    const missing = schools.filter((school) => !have.has(school.id));
    if (missing.length) await prisma.schoolSnapshot.createMany({ data: missing.map((school) => ({ day: today, schoolId: school.id, status: school.status, plan: school.plan })), skipDuplicates: true });
    // One module reading a week, refreshed through the week so the latest reflects today.
    const week = mondayOf(new Date());
    const used = await this.usage();
    for (const module of CORE_MODULES) {
      const using = used.get(module)?.size ?? 0;
      await prisma.moduleSnapshot.upsert({ where: { day_module: { day: week, module } }, create: { day: week, module, using, total: schools.length }, update: { using, total: schools.length } });
    }
    return { schools: missing.length, modules: CORE_MODULES.length };
  }

  /** Twelve weeks of readings per module, and retention by signup cohort read from the school snapshots. */
  async trends() {
    const [modules, snapshots, schools] = await Promise.all([
      prisma.moduleSnapshot.findMany({ orderBy: { day: "asc" } }),
      prisma.schoolSnapshot.findMany({ select: { day: true, schoolId: true, status: true } }),
      prisma.school.findMany({ where: { deletedAt: null }, select: { id: true, createdAt: true } })
    ]);
    const weeks = Array.from(new Set(modules.map((row) => row.day))).sort().slice(-12);
    const series = CORE_MODULES.map((module) => ({ module, points: weeks.map((week) => { const row = modules.find((r) => r.day === week && r.module === module); return row && row.total ? Math.round((row.using / row.total) * 1000) / 10 : null; }) }));
    // Retention: of the schools that joined in a month, the share that were active on the first snapshot day of each later month.
    const days = Array.from(new Set(snapshots.map((row) => row.day))).sort();
    const firstOfMonth = new Map<string, string>();
    for (const day of days) { const month = day.slice(0, 7); if (!firstOfMonth.has(month)) firstOfMonth.set(month, day); }
    const monthsSeen = Array.from(firstOfMonth.keys());
    const statusOn = new Map<string, Map<string, string>>();
    for (const row of snapshots) { if (!statusOn.has(row.day)) statusOn.set(row.day, new Map()); statusOn.get(row.day)!.set(row.schoolId, row.status); }
    const cohortOf = (date: Date) => date.toISOString().slice(0, 7);
    const cohorts = Array.from(new Set(schools.map((school) => cohortOf(school.createdAt)))).sort();
    const retention = cohorts.map((cohort) => {
      const members = schools.filter((school) => cohortOf(school.createdAt) === cohort);
      return { cohort, joined: members.length, readings: monthsSeen.filter((month) => month >= cohort).map((month) => { const day = firstOfMonth.get(month)!; const on = statusOn.get(day); const present = members.filter((m) => on?.has(m.id)); return { month, day, measured: present.length, active: present.filter((m) => ["ACTIVE", "TRIAL", "GRACE_PERIOD"].includes(on!.get(m.id)!)).length }; }) };
    });
    return { weeks, series, retention, firstSnapshot: days[0] ?? null, snapshotDays: days.length };
  }

  /* ───────────────────────── who owns a funnel stage ───────────────────────── */

  async owners() {
    const rows = await prisma.funnelStageOwner.findMany();
    const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.ownerId) } }, select: { id: true, firstName: true, lastName: true } });
    const names = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    return rows.map((row) => ({ stage: row.stage, ownerId: row.ownerId, owner: names.get(row.ownerId) ?? "Former team member" }));
  }

  async setOwner(session: SessionPayload, body: unknown) {
    const input = z.object({ stage: z.string().trim().min(2), ownerId: z.string().trim().optional() }).parse(body);
    if (!input.ownerId) {
      await prisma.funnelStageOwner.deleteMany({ where: { stage: input.stage } });
      return { stage: input.stage, ownerId: null };
    }
    const person = await prisma.user.findFirst({ where: { id: input.ownerId, deletedAt: null, isActive: true } });
    if (!person) throw new BadRequestException("That person is not on the team.");
    await prisma.funnelStageOwner.upsert({ where: { stage: input.stage }, create: { stage: input.stage, ownerId: input.ownerId }, update: { ownerId: input.ownerId } });
    await this.audit(session, AuditAction.SETTINGS_UPDATE, "FunnelStageOwner", input.stage, { ownerId: input.ownerId });
    return { stage: input.stage, ownerId: input.ownerId };
  }

  /* ───────────────────────── what support has heard about a module ───────────────────────── */

  async ticketsAbout(modules: string[]) {
    const since = new Date(Date.now() - 90 * DAY);
    const tickets = await prisma.supportTicket.findMany({ where: { createdAt: { gte: since } }, select: { ticketNo: true, subject: true, description: true, schoolId: true } });
    return Object.fromEntries(modules.map((module) => {
      const needle = module.toLowerCase();
      const hits = tickets.filter((t) => `${t.subject} ${t.description}`.toLowerCase().includes(needle));
      return [module, { tickets: hits.length, schools: new Set(hits.map((h) => h.schoolId)).size, sample: hits[0]?.subject ?? null }];
    }));
  }

  /** Features a school's plan includes that it has never used — measurable only where the product records the use (custom branding). */
  async paidUnused() {
    const feature = await prisma.tierFeature.findFirst({ where: { featureKey: "branding.custom" } });
    if (!feature) return { measured: ["custom branding"], unused: [] as Array<{ school: string; feature: string }> };
    const tiers = [feature.starterAccess ? "BASIC" : null, feature.standardAccess ? "STANDARD" : null, feature.professionalAccess ? "PROFESSIONAL" : null, feature.eliteAccess ? "ENTERPRISE" : null, feature.customAccess ? "CUSTOM" : null].filter((t): t is "BASIC" => Boolean(t));
    const schools = await prisma.school.findMany({ where: { deletedAt: null, plan: { in: tiers } }, select: { id: true, name: true, brandingAssets: { where: { status: "APPLIED" }, select: { id: true }, take: 1 } } });
    return { measured: ["custom branding"], unused: schools.filter((s) => s.brandingAssets.length === 0).map((s) => ({ school: s.name, feature: "Custom branding on report cards" })) };
  }

  /* ───────────────────────── custom reports ───────────────────────── */

  private groups(rows: Array<{ plan: string; state: string | null; status: string; createdAt: Date; students: number }>, dimension: string, metric: string, prices: Map<string, number>, from?: Date, to?: Date) {
    const out = new Map<string, { value: number; schools: number }>();
    for (const school of rows) {
      if (from && school.createdAt < from) continue;
      if (to && school.createdAt >= to) continue;
      const key = dimension === "tier" ? school.plan : dimension === "state" ? (school.state?.trim() || "Unspecified") : school.status;
      const add = metric === "schoolCount" ? 1 : metric === "studentCount" ? school.students : (prices.get(school.plan) ?? 0);
      const row = out.get(key) ?? { value: 0, schools: 0 };
      row.value += add;
      row.schools += 1;
      out.set(key, row);
    }
    return out;
  }

  async runReport(session: SessionPayload, id: string, override?: { dimension?: string; metric?: string }) {
    const report = await prisma.customReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException("Report not found.");
    await this.assertVisible(session, report);
    const locked = report.lockFilters;
    const dimension = !locked && override?.dimension && ["tier", "state", "status"].includes(override.dimension) ? override.dimension : report.dimension;
    const metric = !locked && override?.metric && ["schoolCount", "studentCount", "mrr"].includes(override.metric) ? override.metric : report.metric;
    const [schools, plans] = await Promise.all([
      prisma.school.findMany({ where: { deletedAt: null }, select: { plan: true, state: true, status: true, createdAt: true, _count: { select: { students: { where: REAL_STUDENT } } } } }),
      prisma.platformSubscriptionPlan.findMany({ where: { isActive: true }, select: { plan: true, monthlyPrice: true } })
    ]);
    const prices = new Map(plans.map((p) => [p.plan as string, Number(p.monthlyPrice)]));
    const rows = schools.map((s) => ({ plan: s.plan as string, state: s.state, status: s.status as string, createdAt: s.createdAt, students: s._count.students }));
    const now = new Date();
    const from = report.periodDays ? new Date(now.getTime() - report.periodDays * DAY) : undefined;
    const current = this.groups(rows, dimension, metric, prices, from);
    const previous = report.compare && report.periodDays ? this.groups(rows, dimension, metric, prices, new Date(now.getTime() - 2 * report.periodDays * DAY), from) : null;
    const labels = Array.from(new Set([...current.keys(), ...(previous ? previous.keys() : [])]));
    const result = labels.map((label) => {
      const c = current.get(label) ?? { value: 0, schools: 0 };
      const p = previous?.get(label);
      const hidden = Boolean(report.suppressUnder && c.schools < report.suppressUnder);
      return { label, value: hidden ? null : c.value, suppressed: hidden, schools: hidden ? null : c.schools, previous: hidden || !previous ? null : (p?.value ?? 0) };
    }).sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
    await prisma.customReport.update({ where: { id }, data: { generatedAt: new Date() } });
    return { name: report.name, dimension, metric, question: report.question, locked, periodDays: report.periodDays, compare: Boolean(previous), suppressUnder: report.suppressUnder, rows: result };
  }

  async csv(session: SessionPayload, id: string) {
    const run = await this.runReport(session, id);
    const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const head = [run.dimension, run.metric, ...(run.compare ? ["previous period"] : [])];
    return { name: run.name, content: [head.map(esc).join(","), ...run.rows.map((r) => [r.label, r.suppressed ? `under ${run.suppressUnder}` : r.value, ...(run.compare ? [r.previous ?? ""] : [])].map(esc).join(","))].join("\n") };
  }

  private async assertVisible(session: SessionPayload, report: { visibility: string; createdById: string | null }) {
    if (report.visibility === "ALL") return;
    const me = await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true } });
    if (!me || me.id !== report.createdById) throw new NotFoundException("Report not found.");
  }

  async list(session: SessionPayload) {
    const me = await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true } });
    const rows = await prisma.customReport.findMany({ where: { OR: [{ visibility: "ALL" }, { createdById: me?.id ?? "none" }] }, include: { createdBy: true }, orderBy: { createdAt: "desc" } });
    return rows.map((r) => ({
      id: r.id, name: r.name, dimension: r.dimension, metric: r.metric, generatedAt: r.generatedAt?.toISOString(), createdAt: r.createdAt.toISOString(),
      createdBy: r.createdBy ? `${r.createdBy.firstName} ${r.createdBy.lastName}` : "Unknown",
      question: r.question, groupName: r.groupName, visibility: r.visibility, periodDays: r.periodDays, compare: r.compare, suppressUnder: r.suppressUnder, lockFilters: r.lockFilters,
      frequency: r.frequency, recipients: r.recipients, lastSentAt: r.lastSentAt?.toISOString() ?? null
    }));
  }

  async save(session: SessionPayload, body: unknown, id?: string) {
    const input = reportSchema.parse(body);
    if (input.frequency && input.recipients.length === 0) throw new BadRequestException("A scheduled report needs at least one recipient.");
    if (input.compare && !input.periodDays) throw new BadRequestException("Comparing with the previous period needs a period.");
    const data = { name: input.name, dimension: input.dimension, metric: input.metric, question: input.question ?? null, groupName: input.groupName ?? null, visibility: input.visibility, periodDays: input.periodDays ?? null, compare: input.compare, suppressUnder: input.suppressUnder ?? null, lockFilters: input.lockFilters, frequency: input.frequency ?? null, recipients: input.recipients };
    const me = await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true } });
    const report = id
      ? await prisma.customReport.update({ where: { id }, data })
      : await prisma.customReport.create({ data: { ...data, createdById: me?.id, generatedAt: new Date() } });
    await this.audit(session, id ? AuditAction.UPDATE : AuditAction.CREATE, "CustomReport", report.id, { name: report.name, frequency: report.frequency, recipients: report.recipients.length });
    return { id: report.id };
  }

  /** Reports with a frequency go out as they fall due: weekly after seven days, monthly after thirty. */
  async sendDueReports() {
    const due = await prisma.customReport.findMany({ where: { frequency: { not: null } } });
    let sent = 0;
    for (const report of due) {
      const gap = report.frequency === "WEEKLY" ? 7 : 30;
      if (report.lastSentAt && Date.now() - report.lastSentAt.getTime() < gap * DAY) continue;
      const run = await this.runReportAsSystem(report.id);
      for (const to of report.recipients) await sendEmail({ to, subject: `${report.name} — ${report.frequency?.toLowerCase()} report`, text: `${report.question ? `${report.question}\n\n` : ""}${run}` }).catch(() => undefined);
      await prisma.customReport.update({ where: { id: report.id }, data: { lastSentAt: new Date() } });
      await this.audit(null, AuditAction.EXPORT, "CustomReport", report.id, { scheduled: true, recipients: report.recipients.length });
      sent += 1;
    }
    return sent;
  }

  private async runReportAsSystem(id: string) {
    const report = await prisma.customReport.findUnique({ where: { id } });
    if (!report) return "";
    // A scheduled run is the report as saved: visibility is about who may open it, not who it is sent to.
    const result = await this.runReport({ userId: report.createdById ?? "", email: "", role: "SUPER_ADMIN" } as unknown as SessionPayload, id);
    return [`${result.dimension} / ${result.metric}`, ...result.rows.map((r) => `${r.label}: ${r.suppressed ? `under ${result.suppressUnder}` : r.value}${result.compare ? ` (previous ${r.previous ?? 0})` : ""}`)].join("\n");
  }
}

export const analytics = new AnalyticsService();
