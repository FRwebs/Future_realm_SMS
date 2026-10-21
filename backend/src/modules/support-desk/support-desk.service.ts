import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { AuditAction, PlatformTicketCategory, PlatformTicketPriority, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { sendNotification } from "../../../../src/lib/integrations/notifications";

const HOUR = 3_600_000;
const DAY = 86_400_000;
const OPEN = ["OPEN", "TRIAGED", "IN_PROGRESS", "AWAITING_SCHOOL_RESPONSE", "ESCALATED"] as const;
const FINISHED = ["RESOLVED", "CLOSED"];

/** The service levels. `alertAfter` is hours after the ticket is opened at which the support leads are told it is at risk. */
export const SERVICE_LEVELS = [
  { key: "CRITICAL", label: "Critical", hours: 1, alertAfter: 0, definition: "Result or data visibility issue, login failure, data loss", escalation: "Immediate alert to the support leads" },
  { key: "HIGH", label: "High", hours: 4, alertAfter: 2, definition: "Core workflow broken — results, fees, attendance — with no workaround", escalation: "Alert at 2 hours if unresolved" },
  { key: "MEDIUM", label: "Standard", hours: 8, alertAfter: 6, definition: "Feature not behaving as expected; a workaround exists", escalation: "Alert at 6 hours" },
  { key: "LOW", label: "Low", hours: 24, alertAfter: 20, definition: "How-to question, minor inconvenience, feature request", escalation: "Alert at 20 hours" }
] as const;

/** Every category a ticket must carry before it can leave New, and what it covers. */
export const CATEGORIES: Array<{ key: PlatformTicketCategory; label: string; covers: string }> = [
  { key: "ACCOUNT_ACCESS", label: "Login and Access", covers: "Cannot log in, forgotten password, wrong permissions" },
  { key: "RESULT_COMPUTATION", label: "Result Computation", covers: "Incorrect grade, missing score, result not publishing" },
  { key: "FEE_MANAGEMENT", label: "Fee Management", covers: "Incorrect balance, payment not reflecting, receipt error" },
  { key: "NOTIFICATION_DELIVERY", label: "Notification Delivery", covers: "Message not sending or not received on any channel" },
  { key: "SYNC_OFFLINE_ISSUE", label: "Sync and Offline", covers: "Data not syncing, offline records missing after reconnection" },
  { key: "BILLING", label: "Billing and Subscription", covers: "Invoice query, payment not confirmed, tier change request" },
  { key: "DATA_CORRECTION_REQUEST", label: "Data Correction", covers: "Name error, wrong student in class, published result error" },
  { key: "DATA_MIGRATION", label: "Data Migration", covers: "Import problem, records rejected, reconciliation dispute" },
  { key: "ONBOARDING_SETUP", label: "Onboarding and Setup", covers: "Setup wizard, configuration, template selection" },
  { key: "FEATURE_REQUEST", label: "Feature Question", covers: "How-to, training request, configuration guidance" },
  { key: "TECHNICAL_BUG", label: "Bug Report", covers: "Behaviour not matching expected behaviour" },
  { key: "DATA_ISSUE", label: "Data Issue", covers: "Records missing or wrong — older tickets filed before Data Correction existed" },
  { key: "OTHER", label: "Other", covers: "Must be reclassified before the ticket can be closed" }
];

const targetHours = (priority: string) => SERVICE_LEVELS.find((level) => level.key === priority)?.hours ?? 8;
const hoursBetween = (from: Date, to: Date) => (to.getTime() - from.getTime()) / HOUR;
const round1 = (value: number) => Math.round(value * 10) / 10;
const avg = (values: number[]) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null);

const idsSchema = z.object({ ticketIds: z.array(z.string()).min(1, "Choose at least one ticket.") });
const assignSchema = idsSchema.extend({ assignedToId: z.string().min(1, "Choose who the tickets go to.") });
const prioritySchema = idsSchema.extend({ priority: z.nativeEnum(PlatformTicketPriority) });
const countrySchema = z.object({
  country: z.string().trim().min(2, "Name the country."),
  supportHours: z.string().trim().min(3, "Give the hours, e.g. 08:00–17:00 WAT, Mon–Fri."),
  publicHolidays: z.coerce.number().int().min(0).max(60)
});

