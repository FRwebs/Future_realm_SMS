import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { sendNotification } from "../../../../src/lib/integrations/notifications";
import { platformPolicy } from "../platform-policy/policy.service";
import { fill } from "../platform-policy/triggers";

const DAY = 86_400_000;
const OPEN_INVOICE = ["SENT", "PARTIALLY_PAID", "OVERDUE"];
const OWNER_ROLES = ["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL"] as const;

/** What a rule can be about. Each is an event the platform already knows how to detect from its own records. */
export const RULE_EVENTS = {
  INVOICE_OVERDUE: { label: "Invoice became overdue", module: "Billing & commission", describe: (days: number) => `${days} day${days === 1 ? "" : "s"} past the due date` },
  INVOICE_DUE_SOON: { label: "Invoice is about to fall due", module: "Billing & commission", describe: (days: number) => `Due within ${days} day${days === 1 ? "" : "s"}` },
  SCHOOL_INACTIVE: { label: "School has gone quiet", module: "Lifecycle & compliance", describe: (days: number) => `Nobody signed in for ${days} day${days === 1 ? "" : "s"}` }
} as const;
type RuleEvent = keyof typeof RULE_EVENTS;

const createSchema = z.object({
  event: z.enum(["INVOICE_OVERDUE", "INVOICE_DUE_SOON", "SCHOOL_INACTIVE"]),
  days: z.coerce.number().int().min(0, "Days cannot be negative.").max(730),
  plan: z.string().trim().optional().transform((v) => v || undefined),
  ownerRecipient: z.preprocess((v) => v === true || v === "true", z.boolean()).default(false),
  bursarRecipient: z.preprocess((v) => v === true || v === "true", z.boolean()).default(false),
  managerRecipient: z.preprocess((v) => v === true || v === "true", z.boolean()).default(false),
  emailChannel: z.preprocess((v) => v === true || v === "true", z.boolean()).default(true),
  inAppChannel: z.preprocess((v) => v === true || v === "true", z.boolean()).default(false),
  templateId: z.string().trim().optional().transform((v) => v || undefined),
  sendHour: z.coerce.number().int().min(0).max(23).default(9),
  groupName: z.string().trim().optional().transform((v) => v || undefined)
});
const enableSchema = z.object({ enabled: z.preprocess((v) => v === true || v === "true", z.boolean()), reason: z.string().trim().min(5, "Say why the rule is being switched.") });

type Match = { entityId: string; schoolId: string; school: string; ownerEmail: string | null; managerEmail: string | null; vars: Record<string, string | number> };

