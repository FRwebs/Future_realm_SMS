import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AuditAction, type Prisma } from "@prisma/client";

import { prisma } from "../../../../src/lib/db/prisma";
import { REAL_STUDENTS } from "../super-admin/sample";
import { renderTrigger, type TriggerKey } from "./triggers";
import { sendEmail } from "../../../../src/lib/integrations/mailer";
import { PolicyService } from "./policy.service";
import type { Policy } from "./policy.shared";

/**
 * What the platform does about a school's trial and its silence, by the day counts in the platform policy.
 *
 *  Trial ends → read-only for `readOnlyDays` (the school can read and export, not change) → locked.
 *  Nobody signs in → watch → dormant, and the owner is told → the web address is released after `noticeDays`, unless
 *  somebody signs in first. A school that pays is never released automatically — it is flagged for a person to decide.
 *
 * Every transition is written to the audit log, tells the people it affects, and can be previewed before it runs.
 */

const DAY = 86_400_000;

export type LifecycleKind = "CONCESSION_DUE" | "CONCESSION_EXPIRED" | "TRIAL_ENDING" | "TRIAL_READ_ONLY" | "TRIAL_LOCK_DUE" | "TRIAL_LOCK" | "DORMANT_WATCH" | "DORMANT" | "RECOVERED" | "ADDRESS_RELEASE";

export type SchoolFacts = {
  status: string; billingStatus: string; isPersonalWorkspace: boolean;
  trialEndsAt: Date | null; createdAt: Date;
  dormantAt: Date | null; dormancyNoticeAt: Date | null; addressReleaseDueAt: Date | null;
};

export type Done = { kind: LifecycleKind; at: Date };

/** What should happen to one school now. Pure: the same facts and policy always give the same answer. */
export function decide(school: SchoolFacts, lastLoginAt: Date | null, policy: Policy, now: Date, done: Done[] = []): LifecycleKind[] {
  if (school.isPersonalWorkspace || school.status === "ARCHIVED" || school.status === "DELETED") return [];
  const out: LifecycleKind[] = [];
  const sent = (kind: LifecycleKind, since: Date | null) => done.some((entry) => entry.kind === kind && (!since || entry.at >= since));

  /* the trial */
  if (school.billingStatus === "TRIAL" && school.trialEndsAt) {
    const ended = school.trialEndsAt.getTime();
    const lockAt = ended + policy.trial.readOnlyDays * DAY;
    if (school.status === "TRIAL") {
      if (now.getTime() >= ended) out.push(policy.trial.readOnlyDays > 0 ? "TRIAL_READ_ONLY" : "TRIAL_LOCK");
      else if (policy.trial.lockReminderDays > 0 && now.getTime() >= ended - policy.trial.lockReminderDays * DAY && !sent("TRIAL_ENDING", school.createdAt)) out.push("TRIAL_ENDING");
    } else if (school.status === "GRACE_PERIOD") {
      if (now.getTime() >= lockAt) out.push("TRIAL_LOCK");
      else if (policy.trial.lockReminderDays > 0 && now.getTime() >= lockAt - policy.trial.lockReminderDays * DAY && !sent("TRIAL_LOCK_DUE", school.trialEndsAt)) out.push("TRIAL_LOCK_DUE");
    }
  }

  /* silence */
  const reference = lastLoginAt ?? school.createdAt;
  const inactiveDays = (now.getTime() - reference.getTime()) / DAY;
  if (school.dormantAt && lastLoginAt && lastLoginAt > school.dormantAt) {
    out.push("RECOVERED");
  } else if (!school.dormantAt && inactiveDays >= policy.dormancy.dormantDays) {
    out.push("DORMANT");
  } else if (school.dormantAt && school.addressReleaseDueAt && now >= school.addressReleaseDueAt && school.billingStatus !== "ACTIVE") {
    out.push("ADDRESS_RELEASE");
  } else if (!school.dormantAt && inactiveDays >= policy.dormancy.watchDays && !sent("DORMANT_WATCH", reference)) {
    out.push("DORMANT_WATCH");
  }
  return out;
}