@Injectable()
export class SupportDeskService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger("SupportSla");
  private timer: NodeJS.Timeout | null = null;

  onApplicationBootstrap() {
    if (process.env.SLA_MONITOR === "off") return;
    this.timer = setInterval(() => void this.scanSla().catch((error) => this.log.error(error)), 300_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async actorId(session: SessionPayload) {
    return (await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true } }))?.id ?? null;
  }

  private async audit(session: SessionPayload | null, entityType: string, entityId: string, metadata: Prisma.InputJsonValue, schoolId?: string | null) {
    await prisma.auditLog.create({ data: { schoolId: schoolId ?? null, actorId: session ? await this.actorId(session) : null, action: AuditAction.UPDATE, entityType, entityId, metadata } });
  }

  /* ───────────────────────── the clocks ───────────────────────── */

  /**
   * Tell the support leads about a ticket that has reached its alert point. One alert per ticket per priority — changing a
   * ticket's priority starts its clock again. The clock is flat hours from the ticket being opened, not the school's working hours.
   */
  async scanSla() {
    const tickets = await prisma.supportTicket.findMany({ where: { status: { in: [...OPEN] } }, include: { school: { select: { name: true } }, assignedTo: { select: { id: true, schoolId: true } } } });
    const alerted = await prisma.auditLog.findMany({ where: { entityType: "TicketSlaAlert", entityId: { in: tickets.map((t) => t.id) } }, select: { entityId: true, metadata: true } });
    const done = new Set(alerted.map((row) => `${row.entityId}:${(row.metadata as { priority?: string } | null)?.priority}`));
    const leads = await prisma.user.findMany({ where: { role: { in: ["SUPER_ADMIN", "PLATFORM_ADMIN", "PLATFORM_OWNER"] }, isActive: true }, select: { id: true, schoolId: true } });
    let sent = 0;
    for (const ticket of tickets) {
      const level = SERVICE_LEVELS.find((l) => l.key === ticket.priority);
      if (!level || done.has(`${ticket.id}:${ticket.priority}`)) continue;
      if (Date.now() < ticket.createdAt.getTime() + level.alertAfter * HOUR) continue;
      const breached = Boolean(ticket.slaDueAt && ticket.slaDueAt < new Date());
      const title = breached ? `SLA breached: ${ticket.ticketNo}` : `SLA at risk: ${ticket.ticketNo}`;
      const body = `${ticket.school.name} — ${ticket.subject}. ${level.label} priority, target ${level.hours} hour${level.hours === 1 ? "" : "s"}${ticket.assignedToId ? "" : ", and nobody owns it yet"}.`;
      const recipients = [...leads, ...(ticket.assignedTo ? [{ id: ticket.assignedTo.id, schoolId: ticket.assignedTo.schoolId }] : [])];
      const seen = new Set<string>();
      for (const person of recipients) {
        if (seen.has(person.id)) continue;
        seen.add(person.id);
        await prisma.notificationLog.create({ data: { schoolId: person.schoolId, userId: person.id, channel: "IN_APP", title, body, status: "SENT", metadata: { kind: "TICKET_SLA", ticketId: ticket.id } } });
      }
      await this.audit(null, "TicketSlaAlert", ticket.id, { priority: ticket.priority, breached, notified: seen.size }, ticket.schoolId);
      sent += 1;
    }
    return { checked: tickets.length, alerted: sent };
  }

  /* ───────────────────────── the board ───────────────────────── */

  async board() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(Date.now() - 7 * DAY);
    const twoWeeks = new Date(Date.now() - 14 * DAY);
    const [open, resolvedToday, resolvedWeek, resolvedPrev, csat] = await Promise.all([
      prisma.supportTicket.findMany({ where: { status: { in: [...OPEN] } }, select: { priority: true, slaDueAt: true } }),
      prisma.supportTicket.findMany({ where: { resolvedAt: { gte: todayStart } }, select: { resolvedAt: true, slaDueAt: true } }),
      prisma.supportTicket.findMany({ where: { resolvedAt: { gte: weekAgo } }, select: { createdAt: true, resolvedAt: true } }),
      prisma.supportTicket.findMany({ where: { resolvedAt: { gte: twoWeeks, lt: weekAgo } }, select: { createdAt: true, resolvedAt: true } }),
      prisma.ticketCsatResponse.aggregate({ where: { submittedAt: { gte: weekAgo } }, _avg: { score: true }, _count: { _all: true } })
    ]);
    const hours = (rows: Array<{ createdAt: Date; resolvedAt: Date | null }>) => avg(rows.filter((r) => r.resolvedAt).map((r) => hoursBetween(r.createdAt, r.resolvedAt as Date)));
    const thisWeek = hours(resolvedWeek);
    const lastWeek = hours(resolvedPrev);
    return {
      open: open.length,
      critical: open.filter((t) => t.priority === "CRITICAL").length,
      breaching: open.filter((t) => t.slaDueAt && t.slaDueAt < now).length,
      resolvedToday: resolvedToday.length,
      resolvedTodayWithinSla: resolvedToday.filter((t) => !t.slaDueAt || (t.resolvedAt as Date) <= t.slaDueAt).length,
      avgResolutionWeek: thisWeek === null ? null : round1(thisWeek),
      avgResolutionLastWeek: lastWeek === null ? null : round1(lastWeek),
      csat: csat._avg.score === null ? null : round1(csat._avg.score),
      csatResponses: csat._count._all
    };
  }

  /* ───────────────────────── service levels, categories, working hours ───────────────────────── */

  async serviceLevels() {
    const term = new Date(Date.now() - 120 * DAY);
    const [open, byCategory, openByCategory, countries] = await Promise.all([
      prisma.supportTicket.groupBy({ by: ["priority"], where: { status: { in: [...OPEN] } }, _count: { _all: true } }),
      prisma.supportTicket.groupBy({ by: ["category"], where: { createdAt: { gte: term } }, _count: { _all: true } }),
      prisma.supportTicket.groupBy({ by: ["category"], where: { status: { in: [...OPEN] } }, _count: { _all: true } }),
      prisma.countryProfile.findMany({ orderBy: [{ isLive: "desc" }, { country: "asc" }] })
    ]);
    const count = (rows: Array<{ category: string; _count: { _all: number } }>, key: string) => rows.find((row) => row.category === key)?._count._all ?? 0;
    const categories = CATEGORIES.map((c) => ({ key: c.key, label: c.label, covers: c.covers, volume: count(byCategory, c.key), open: count(openByCategory, c.key) })).filter((c) => c.key !== "DATA_ISSUE" || c.volume > 0);
    return {
      levels: SERVICE_LEVELS.map((l) => ({ key: l.key, label: l.label, hours: l.hours, definition: l.definition, escalation: l.escalation, open: open.find((row) => row.priority === l.key)?._count._all ?? 0 })),
      categories,
      termVolume: categories.reduce((sum, c) => sum + c.volume, 0),
      newCategoryVolume: categories.filter((c) => ["DATA_MIGRATION", "ONBOARDING_SETUP"].includes(c.key)).reduce((sum, c) => sum + c.volume, 0),
      countries: countries.map((c) => ({ country: c.country, hours: c.supportHours, holidays: c.publicHolidays, live: c.isLive }))
    };
  }

  async saveCountryHours(session: SessionPayload, body: unknown) {
    const input = countrySchema.parse(body);
    const row = await prisma.countryProfile.upsert({
      where: { country: input.country },
      create: { country: input.country, supportHours: input.supportHours, publicHolidays: input.publicHolidays },
      update: { supportHours: input.supportHours, publicHolidays: input.publicHolidays }
    });
    await this.audit(session, "CountryProfile", row.id, { country: row.country, supportHours: input.supportHours, publicHolidays: input.publicHolidays });
    return { country: row.country };
  }

  /* ───────────────────────── analytics ───────────────────────── */

  async analytics() {
    const now = Date.now();
    const weekAgo = new Date(now - 7 * DAY);
    const twoWeeks = new Date(now - 14 * DAY);
    const month = new Date(now - 30 * DAY);
    const [openedWeek, openedPrev, resolvedWeek, resolved30, csat30, recent, agents] = await Promise.all([
      prisma.supportTicket.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.supportTicket.count({ where: { createdAt: { gte: twoWeeks, lt: weekAgo } } }),
      prisma.supportTicket.findMany({ where: { resolvedAt: { gte: weekAgo } }, select: { createdAt: true, resolvedAt: true, slaDueAt: true, assignedToId: true } }),
      prisma.supportTicket.findMany({ where: { resolvedAt: { gte: month } }, select: { createdAt: true, resolvedAt: true, priority: true, slaDueAt: true } }),
      prisma.ticketCsatResponse.findMany({ where: { submittedAt: { gte: month } }, select: { score: true, ticket: { select: { assignedToId: true } } } }),
      prisma.supportTicket.findMany({ where: { createdAt: { gte: new Date(now - 60 * DAY) } }, select: { id: true, schoolId: true, category: true, createdAt: true, assignedToId: true } }),
      prisma.user.findMany({ where: { OR: [{ role: "SUPPORT_AGENT" }, { assignedSupportTickets: { some: { createdAt: { gte: month } } } }] }, select: { id: true, firstName: true, lastName: true, role: true } })
    ]);
    const within = (rows: Array<{ resolvedAt: Date | null; slaDueAt: Date | null }>) => (rows.length ? Math.round((rows.filter((r) => !r.slaDueAt || (r.resolvedAt as Date) <= r.slaDueAt).length / rows.length) * 100) : null);
    const critical = resolved30.filter((r) => r.priority === "CRITICAL" && r.resolvedAt);
    const criticalAvg = avg(critical.map((r) => hoursBetween(r.createdAt, r.resolvedAt as Date)));
    // A repeat is a ticket in the last 30 days whose school already had one in the same category in the 30 days before it.
    const lastMonth = recent.filter((t) => t.createdAt >= month);
    const repeats = lastMonth.filter((t) => recent.some((o) => o.id !== t.id && o.schoolId === t.schoolId && o.category === t.category && o.createdAt < t.createdAt && t.createdAt.getTime() - o.createdAt.getTime() <= 30 * DAY));
    const scores = csat30.map((c) => c.score);
    const perAgent = agents.map((agent) => {
      const handled = recent.filter((t) => t.assignedToId === agent.id && t.createdAt >= weekAgo).length;
      const done = resolvedWeek.filter((t) => t.assignedToId === agent.id);
      const mine = csat30.filter((c) => c.ticket.assignedToId === agent.id).map((c) => c.score);
      const csatAvg = avg(mine);
      const sla = within(done);
      let standing = "No ratings yet";
      let tone = "mute";
      if (csatAvg !== null) {
        if (mine.length >= 3 && csatAvg < 3.5) { standing = "Coaching review"; tone = "bad"; }
        else if (csatAvg >= 4.5 && (sla === null || sla >= 90)) { standing = "Strong"; tone = "good"; }
        else { standing = "On track"; tone = "teal"; }
      }
      return { id: agent.id, name: `${agent.firstName} ${agent.lastName}`, assigned: handled, resolved: done.length, withinSla: sla, csat: csatAvg === null ? null : round1(csatAvg), responses: mine.length, standing, tone };
    }).filter((row) => row.assigned || row.resolved || row.responses);
    return {
      kpis: {
        openedWeek, openedPrev,
        withinSla: within(resolvedWeek), resolvedWeek: resolvedWeek.length,
        criticalMinutes: criticalAvg === null ? null : Math.round(criticalAvg * 60), criticalCount: critical.length,
        repeatRate: lastMonth.length ? round1((repeats.length / lastMonth.length) * 100) : null, sampled: lastMonth.length,
        csat: scores.length ? round1(avg(scores) as number) : null, csatResponses: scores.length
      },
      perAgent,
      byPriority: SERVICE_LEVELS.map((level) => {
        const rows = resolved30.filter((r) => r.priority === level.key && r.resolvedAt);
        const mean = avg(rows.map((r) => hoursBetween(r.createdAt, r.resolvedAt as Date)));
        return { key: level.key, label: level.label, target: level.hours, hours: mean === null ? null : round1(mean), count: rows.length };
      })
    };
  }

  /* ───────────────────────── tickets in bulk ───────────────────────── */

  async assignMany(session: SessionPayload, body: unknown) {
    const input = assignSchema.parse(body);
    const agent = await prisma.user.findUnique({ where: { id: input.assignedToId }, select: { id: true, firstName: true, lastName: true } });
    if (!agent) throw new NotFoundException("That person does not exist.");
    const tickets = await prisma.supportTicket.findMany({ where: { id: { in: input.ticketIds }, status: { notIn: FINISHED as never } } });
    for (const ticket of tickets) {
      await prisma.supportTicket.update({ where: { id: ticket.id }, data: { assignedToId: agent.id, status: ticket.status === "OPEN" ? "TRIAGED" : ticket.status } });
      await this.audit(session, "SupportTicket", ticket.id, { assignedToId: agent.id, bulk: true }, ticket.schoolId);
    }
    return { assigned: tickets.length, skipped: input.ticketIds.length - tickets.length, to: `${agent.firstName} ${agent.lastName}` };
  }

  /** A new priority starts a new clock, measured from when the ticket was opened. */
  async changePriorityMany(session: SessionPayload, body: unknown) {
    const input = prioritySchema.parse(body);
    const tickets = await prisma.supportTicket.findMany({ where: { id: { in: input.ticketIds }, status: { notIn: FINISHED as never } } });
    for (const ticket of tickets) {
      await prisma.supportTicket.update({ where: { id: ticket.id }, data: { priority: input.priority, slaDueAt: new Date(ticket.createdAt.getTime() + targetHours(input.priority) * HOUR) } });
      await this.audit(session, "SupportTicket", ticket.id, { priority: input.priority, was: ticket.priority, bulk: true }, ticket.schoolId);
    }
    return { changed: tickets.length, skipped: input.ticketIds.length - tickets.length };
  }

  /** Closing needs a real category: a ticket left as Other has to be reclassified first. */
  async closeMany(session: SessionPayload, body: unknown) {
    const input = idsSchema.parse(body);
    const tickets = await prisma.supportTicket.findMany({ where: { id: { in: input.ticketIds } } });
    const skipped: Array<{ ticket: string; why: string }> = [];
    let closed = 0;
    for (const ticket of tickets) {
      if (ticket.status === "CLOSED") { skipped.push({ ticket: ticket.ticketNo, why: "Already closed" }); continue; }
      if (ticket.category === "OTHER") { skipped.push({ ticket: ticket.ticketNo, why: "Categorised as Other — reclassify it first" }); continue; }
      await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: "CLOSED", closedAt: new Date(), resolvedAt: ticket.resolvedAt ?? new Date() } });
      await this.audit(session, "SupportTicket", ticket.id, { status: "CLOSED", bulk: true }, ticket.schoolId);
      closed += 1;
    }
    if (!closed && skipped.length) throw new BadRequestException(skipped.map((s) => `${s.ticket}: ${s.why}`).join("; "));
    return { closed, skipped };
  }

  /* ───────────────────────── data corrections ───────────────────────── */

  /** Operations checks the evidence the school supplied. Only then can a Super Admin be asked to approve. */
  async validateCorrection(session: SessionPayload, recordId: string) {
    const record = await prisma.dataCorrectionRecord.findUnique({ where: { id: recordId }, include: { ticket: true } });
    if (!record) throw new NotFoundException("That correction request does not exist.");
    if (record.status !== "PENDING") throw new BadRequestException("Only a request waiting for validation can be validated.");
    const actor = await this.actorId(session);
    await prisma.dataCorrectionRecord.update({ where: { id: recordId }, data: { validatedById: actor, validatedAt: new Date() } });
    await this.audit(session, "DataCorrectionRecord", recordId, { validated: true, fieldCorrected: record.fieldCorrected }, record.ticket.schoolId);
    return { validated: true };
  }

  /** Tell the school what was corrected: the field, the old value, the new one. */
  async notifySchoolOfCorrection(recordId: string) {
    const record = await prisma.dataCorrectionRecord.findUnique({ where: { id: recordId }, include: { ticket: { include: { school: { select: { id: true, name: true, ownerEmail: true } } } } } });
    if (!record || record.status !== "COMPLETED") return { notified: false };
    const school = record.ticket.school;
    const body = `As requested on ${record.ticket.ticketNo}, we corrected ${record.fieldCorrected}: "${record.oldValue}" is now "${record.newValue}". The change is recorded in your school's audit trail.`;
    const owners = await prisma.user.findMany({ where: { schoolId: school.id, role: { in: ["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL"] }, isActive: true }, select: { id: true } });
    if (owners.length) await prisma.notificationLog.createMany({ data: owners.map((owner) => ({ schoolId: school.id, userId: owner.id, channel: "IN_APP" as const, title: "A correction has been made to your records", body, status: "SENT" as const, metadata: { kind: "DATA_CORRECTION", recordId } })) });
    if (school.ownerEmail) await sendNotification({ channel: "EMAIL", recipient: school.ownerEmail, title: "A correction has been made to your records", body }).catch(() => undefined);
    await this.audit(null, "DataCorrectionNotice", recordId, { school: school.name }, school.id);
    return { notified: true };
  }

  /* ───────────────────────── the knowledge tab ───────────────────────── */

  async knowledge() {
    const [responses, articles] = await Promise.all([
      prisma.cannedResponse.findMany({ orderBy: [{ usedCount: "desc" }, { title: "asc" }] }),
      prisma.knowledgeBaseArticle.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, title: true, category: true, status: true, updatedAt: true, views: true } })
    ]);
    const stale = Date.now() - 60 * DAY;
    return {
      responses: responses.map((r) => ({ id: r.id, title: r.title, category: r.category, used: r.usedCount, updatedAt: r.updatedAt.toISOString(), needsReview: r.updatedAt.getTime() < stale })),
      articles: articles.map((a) => ({ id: a.id, title: a.title, category: a.category, status: a.status, views: a.views, updatedAt: a.updatedAt.toISOString() }))
    };
  }
}

export const supportDesk = new SupportDeskService();