@Injectable()
export class TriggerRulesService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger("TriggerRules");
  private timer: NodeJS.Timeout | null = null;

  onApplicationBootstrap() {
    if (process.env.TRIGGER_RULES_SCHEDULER === "off") return;
    this.timer = setInterval(() => void this.evaluateAll().catch((error) => this.log.error(error)), 15 * 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async audit(session: SessionPayload | null, action: AuditAction, id: string, metadata: Prisma.InputJsonValue) {
    const actor = session ? await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true } }) : null;
    await prisma.auditLog.create({ data: { actorId: actor?.id ?? null, action, entityType: "TriggerRule", entityId: id, metadata } });
  }

  async list() {
    const [rules, templates, firesCount] = await Promise.all([
      prisma.triggerRule.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.messageTemplate.findMany({ where: { retiredAt: null }, select: { id: true, name: true } }),
      prisma.triggerRuleFire.groupBy({ by: ["ruleId"], _count: { _all: true } })
    ]);
    const templateName = new Map(templates.map((template) => [template.id, template.name]));
    const fired = new Map(firesCount.map((row) => [row.ruleId, row._count._all]));
    return rules.map((rule) => {
      const event = RULE_EVENTS[rule.event as RuleEvent];
      return {
        id: rule.id,
        group: rule.groupName,
        event: event?.label ?? rule.event,
        condition: event?.describe(rule.days) ?? `${rule.days} days`,
        plan: rule.plan,
        recipients: rule.recipients,
        channels: rule.channels,
        template: rule.templateId ? (templateName.get(rule.templateId) ?? "Retired template") : null,
        sendHour: rule.sendHour,
        enabled: rule.enabled,
        fires: fired.get(rule.id) ?? 0,
        lastFiredAt: rule.lastFiredAt?.toISOString() ?? null
      };
    });
  }

  async create(session: SessionPayload, body: unknown) {
    const input = createSchema.parse(body);
    const recipients = [input.ownerRecipient ? "OWNER" : null, input.bursarRecipient ? "BURSAR" : null, input.managerRecipient ? "ACCOUNT_MANAGER" : null].filter((value): value is string => Boolean(value));
    if (recipients.length === 0) throw new BadRequestException("Choose at least one person who hears about it.");
    const channels = [input.emailChannel ? "EMAIL" : null, input.inAppChannel ? "IN_APP" : null].filter((value): value is string => Boolean(value));
    if (channels.length === 0) throw new BadRequestException("Choose at least one channel.");
    if (input.templateId) {
      const template = await prisma.messageTemplate.findFirst({ where: { id: input.templateId, retiredAt: null, approvalStatus: "APPROVED", channel: "EMAIL" } });
      if (!template) throw new BadRequestException("Only an approved email template can be attached to a rule.");
    }
    const actor = await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true } });
    const rule = await prisma.triggerRule.create({
      data: { event: input.event, days: input.days, plan: input.plan, recipients, channels, templateId: input.templateId, sendHour: input.sendHour, groupName: input.groupName ?? RULE_EVENTS[input.event].module, createdById: actor?.id ?? session.userId }
    });
    await this.audit(session, AuditAction.CREATE, rule.id, { event: input.event, days: input.days, recipients, channels, enabled: false });
    return { id: rule.id, enabled: false };
  }

  async setEnabled(session: SessionPayload, id: string, body: unknown) {
    const input = enableSchema.parse(body);
    const rule = await prisma.triggerRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException("That rule does not exist.");
    await prisma.triggerRule.update({ where: { id }, data: { enabled: input.enabled, enabledAt: input.enabled ? new Date() : rule.enabledAt } });
    await this.audit(session, AuditAction.UPDATE, id, { enabled: input.enabled, reason: input.reason });
    return { id, enabled: input.enabled };
  }

  async remove(session: SessionPayload, id: string, body: unknown) {
    const { reason } = z.object({ reason: z.string().trim().min(5, "Say why the rule is being removed.") }).parse(body);
    const rule = await prisma.triggerRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException("That rule does not exist.");
    await prisma.triggerRule.delete({ where: { id } });
    await this.audit(session, AuditAction.DELETE, id, { event: rule.event, reason });
    return { id };
  }

  /** Everything the rule would act on right now, rendered the way it would be sent — and nothing is sent. */
  async testFire(id: string) {
    const rule = await prisma.triggerRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException("That rule does not exist.");
    const matches = await this.matches(rule);
    const template = rule.templateId ? await prisma.messageTemplate.findUnique({ where: { id: rule.templateId } }) : null;
    return {
      total: matches.length,
      examples: matches.slice(0, 5).map((match) => ({ school: match.school, subject: this.subject(rule.event as RuleEvent, template?.name ?? null, match.vars), message: this.body(rule.event as RuleEvent, template?.body ?? null, match.vars), to: this.describeRecipients(rule.recipients) }))
    };
  }

  async evaluateAll() {
    const rules = await prisma.triggerRule.findMany({ where: { enabled: true } });
    let sent = 0;
    for (const rule of rules) sent += await this.evaluate(rule.id);
    return sent;
  }

  /** One rule against today's records. A rule only sends from its send hour in the platform's time zone, and only once per invoice or school. */
  async evaluate(id: string) {
    const rule = await prisma.triggerRule.findUnique({ where: { id } });
    if (!rule || !rule.enabled) return 0;
    const policy = await platformPolicy.get();
    const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: policy.identity.timeZone || "Africa/Lagos" }).format(new Date()));
    if (hour < rule.sendHour) return 0;
    const matches = await this.matches(rule);
    if (!matches.length) return 0;
    const already = new Set((await prisma.triggerRuleFire.findMany({ where: { ruleId: rule.id, entityId: { in: matches.map((match) => match.entityId) } }, select: { entityId: true } })).map((row) => row.entityId));
    const template = rule.templateId ? await prisma.messageTemplate.findFirst({ where: { id: rule.templateId, retiredAt: null, approvalStatus: "APPROVED" } }) : null;
    let total = 0;
    for (const match of matches.filter((entry) => !already.has(entry.entityId))) {
      const subject = this.subject(rule.event as RuleEvent, template?.name ?? null, match.vars);
      const message = this.body(rule.event as RuleEvent, template?.body ?? null, match.vars);
      let sent = 0;
      const emails: string[] = [];
      if (rule.recipients.includes("OWNER") && match.ownerEmail) emails.push(match.ownerEmail);
      if (rule.recipients.includes("BURSAR")) {
        const bursars = await prisma.user.findMany({ where: { schoolId: match.schoolId, role: "BURSAR", isActive: true, deletedAt: null }, select: { email: true } });
        emails.push(...bursars.map((bursar) => bursar.email));
      }
      if (rule.recipients.includes("ACCOUNT_MANAGER") && match.managerEmail) emails.push(match.managerEmail);
      if (rule.channels.includes("EMAIL")) {
        for (const email of [...new Set(emails)]) {
          await sendNotification({ channel: "EMAIL", recipient: email, title: subject, body: message }).then(() => (sent += 1)).catch(() => undefined);
        }
      }
      if (rule.channels.includes("IN_APP")) {
        const roles = [...(rule.recipients.includes("OWNER") ? OWNER_ROLES : []), ...(rule.recipients.includes("BURSAR") ? (["BURSAR"] as const) : [])];
        if (roles.length) {
          const people = await prisma.user.findMany({ where: { schoolId: match.schoolId, role: { in: roles as never }, isActive: true, deletedAt: null }, select: { id: true } });
          if (people.length) {
            await prisma.notificationLog.createMany({ data: people.map((person) => ({ schoolId: match.schoolId, userId: person.id, channel: "IN_APP" as const, title: subject, body: message, status: "QUEUED", sentAt: new Date() })) });
            sent += people.length;
          }
        }
      }
      await prisma.triggerRuleFire.create({ data: { ruleId: rule.id, entityId: match.entityId, schoolId: match.schoolId, sent, summary: `${match.school} · ${subject}` } });
      total += 1;
    }
    if (total) await prisma.triggerRule.update({ where: { id: rule.id }, data: { lastFiredAt: new Date() } });
    return total;
  }

  private describeRecipients(recipients: string[]) {
    return recipients.map((value) => (value === "OWNER" ? "The school owner" : value === "BURSAR" ? "The bursar" : "The account manager")).join(", ");
  }

  private subject(event: RuleEvent, templateName: string | null, vars: Record<string, string | number>) {
    if (templateName) return templateName;
    if (event === "INVOICE_OVERDUE") return `Invoice ${vars.invoice_no} is overdue`;
    if (event === "INVOICE_DUE_SOON") return `Invoice ${vars.invoice_no} falls due soon`;
    return `We have not seen ${vars.school} for a while`;
  }

  private body(event: RuleEvent, template: string | null, vars: Record<string, string | number>) {
    if (template) return fill(template, vars);
    if (event === "INVOICE_OVERDUE") return `Invoice ${vars.invoice_no} for ${vars.amount} was due on ${vars.due_date} and is now ${vars.days} days overdue. If it has been paid, please send us the reference and we will reconcile it.`;
    if (event === "INVOICE_DUE_SOON") return `Invoice ${vars.invoice_no} for ${vars.amount} falls due on ${vars.due_date}.`;
    return `Nobody at ${vars.school} has signed in for ${vars.days} days. Your records are safe; sign in any time to pick up where you left off.`;
  }

  /** The invoices or schools the rule's condition is true for right now. */
  private async matches(rule: { event: string; days: number; plan: string | null }): Promise<Match[]> {
    const now = Date.now();
    const planFilter = rule.plan ? { plan: rule.plan as never } : {};
    if (rule.event === "INVOICE_OVERDUE" || rule.event === "INVOICE_DUE_SOON") {
      const invoices = await prisma.platformInvoice.findMany({
        where: {
          status: { in: OPEN_INVOICE },
          school: { deletedAt: null, ...planFilter },
          dueAt: rule.event === "INVOICE_OVERDUE" ? { lte: new Date(now - rule.days * DAY) } : { gt: new Date(now), lte: new Date(now + rule.days * DAY) }
        },
        include: { school: { select: { id: true, name: true, ownerEmail: true, accountManager: { select: { email: true } } } } },
        take: 500
      });
      return invoices.map((invoice) => ({
        entityId: invoice.id,
        schoolId: invoice.school.id,
        school: invoice.school.name,
        ownerEmail: invoice.school.ownerEmail,
        managerEmail: invoice.school.accountManager?.email ?? null,
        vars: { school: invoice.school.name, invoice_no: invoice.invoiceNo, amount: `${Number(invoice.amount) + Number(invoice.taxAmount)} ${invoice.currency}`, due_date: invoice.dueAt.toISOString().slice(0, 10), days: Math.max(0, Math.floor((now - invoice.dueAt.getTime()) / DAY)) }
      }));
    }
    const cutoff = new Date(now - rule.days * DAY);
    const schools = await prisma.school.findMany({
      where: { deletedAt: null, isPersonalWorkspace: false, status: { in: ["ACTIVE", "TRIAL", "GRACE_PERIOD"] }, ...planFilter },
      select: { id: true, name: true, ownerEmail: true, accountManager: { select: { email: true } }, users: { select: { lastLoginAt: true } } },
      take: 1000
    });
    return schools
      .map((school) => ({ school, last: school.users.reduce<Date | null>((latest, user) => (user.lastLoginAt && (!latest || user.lastLoginAt > latest) ? user.lastLoginAt : latest), null) }))
      .filter(({ last }) => !last || last < cutoff)
      .map(({ school, last }) => ({ entityId: school.id, schoolId: school.id, school: school.name, ownerEmail: school.ownerEmail, managerEmail: school.accountManager?.email ?? null, vars: { school: school.name, days: last ? Math.floor((now - last.getTime()) / DAY) : rule.days } }));
  }
}