@Injectable()
export class LifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("Lifecycle");
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly policy: PolicyService) {}

  onModuleInit() {
    if (process.env.LIFECYCLE_SCHEDULER === "off") return;
    this.timer = setInterval(() => void this.run().catch((error) => this.log.error(error)), 30 * 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async load(now: Date) {
    const policy = await this.policy.get();
    const schools = await prisma.school.findMany({ where: { deletedAt: null, isPersonalWorkspace: false, status: { notIn: ["ARCHIVED", "DELETED"] } }, select: { id: true, name: true, slug: true, subdomain: true, status: true, billingStatus: true, isPersonalWorkspace: true, trialEndsAt: true, createdAt: true, dormantAt: true, dormancyNoticeAt: true, addressReleaseDueAt: true, ownerEmail: true, accountManagerId: true } });
    const ids = schools.map((school) => school.id);
    const [logins, history] = await Promise.all([
      prisma.loginAttempt.groupBy({ by: ["schoolId"], where: { schoolId: { in: ids }, success: true }, _max: { createdAt: true } }),
      prisma.auditLog.findMany({ where: { schoolId: { in: ids }, entityType: "Lifecycle" }, select: { schoolId: true, metadata: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 5000 }),
    ]);
    const lastLogin = new Map(logins.filter((row) => row.schoolId).map((row) => [row.schoolId as string, row._max.createdAt]));
    const doneOf = new Map<string, Done[]>();
    for (const row of history) {
      const kind = (row.metadata as { kind?: LifecycleKind } | null)?.kind;
      if (kind && row.schoolId) doneOf.set(row.schoolId, [...(doneOf.get(row.schoolId) ?? []), { kind, at: row.createdAt }]);
    }
    return schools.map((school) => ({ school, lastLoginAt: lastLogin.get(school.id) ?? null, actions: decide(school, lastLogin.get(school.id) ?? null, policy, now, doneOf.get(school.id) ?? []) })).filter((entry) => entry.actions.length);
  }

  /** Concessions that need a reminder (30 days out) or have run out. */
  private async concessionsDue(now: Date) {
    const rows = await prisma.schoolConcession.findMany({ where: { status: "VERIFIED", expiresAt: { not: null, lte: new Date(now.getTime() + 30 * DAY) } }, include: { school: { select: { id: true, name: true, ownerEmail: true, status: true } } } });
    const sent = await prisma.auditLog.findMany({ where: { entityType: "Lifecycle", entityId: { in: rows.map((row) => row.id) } }, select: { entityId: true, metadata: true } });
    const done = new Set(sent.map((row) => `${row.entityId}:${(row.metadata as { kind?: string } | null)?.kind}`));
    return rows.flatMap((row) => {
      const expired = (row.expiresAt as Date) <= now;
      const kind: LifecycleKind = expired ? "CONCESSION_EXPIRED" : "CONCESSION_DUE";
      return done.has(`${row.id}:${kind}`) ? [] : [{ row, kind }];
    });
  }

  /** What would happen if the engine ran now — nothing is changed. */
  async preview(now = new Date()) {
    const entries = await this.load(now);
    const due = await this.concessionsDue(now);
    return [
      ...entries.flatMap((entry) => entry.actions.map((kind) => ({ schoolId: entry.school.id, school: entry.school.name, kind, status: entry.school.status, lastLoginAt: entry.lastLoginAt?.toISOString() ?? null }))),
      ...due.map(({ row, kind }) => ({ schoolId: row.school.id, school: row.school.name, kind, status: row.school.status, lastLoginAt: null })),
    ];
  }

  async run(now = new Date()): Promise<Array<{ school: string; kind: LifecycleKind }>> {
    if (this.running) return [];
    this.running = true;
    const applied: Array<{ school: string; kind: LifecycleKind }> = [];
    try {
      const policy = await this.policy.get();
      for (const entry of await this.load(now)) {
        for (const kind of entry.actions) {
          try {
            await this.apply(entry.school, kind, policy, now);
            applied.push({ school: entry.school.name, kind });
          } catch (error) {
            this.log.warn(`${entry.school.name} · ${kind}: ${error instanceof Error ? error.message : "failed"}`);
          }
        }
      }
      for (const { row, kind } of await this.concessionsDue(now)) {
        try {
          const school = { id: row.school.id, ownerEmail: row.school.ownerEmail };
          if (kind === "CONCESSION_DUE") {
            await this.tell(school, "Your discount needs verifying again", `${row.school.name}'s ${row.kind === "NGO" ? "NGO" : "mission"} discount ends on ${(row.expiresAt as Date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. Send your current registration evidence to your account manager before then, or the school moves to the Standard plan.`, { key: "discount.reverify", vars: { school: row.school.name, kind: row.kind === "NGO" ? "NGO" : "mission", endDate: (row.expiresAt as Date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) } });
            await this.note(row.school.id, kind, "Concession ending — owner told", { concessionId: row.id });
          } else {
            await prisma.$transaction([
              prisma.schoolConcession.update({ where: { id: row.id }, data: { status: "EXPIRED" } }),
              prisma.school.update({ where: { id: row.school.id }, data: { plan: row.priorPlan && row.priorPlan !== "CUSTOM" ? (row.priorPlan as never) : "STANDARD", lifecycleNote: "Concession expired", lifecycleAt: now } }),
            ]);
            await this.tell(school, "Your discount has ended", `${row.school.name}'s ${row.kind === "NGO" ? "NGO" : "mission"} discount was not re-verified and has ended, so the school is now on the Standard plan. Send your evidence to your account manager to be considered again.`, { key: "discount.ended", vars: { school: row.school.name, kind: row.kind === "NGO" ? "NGO" : "mission" } });
            await this.note(row.school.id, kind, "Concession expired — school moved off the discounted plan", { concessionId: row.id });
          }
          await prisma.auditLog.create({ data: { schoolId: row.school.id, action: AuditAction.UPDATE, entityType: "Lifecycle", entityId: row.id, metadata: { kind, concessionId: row.id } as Prisma.InputJsonValue } });
          applied.push({ school: row.school.name, kind });
        } catch (error) {
          this.log.warn(`${row.school.name} · ${kind}: ${error instanceof Error ? error.message : "failed"}`);
        }
      }
    } finally {
      this.running = false;
    }
    return applied;
  }

  private async tell(school: { id: string; ownerEmail: string | null }, subjectIn: string, bodyIn: string, trigger?: { key: TriggerKey; vars: Record<string, string | number> }) {
    const { subject, body } = trigger ? await renderTrigger(trigger.key, trigger.vars, { subject: subjectIn, body: bodyIn }) : { subject: subjectIn, body: bodyIn };
    const owners = await prisma.user.findMany({ where: { schoolId: school.id, isActive: true, deletedAt: null, role: { in: ["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL"] } }, select: { id: true } });
    if (owners.length) await prisma.notificationLog.createMany({ data: owners.map((owner) => ({ schoolId: school.id, userId: owner.id, channel: "IN_APP" as const, title: subject, body, status: "QUEUED", sentAt: new Date() })) });
    if (school.ownerEmail) await sendEmail({ to: school.ownerEmail, subject, text: body }).catch(() => undefined);
  }

  private async note(schoolId: string, kind: LifecycleKind, summary: string, extra: Record<string, unknown> = {}) {
    await prisma.auditLog.create({ data: { schoolId, action: AuditAction.UPDATE, entityType: "Lifecycle", entityId: schoolId, metadata: { kind, summary, automatic: true, ...extra } as Prisma.InputJsonValue } });
  }

  private async apply(school: { id: string; name: string; slug: string; subdomain: string | null; ownerEmail: string | null; accountManagerId: string | null; trialEndsAt: Date | null }, kind: LifecycleKind, policy: Policy, now: Date) {
    const stamp = { lifecycleAt: now };
    const day = (date: Date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    switch (kind) {
      case "TRIAL_ENDING": {
        await this.tell(school, "Your free trial ends soon", `${school.name}'s trial ends on ${school.trialEndsAt ? day(school.trialEndsAt) : "its end date"}. Choose a plan in Subscription & Billing to carry on without a break.`, { key: "trial.ending", vars: { school: school.name, endDate: school.trialEndsAt ? day(school.trialEndsAt) : "its end date" } });
        await this.note(school.id, kind, "Trial ending — owner reminded");
        break;
      }
      case "TRIAL_READ_ONLY": {
        const lockOn = new Date(now.getTime() + policy.trial.readOnlyDays * DAY);
        await prisma.school.update({ where: { id: school.id }, data: { status: "GRACE_PERIOD", statusReason: "Trial ended — read-only until a plan is chosen", statusChangedAt: now, lifecycleNote: "Trial ended: read-only", ...stamp } });
        await this.tell(school, "Your free trial has ended", `${school.name} is now read-only: everything can be read and exported, but nothing can be changed. Choose a plan before ${day(lockOn)} to switch editing back on; after that the school is locked and only support can reopen it.`, { key: "trial.ended", vars: { school: school.name, lockDate: day(lockOn) } });
        await this.note(school.id, kind, "Trial ended — school made read-only", { lockOn: lockOn.toISOString() });
        break;
      }
      case "TRIAL_LOCK_DUE": {
        await this.tell(school, "Your school will be locked soon", `${school.name} is read-only and will be locked in ${policy.trial.lockReminderDays} days unless a plan is chosen.`, { key: "trial.lock_reminder", vars: { school: school.name, days: policy.trial.lockReminderDays } });
        await this.note(school.id, kind, "Lock reminder sent");
        break;
      }
      case "TRIAL_LOCK": {
        await prisma.$transaction([
          prisma.school.update({ where: { id: school.id }, data: { status: "SUSPENDED", suspendedAt: now, suspendedReason: "Trial ended and no plan chosen", statusReason: "Trial ended and no plan chosen", statusChangedAt: now, lifecycleNote: "Trial ended: locked", ...stamp } }),
          prisma.platformSession.updateMany({ where: { schoolId: school.id, revokedAt: null }, data: { revokedAt: now } }),
        ]);
        await this.tell(school, "Your school has been locked", `${school.name} was locked because the trial ended without a plan. Nothing has been deleted. Contact your account manager or support and they can reopen it once a plan is agreed.`, { key: "trial.locked", vars: { school: school.name } });
        await this.note(school.id, kind, "School locked after the trial");
        break;
      }
      case "DORMANT_WATCH": {
        if (school.accountManagerId) await prisma.notificationLog.create({ data: { schoolId: school.id, userId: school.accountManagerId, channel: "IN_APP", title: `${school.name} has gone quiet`, body: `Nobody at ${school.name} has signed in for ${policy.dormancy.watchDays} days. A call now is cheaper than a lost school.`, status: "QUEUED", sentAt: now } });
        await prisma.school.update({ where: { id: school.id }, data: { lifecycleNote: "Inactivity watch", ...stamp } });
        await this.note(school.id, kind, `Inactivity watch · ${policy.dormancy.watchDays} days without a sign-in`);
        break;
      }
      case "DORMANT": {
        const due = new Date(now.getTime() + policy.dormancy.noticeDays * DAY);
        await prisma.school.update({ where: { id: school.id }, data: { dormantAt: now, dormancyNoticeAt: now, addressReleaseDueAt: due, lifecycleNote: "Dormant — owner told", ...stamp } });
        await this.tell(school, "Your school has been inactive", `Nobody has signed in to ${school.name} for ${policy.dormancy.dormantDays} days. Its web address (${school.subdomain ?? school.slug}) will be released on ${day(due)} unless someone signs in before then. Nothing else is deleted.`, { key: "dormant.notice", vars: { school: school.name, days: policy.dormancy.dormantDays, address: school.subdomain ?? school.slug, releaseDate: day(due) } });
        await this.note(school.id, kind, "School judged dormant — owner told", { releaseDue: due.toISOString() });
        break;
      }
      case "RECOVERED": {
        await prisma.school.update({ where: { id: school.id }, data: { dormantAt: null, dormancyNoticeAt: null, addressReleaseDueAt: null, lifecycleNote: "Back in use", ...stamp } });
        await this.note(school.id, kind, "Somebody signed in — dormancy cleared");
        break;
      }
      case "ADDRESS_RELEASE": {
        // The release check: an address is never returned to the pool while real children's records sit behind it. It is held
        // for as long as that is true, and a person is told once.
        const real = await prisma.student.count({ where: { schoolId: school.id, ...REAL_STUDENTS } });
        if (real > 0) {
          const held = `Release held — ${real} real student${real === 1 ? "" : "s"} on the roll`;
          const current = await prisma.school.findUnique({ where: { id: school.id }, select: { lifecycleNote: true } });
          if (current?.lifecycleNote !== held) {
            await prisma.school.update({ where: { id: school.id }, data: { lifecycleNote: held, ...stamp } });
            const people = await prisma.user.findMany({ where: { OR: [{ id: school.accountManagerId ?? "" }, { role: { in: ["SUPER_ADMIN", "PLATFORM_OWNER"] } }], isActive: true }, select: { id: true, schoolId: true } });
            for (const person of people) await prisma.notificationLog.create({ data: { schoolId: person.schoolId, userId: person.id, channel: "IN_APP", title: `${school.name}'s address is held`, body: `${school.name} has been dormant past its release date but holds ${real} real student record${real === 1 ? "" : "s"}, so its web address stays held until a person decides.`, status: "SENT", metadata: { kind: "RELEASE_HELD", schoolId: school.id } } });
            await this.note(school.id, kind, held, { students: real });
          }
          break;
        }
        const address = school.subdomain ?? school.slug;
        await prisma.$transaction([
          prisma.webAddressRecord.updateMany({ where: { OR: [{ schoolId: school.id }, { address }] }, data: { state: "RETIRED", schoolId: null, retiredAt: now, releaseEligibleAt: now, changeReason: "Released after dormancy" } }),
          prisma.school.update({ where: { id: school.id }, data: { subdomain: null, status: "ARCHIVED", archivedAt: now, statusReason: "Dormant — web address released", statusChangedAt: now, lifecycleNote: "Address released", ...stamp } }),
        ]);
        await this.tell(school, "Your web address has been released", `${address} was released after ${policy.dormancy.dormantDays + policy.dormancy.noticeDays} days of inactivity. Your records are kept; contact support to reopen the school on a new address.`, { key: "address.released", vars: { address, days: policy.dormancy.dormantDays + policy.dormancy.noticeDays } });
        await this.note(school.id, kind, "Web address released after dormancy", { address });
        break;
      }
    }
  }
}
