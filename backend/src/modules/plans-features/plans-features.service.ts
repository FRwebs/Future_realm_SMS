import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AuditAction, Prisma, SubscriptionPlan } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";

const DAY = 86_400_000;
const OWNER_ROLES = ["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL"] as const;
/** Schools are told this far ahead of a price change they did not agree to. */
export const PRICE_NOTICE_DAYS = 30;
const STAGES = ["OFF", "PILOT", "PARTIAL", "FULL"] as const;
type Stage = (typeof STAGES)[number];
const TIERS = ["BASIC", "STANDARD", "PROFESSIONAL", "ENTERPRISE", "CUSTOM"] as const;
type Tier = (typeof TIERS)[number];
const TIER_COLUMN: Record<Tier, "starterAccess" | "standardAccess" | "professionalAccess" | "eliteAccess" | "customAccess"> = {
  BASIC: "starterAccess", STANDARD: "standardAccess", PROFESSIONAL: "professionalAccess", ENTERPRISE: "eliteAccess", CUSTOM: "customAccess"
};
const TIER_RANK: Record<string, number> = { BASIC: 1, STANDARD: 2, PROFESSIONAL: 3, ENTERPRISE: 4, CUSTOM: 5 };

/**
 * Every feature the product knows how to gate. A feature must be here before it can be given a row in the matrix, and
 * `enforcedAt` says where the product actually reads the answer — a feature with none is catalogue only.
 */
export const FEATURE_REGISTRY = [
  { key: "branding.custom", name: "Custom branding on report cards", module: "Report Cards", enforcedAt: "Submitting or applying a school's own branding", defaults: ["ENTERPRISE", "CUSTOM"] },
  { key: "communications.whatsapp", name: "WhatsApp notifications", module: "Communications", enforcedAt: null, defaults: ["STANDARD", "PROFESSIONAL", "ENTERPRISE", "CUSTOM"] },
  { key: "analytics.predictive", name: "Predictive analytics", module: "Analytics & BI", enforcedAt: null, defaults: ["ENTERPRISE"] },
  { key: "integrations.api", name: "API access", module: "Integrations", enforcedAt: null, defaults: ["ENTERPRISE"] },
  { key: "support.account_manager", name: "Dedicated account manager", module: "Support", enforcedAt: null, defaults: ["ENTERPRISE"] }
] as const;

const flagCreateSchema = z.object({
  key: z.string().trim().min(2).regex(/^[a-z0-9_.-]+$/, "Use lowercase letters, numbers, dots, dashes and underscores."),
  name: z.string().trim().min(2),
  description: z.string().trim().optional(),
  area: z.string().trim().optional().transform((v) => v || undefined),
  ownerId: z.string().trim().optional().transform((v) => v || undefined),
  exitCriteria: z.string().trim().optional().transform((v) => v || undefined),
  observationDays: z.coerce.number().int().min(0).max(90).default(7)
});
const flagAdvanceSchema = z.object({
  rolloutStatus: z.enum(STAGES),
  rolloutPercent: z.coerce.number().int().min(0).max(100).optional(),
  pilotSchoolIds: z.preprocess((v) => (Array.isArray(v) ? v : typeof v === "string" && v ? v.split(",") : undefined), z.array(z.string()).optional()),
  note: z.string().trim().optional(),
  skipWindowReason: z.string().trim().optional()
});
const flagReasonSchema = z.object({ reason: z.string().trim().min(5, "Say why this is being rolled back.") });
const flagEditSchema = z.object({
  area: z.string().trim().optional(),
  ownerId: z.string().trim().optional(),
  exitCriteria: z.string().trim().optional(),
  observationDays: z.coerce.number().int().min(0).max(90).optional()
});
const matrixSchema = z.object({
  featureKey: z.enum(FEATURE_REGISTRY.map((row) => row.key) as [string, ...string[]]),
  BASIC: z.preprocess((v) => v === true || v === "true", z.boolean()),
  STANDARD: z.preprocess((v) => v === true || v === "true", z.boolean()),
  PROFESSIONAL: z.preprocess((v) => v === true || v === "true", z.boolean()),
  ENTERPRISE: z.preprocess((v) => v === true || v === "true", z.boolean()),
  CUSTOM: z.preprocess((v) => v === true || v === "true", z.boolean()),
  reason: z.string().trim().min(5, "Say why access is changing."),
  migrationPlan: z.string().trim().optional()
});
const lifecycleSchema = z.object({
  lifecycle: z.enum(["DRAFT", "ACTIVE", "LEGACY", "ARCHIVED"]),
  migrateToPlanId: z.string().trim().optional().transform((v) => v || undefined)
});
const priceSchema = z.object({
  newMonthly: z.coerce.number().min(0),
  newAnnual: z.coerce.number().min(0),
  effectiveAt: z.coerce.date(),
  reason: z.string().trim().min(5, "Say why the price is changing.")
});

const asStage = (value: string): Stage => ((STAGES as readonly string[]).includes(value) ? (value as Stage) : "OFF");
const tierOfPlan = (plan: string) => plan as Tier;

@Injectable()
export class PlansFeaturesService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("PlansFeatures");
  private timer: NodeJS.Timeout | null = null;

  onModuleInit() {
    if (process.env.PLANS_SCHEDULER === "off") return;
    // Price changes and exceptions run out on a date; check hourly so none sits past its time for long.
    this.timer = setInterval(() => void this.tick().catch((error) => this.log.error(error)), 3_600_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    const prices = await this.applyDuePriceChanges();
    const expired = await this.expireOverrides();
    return { prices, expired };
  }

  private async audit(session: SessionPayload | null, action: AuditAction, entityType: string, entityId: string, metadata: Prisma.InputJsonValue, schoolId?: string | null) {
    const actor = session ? await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true } }) : null;
    await prisma.auditLog.create({ data: { schoolId: schoolId ?? null, actorId: actor?.id ?? null, action, entityType, entityId, metadata } });
  }

  private async actorId(session: SessionPayload) {
    return (await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true } }))?.id ?? null;
  }

  private async tellOwners(schoolIds: string[], title: string, body: string) {
    if (!schoolIds.length) return 0;
    const owners = await prisma.user.findMany({ where: { schoolId: { in: schoolIds }, isActive: true, deletedAt: null, role: { in: [...OWNER_ROLES] } }, select: { id: true, schoolId: true } });
    if (owners.length) await prisma.notificationLog.createMany({ data: owners.map((owner) => ({ schoolId: owner.schoolId, userId: owner.id, channel: "IN_APP" as const, title, body, status: "QUEUED", sentAt: new Date() })) });
    return new Set(owners.map((owner) => owner.schoolId)).size;
  }

  /* ───────────────────────── entitlements ───────────────────────── */

  /** Seeds the matrix from the registry's defaults the first time anything asks. */
  private async seedMatrix() {
    if (await prisma.tierFeature.count()) return;
    await prisma.tierFeature.createMany({
      data: FEATURE_REGISTRY.map((feature) => ({
        name: feature.name, module: feature.module, featureKey: feature.key,
        starterAccess: (feature.defaults as readonly string[]).includes("BASIC"),
        standardAccess: (feature.defaults as readonly string[]).includes("STANDARD"),
        professionalAccess: (feature.defaults as readonly string[]).includes("PROFESSIONAL"),
        eliteAccess: (feature.defaults as readonly string[]).includes("ENTERPRISE"),
        customAccess: (feature.defaults as readonly string[]).includes("CUSTOM")
      })),
      skipDuplicates: true
    });
  }

  /** What a school may use: its tier's column of the matrix, then any approved exception that grants or restricts the same key. */
  async entitled(schoolId: string, featureKey: string): Promise<{ allowed: boolean; why: string }> {
    await this.seedMatrix();
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { plan: true } });
    if (!school) return { allowed: false, why: "School not found." };
    const feature = await prisma.tierFeature.findFirst({ where: { featureKey } });
    const tierAllows = feature ? Boolean(feature[TIER_COLUMN[tierOfPlan(school.plan)]]) : false;
    const override = await prisma.platformFeatureFlagOverride.findFirst({
      where: { schoolId, status: "APPROVED", flag: { key: featureKey }, OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }] },
      orderBy: { createdAt: "desc" }
    });
    if (override) return override.overrideStatus === "RESTRICTED" ? { allowed: false, why: "Restricted for this school by an approved exception." } : { allowed: true, why: "Granted to this school by an approved exception." };
    return tierAllows ? { allowed: true, why: `Included in the ${school.plan.toLowerCase()} plan.` } : { allowed: false, why: `Not included in the ${school.plan.toLowerCase()} plan.` };
  }

  /** Is a rolled-out flag on for this school? Pilot is by name, partial is by a stable hash, full is everyone — exceptions win over all three. */
  async flagOn(schoolId: string, flagKey: string): Promise<boolean> {
    const flag = await prisma.platformFeatureFlag.findUnique({ where: { key: flagKey } });
    if (!flag) return false;
    const override = await prisma.platformFeatureFlagOverride.findFirst({ where: { schoolId, flagId: flag.id, status: "APPROVED", OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }] }, orderBy: { createdAt: "desc" } });
    if (override) return override.overrideStatus !== "RESTRICTED";
    if (flag.rolloutStatus === "FULL") return true;
    if (flag.rolloutStatus === "PILOT") return flag.pilotSchoolIds.includes(schoolId);
    if (flag.rolloutStatus === "PARTIAL") {
      let hash = 0;
      for (const char of `${flagKey}:${schoolId}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
      return hash % 100 < flag.rolloutPercent;
    }
    return false;
  }

  /** Everything a school can see about what it may use — for the school's own app. */
  async forSchool(schoolId: string) {
    await this.seedMatrix();
    const [features, flags] = await Promise.all([prisma.tierFeature.findMany({ where: { featureKey: { not: null } }, orderBy: { name: "asc" } }), prisma.platformFeatureFlag.findMany({ orderBy: { key: "asc" } })]);
    const resolved = await Promise.all(features.map(async (feature) => ({ key: feature.featureKey!, name: feature.name, ...(await this.entitled(schoolId, feature.featureKey!)) })));
    const flagStates = await Promise.all(flags.map(async (flag) => ({ key: flag.key, name: flag.name, on: await this.flagOn(schoolId, flag.key) })));
    return { features: resolved, flags: flagStates };
  }

  /** Throws the sentence a person will read when their plan does not include what they tried to use. */
  async require(schoolId: string, featureKey: string) {
    const result = await this.entitled(schoolId, featureKey);
    if (!result.allowed) {
      const name = FEATURE_REGISTRY.find((row) => row.key === featureKey)?.name ?? featureKey;
      throw new BadRequestException(`${name}: ${result.why} Move the school to a plan that has it, or approve an exception for it.`);
    }
  }

  /* ───────────────────────── feature flags ───────────────────────── */

  async createFlag(session: SessionPayload, body: unknown) {
    const input = flagCreateSchema.parse(body);
    if (await prisma.platformFeatureFlag.findUnique({ where: { key: input.key } })) throw new BadRequestException(`A flag with the key ${input.key} already exists.`);
    if (input.ownerId && !(await prisma.user.findFirst({ where: { id: input.ownerId, deletedAt: null } }))) throw new BadRequestException("That owner is not a person on the platform.");
    const flag = await prisma.platformFeatureFlag.create({ data: { key: input.key, name: input.name, description: input.description, area: input.area, ownerId: input.ownerId, exitCriteria: input.exitCriteria, observationDays: input.observationDays, createdById: await this.actorId(session) } });
    await prisma.featureFlagStage.create({ data: { flagId: flag.id, fromStage: "OFF", toStage: "OFF", note: "Created", byId: await this.actorId(session) } });
    await this.audit(session, AuditAction.CREATE, "PlatformFeatureFlag", flag.id, { key: flag.key, area: flag.area, ownerId: flag.ownerId });
    return flag;
  }

  async editFlag(session: SessionPayload, flagId: string, body: unknown) {
    const input = flagEditSchema.parse(body);
    const flag = await prisma.platformFeatureFlag.findUnique({ where: { id: flagId } });
    if (!flag) throw new NotFoundException("Flag not found.");
    await prisma.platformFeatureFlag.update({ where: { id: flagId }, data: { ...(input.area !== undefined ? { area: input.area || null } : {}), ...(input.ownerId !== undefined ? { ownerId: input.ownerId || null } : {}), ...(input.exitCriteria !== undefined ? { exitCriteria: input.exitCriteria || null } : {}), ...(input.observationDays !== undefined ? { observationDays: input.observationDays } : {}) } });
    await this.audit(session, AuditAction.UPDATE, "PlatformFeatureFlag", flagId, { edited: input as Prisma.InputJsonValue });
    return { id: flagId };
  }

  /**
   * Moving a flag up a stage. The stage it is in has to have run its observation window, and the person moving it says
   * which exit criterion was met; a Super Admin can skip the window by saying why. Moving down is always allowed.
   */
  async advanceFlag(session: SessionPayload, flagId: string, body: unknown) {
    const input = flagAdvanceSchema.parse(body);
    const flag = await prisma.platformFeatureFlag.findUnique({ where: { id: flagId } });
    if (!flag) throw new NotFoundException("Flag not found.");
    const from = asStage(flag.rolloutStatus);
    const to = input.rolloutStatus;
    const up = STAGES.indexOf(to) > STAGES.indexOf(from);
    const daysIn = (Date.now() - flag.stageStartedAt.getTime()) / DAY;
    if (up) {
      if (from !== "OFF" && daysIn < flag.observationDays) {
        const mayWaive = ["PLATFORM_OWNER", "SUPER_ADMIN"].includes(String(session.role));
        if (!(mayWaive && input.skipWindowReason && input.skipWindowReason.length >= 10)) {
          throw new BadRequestException(`${flag.name} has been in ${from.toLowerCase()} for ${Math.floor(daysIn)} of the ${flag.observationDays} days it must be watched first. ${mayWaive ? "To move it sooner, say why in the waiver field." : "A Super Admin can waive the window."}`);
        }
      }
      if (to !== "PILOT" && !(input.note && input.note.length >= 5)) throw new BadRequestException("Say which exit criterion was met before moving this flag up.");
      if (!flag.exitCriteria && from === "OFF") throw new BadRequestException("Write the flag's exit criteria first (Edit flag) — a stage needs something to be measured against.");
    }
    const percent = to === "FULL" ? 100 : to === "OFF" ? 0 : to === "PARTIAL" ? (input.rolloutPercent ?? flag.rolloutPercent) : flag.rolloutPercent;
    if (to === "PARTIAL" && (percent <= 0 || percent >= 100)) throw new BadRequestException("A partial rollout needs a percentage between 1 and 99.");
    const pilot = input.pilotSchoolIds ?? flag.pilotSchoolIds;
    if (to === "PILOT" && pilot.length === 0) throw new BadRequestException("Name at least one pilot school.");
    const stageChanged = to !== from;
    const updated = await prisma.platformFeatureFlag.update({
      where: { id: flagId },
      data: { rolloutStatus: to, rolloutPercent: percent, pilotSchoolIds: to === "OFF" ? [] : pilot, enabledGlobally: to === "FULL", ...(stageChanged ? { stageStartedAt: new Date() } : {}) }
    });
    await prisma.featureFlagStage.create({ data: { flagId, fromStage: from, toStage: to, percent, note: [input.note, input.skipWindowReason ? `Observation window waived: ${input.skipWindowReason}` : null].filter(Boolean).join(" — ") || null, byId: await this.actorId(session) } });
    // Pilot schools are told when they are added — they are about to see something other schools do not.
    const added = to === "PILOT" ? pilot.filter((id) => !flag.pilotSchoolIds.includes(id)) : [];
    const told = await this.tellOwners(added, `You are in the pilot for “${flag.name}”`, `Future Realm is trying ${flag.name} with a small group of schools first, and yours is one of them. It may appear in your account over the next few days. If anything looks wrong, tell your Account Manager.`);
    await this.audit(session, AuditAction.UPDATE, "PlatformFeatureFlag", flagId, { from, to, percent, pilotAdded: added.length, pilotTold: told, waived: Boolean(input.skipWindowReason) });
    return { id: updated.id, rolloutStatus: updated.rolloutStatus, rolloutPercent: updated.rolloutPercent, pilotTold: told };
  }

  async rollbackFlag(session: SessionPayload, flagId: string, body: unknown) {
    const input = flagReasonSchema.parse(body ?? {});
    const flag = await prisma.platformFeatureFlag.findUnique({ where: { id: flagId } });
    if (!flag) throw new NotFoundException("Flag not found.");
    await prisma.platformFeatureFlag.update({ where: { id: flagId }, data: { rolloutStatus: "OFF", rolloutPercent: 0, enabledGlobally: false, pilotSchoolIds: [], stageStartedAt: new Date() } });
    await prisma.featureFlagStage.create({ data: { flagId, fromStage: flag.rolloutStatus, toStage: "OFF", percent: 0, note: `Rolled back — ${input.reason}`, byId: await this.actorId(session) } });
    await this.audit(session, AuditAction.UPDATE, "PlatformFeatureFlag", flagId, { instantRollback: true, reason: input.reason });
    return { id: flagId };
  }

  async listFlags() {
    const flags = await prisma.platformFeatureFlag.findMany({ include: { _count: { select: { overrides: true } }, stages: { orderBy: { createdAt: "desc" }, take: 3 } }, orderBy: { createdAt: "desc" } });
    const ownerIds = Array.from(new Set(flags.map((flag) => flag.ownerId).filter((id): id is string => Boolean(id))));
    const owners = new Map((await prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, firstName: true, lastName: true } })).map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    return flags.map((flag) => {
      const daysIn = Math.max(0, Math.floor((Date.now() - flag.stageStartedAt.getTime()) / DAY));
      return {
        id: flag.id, key: flag.key, name: flag.name, description: flag.description, enabledGlobally: flag.enabledGlobally, rolloutStatus: flag.rolloutStatus, rolloutPercent: flag.rolloutPercent,
        pilotSchoolCount: flag.pilotSchoolIds.length, pilotSchoolIds: flag.pilotSchoolIds, overrides: flag._count.overrides, createdAt: flag.createdAt.toISOString(), stageEnteredAt: flag.stageStartedAt.toISOString(),
        area: flag.area, owner: flag.ownerId ? (owners.get(flag.ownerId) ?? "Former team member") : null, ownerId: flag.ownerId, exitCriteria: flag.exitCriteria, observationDays: flag.observationDays,
        daysInStage: daysIn, windowOpensIn: Math.max(0, Math.ceil(flag.observationDays - (Date.now() - flag.stageStartedAt.getTime()) / DAY)),
        history: flag.stages.map((stage) => ({ from: stage.fromStage, to: stage.toStage, percent: stage.percent, note: stage.note, at: stage.createdAt.toISOString() }))
      };
    });
  }

  /* ───────────────────────── the tier matrix ───────────────────────── */

  async matrix() {
    await this.seedMatrix();
    const [features, changes, schoolsByPlan] = await Promise.all([
      prisma.tierFeature.findMany({ orderBy: [{ module: "asc" }, { name: "asc" }] }),
      prisma.tierFeatureChange.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
      prisma.school.groupBy({ by: ["plan"], where: { deletedAt: null }, _count: true })
    ]);
    const byId = new Map<string, string>();
    const actors = await prisma.user.findMany({ where: { id: { in: changes.map((c) => c.byId).filter((id): id is string => Boolean(id)) } }, select: { id: true, firstName: true, lastName: true } });
    for (const a of actors) byId.set(a.id, `${a.firstName} ${a.lastName}`);
    return {
      tiers: TIERS.map((tier) => ({ tier, schools: schoolsByPlan.find((row) => row.plan === tier)?._count ?? 0 })),
      features: features.map((f) => {
        const reg = FEATURE_REGISTRY.find((row) => row.key === f.featureKey);
        return { id: f.id, name: f.name, module: f.module, featureKey: f.featureKey, enforcedAt: reg?.enforcedAt ?? null, version: f.version, access: { BASIC: f.starterAccess, STANDARD: f.standardAccess, PROFESSIONAL: f.professionalAccess, ENTERPRISE: f.eliteAccess, CUSTOM: f.customAccess }, updatedAt: f.updatedAt.toISOString() };
      }),
      registry: FEATURE_REGISTRY.map((row) => ({ key: row.key, name: row.name, module: row.module, enforcedAt: row.enforcedAt })),
      changes: changes.map((c) => ({ id: c.id, feature: c.featureName, kind: c.kind, before: c.before, after: c.after, reason: c.reason, migrationPlan: c.migrationPlan, affectedSchools: c.affectedSchools, by: c.byId ? (byId.get(c.byId) ?? "—") : "System", at: c.createdAt.toISOString() }))
    };
  }

  async saveFeature(session: SessionPayload, body: unknown) {
    await this.seedMatrix();
    const input = matrixSchema.parse(body);
    const reg = FEATURE_REGISTRY.find((row) => row.key === input.featureKey)!;
    const existing = await prisma.tierFeature.findFirst({ where: { featureKey: input.featureKey } });
    const after = { BASIC: input.BASIC, STANDARD: input.STANDARD, PROFESSIONAL: input.PROFESSIONAL, ENTERPRISE: input.ENTERPRISE, CUSTOM: input.CUSTOM };
    const before = existing ? { BASIC: existing.starterAccess, STANDARD: existing.standardAccess, PROFESSIONAL: existing.professionalAccess, ENTERPRISE: existing.eliteAccess, CUSTOM: existing.customAccess } : null;
    const losing = before ? TIERS.filter((tier) => before[tier] && !after[tier]) : [];
    const affected = losing.length ? await prisma.school.count({ where: { deletedAt: null, plan: { in: losing as SubscriptionPlan[] } } }) : 0;
    // Taking something away from schools that are on those tiers needs a plan for them, written down.
    if (affected > 0 && !(input.migrationPlan && input.migrationPlan.length >= 10)) {
      throw new BadRequestException(`${affected} school${affected === 1 ? " is" : "s are"} on ${losing.map((t) => t.toLowerCase()).join(" / ")}, which would lose ${reg.name}. Write the migration plan (what they are offered instead, and when they are told) before removing it.`);
    }
    const data = { starterAccess: after.BASIC, standardAccess: after.STANDARD, professionalAccess: after.PROFESSIONAL, eliteAccess: after.ENTERPRISE, customAccess: after.CUSTOM };
    const saved = existing
      ? await prisma.tierFeature.update({ where: { id: existing.id }, data: { ...data, version: { increment: 1 } } })
      : await prisma.tierFeature.create({ data: { name: reg.name, module: reg.module, featureKey: reg.key, ...data } });
    const kind = !before ? "ADDED" : losing.length ? "ACCESS_REMOVED" : "ACCESS_CHANGED";
    await prisma.tierFeatureChange.create({ data: { featureName: reg.name, kind, before: before ?? Prisma.JsonNull, after, reason: input.reason, migrationPlan: input.migrationPlan || null, affectedSchools: affected, byId: await this.actorId(session) } });
    if (losing.length && affected > 0) {
      const schools = await prisma.school.findMany({ where: { deletedAt: null, plan: { in: losing as SubscriptionPlan[] } }, select: { id: true } });
      await this.tellOwners(schools.map((s) => s.id), `A change to what your plan includes: ${reg.name}`, `${reg.name} will no longer be part of your plan. ${input.migrationPlan}`);
    }
    await this.audit(session, AuditAction.SETTINGS_UPDATE, "TierFeature", saved.id, { feature: reg.key, before: before ?? null, after, affectedSchools: affected, reason: input.reason });
    return { id: saved.id, version: saved.version, affectedSchools: affected };
  }

  /* ───────────────────────── plans ───────────────────────── */

  private snapshot(plan: { name: string; slug: string; plan: string; monthlyPrice: Prisma.Decimal; annualPrice: Prisma.Decimal; studentLimit: number | null; staffLimit: number | null; smsUnitsPerMonth: number; emailSendsPerMonth: number; supportTier: string; apiAccess: boolean; customBranding: boolean; includedModules: Prisma.JsonValue; lifecycle: string }) {
    return { name: plan.name, slug: plan.slug, tier: plan.plan, monthlyPrice: Number(plan.monthlyPrice), annualPrice: Number(plan.annualPrice), studentLimit: plan.studentLimit, staffLimit: plan.staffLimit, sms: plan.smsUnitsPerMonth, email: plan.emailSendsPerMonth, support: plan.supportTier, api: plan.apiAccess, branding: plan.customBranding, modules: plan.includedModules, lifecycle: plan.lifecycle };
  }

  /** Writes the next version of a plan: the plan's own history, with who changed it and what. */
  async recordVersion(planId: string, summary: string, actorId: string | null) {
    const plan = await prisma.platformSubscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) return;
    const next = plan.version + 1;
    await prisma.$transaction([
      prisma.platformSubscriptionPlan.update({ where: { id: planId }, data: { version: next } }),
      prisma.planVersion.create({ data: { planId, version: next, snapshot: this.snapshot(plan) as Prisma.InputJsonValue, summary, changedById: actorId } })
    ]);
  }

  async subscribers(planId: string) {
    const plan = await prisma.platformSubscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException("Plan not found.");
    return { plan, count: await prisma.school.count({ where: { deletedAt: null, plan: plan.plan } }) };
  }

  async setLifecycle(session: SessionPayload, planId: string, body: unknown) {
    const input = lifecycleSchema.parse(body);
    const { plan, count } = await this.subscribers(planId);
    if (plan.lifecycle === input.lifecycle) throw new BadRequestException(`This plan is already ${input.lifecycle.toLowerCase()}.`);
    let migrated = 0;
    if (input.lifecycle === "ARCHIVED" && count > 0) {
      if (!input.migrateToPlanId) throw new BadRequestException(`${count} school${count === 1 ? " is" : "s are"} on this plan. Choose the plan to move them to before archiving it.`);
      const target = await prisma.platformSubscriptionPlan.findUnique({ where: { id: input.migrateToPlanId } });
      if (!target || target.id === plan.id || target.plan === plan.plan) throw new BadRequestException("Choose a different plan, on a different tier, to move the schools to.");
      if (target.lifecycle === "ARCHIVED" || target.lifecycle === "DRAFT") throw new BadRequestException("Schools can only be moved to a plan that is on offer.");
      const schools = await prisma.school.findMany({ where: { deletedAt: null, plan: plan.plan }, select: { id: true } });
      await prisma.school.updateMany({ where: { id: { in: schools.map((s) => s.id) } }, data: { plan: target.plan } });
      await prisma.auditLog.createMany({ data: schools.map((school) => ({ schoolId: school.id, actorId: null, action: AuditAction.BILLING_UPDATE, entityType: "School", entityId: school.id, metadata: { plan: target.plan, fromPlan: plan.plan, reason: `Plan “${plan.name}” was archived`, byPlanChange: true } as Prisma.InputJsonValue })) });
      await this.tellOwners(schools.map((s) => s.id), `Your plan has changed to ${target.name}`, `The ${plan.name} plan has been retired and your school has been moved to ${target.name}. Open Subscription & Billing to see what changed.`);
      migrated = schools.length;
    }
    const activating = input.lifecycle === "ACTIVE";
    if (activating) {
      // Only one plan per tier is on offer at a time; the one it replaces stays for the schools on it, or goes if none are.
      const others = await prisma.platformSubscriptionPlan.findMany({ where: { plan: plan.plan, id: { not: planId }, lifecycle: "ACTIVE" } });
      for (const other of others) {
        const stay = await prisma.school.count({ where: { deletedAt: null, plan: other.plan } });
        await prisma.platformSubscriptionPlan.update({ where: { id: other.id }, data: { isActive: false, lifecycle: stay > 0 ? "LEGACY" : "ARCHIVED" } });
      }
    }
    await prisma.platformSubscriptionPlan.update({ where: { id: planId }, data: { lifecycle: input.lifecycle, isActive: activating } });
    await this.recordVersion(planId, `Lifecycle ${plan.lifecycle} → ${input.lifecycle}${migrated ? ` · ${migrated} school${migrated === 1 ? "" : "s"} moved` : ""}`, await this.actorId(session));
    await this.audit(session, AuditAction.SETTINGS_UPDATE, "PlatformSubscriptionPlan", planId, { lifecycle: input.lifecycle, from: plan.lifecycle, migrated });
    return { id: planId, lifecycle: input.lifecycle, migrated };
  }

  /** A price change is announced and waits out the notice period; a plan nobody is on can be repriced at once. */
  async schedulePrice(session: SessionPayload, planId: string, body: unknown) {
    const input = priceSchema.parse(body);
    const { plan, count } = await this.subscribers(planId);
    const earliest = new Date(Date.now() + PRICE_NOTICE_DAYS * DAY);
    if (count > 0 && input.effectiveAt < earliest) throw new BadRequestException(`${count} school${count === 1 ? " is" : "s are"} on this plan, so a price change needs ${PRICE_NOTICE_DAYS} days' notice — the earliest date is ${earliest.toISOString().slice(0, 10)}.`);
    if (Number(plan.monthlyPrice) === input.newMonthly && Number(plan.annualPrice) === input.newAnnual) throw new BadRequestException("That is the price the plan already has.");
    if (await prisma.planPriceChange.findFirst({ where: { planId, status: "SCHEDULED" } })) throw new BadRequestException("A price change is already scheduled for this plan. Cancel it first.");
    const schools = await prisma.school.findMany({ where: { deletedAt: null, plan: plan.plan }, select: { id: true } });
    const told = await this.tellOwners(schools.map((s) => s.id), `Price change for the ${plan.name} plan`, `From ${input.effectiveAt.toISOString().slice(0, 10)} the ${plan.name} plan changes from ₦${Number(plan.monthlyPrice).toLocaleString("en-NG")} to ₦${input.newMonthly.toLocaleString("en-NG")} a month (₦${input.newAnnual.toLocaleString("en-NG")} a year). Until then your price is unchanged. ${input.reason}`);
    const row = await prisma.planPriceChange.create({ data: { planId, oldMonthly: plan.monthlyPrice, newMonthly: input.newMonthly, oldAnnual: plan.annualPrice, newAnnual: input.newAnnual, effectiveAt: input.effectiveAt, subscribersTold: told, reason: input.reason, createdById: await this.actorId(session) } });
    await this.audit(session, AuditAction.BILLING_UPDATE, "PlanPriceChange", row.id, { plan: plan.slug, from: Number(plan.monthlyPrice), to: input.newMonthly, effectiveAt: input.effectiveAt.toISOString(), schoolsTold: told });
    if (count === 0 && input.effectiveAt <= new Date()) await this.applyDuePriceChanges();
    return { id: row.id, schoolsTold: told, effectiveAt: input.effectiveAt.toISOString() };
  }

  async cancelPrice(session: SessionPayload, id: string) {
    const row = await prisma.planPriceChange.findUnique({ where: { id } });
    if (!row || row.status !== "SCHEDULED") throw new BadRequestException("Only a scheduled price change can be cancelled.");
    await prisma.planPriceChange.update({ where: { id }, data: { status: "CANCELLED" } });
    await this.audit(session, AuditAction.BILLING_UPDATE, "PlanPriceChange", id, { cancelled: true });
    return { id };
  }

  /**
   * The date a school next renews — the start of its next term, because that is
   * what a renewal invoice is for. A school with no term calendar yet falls back
   * to a semester from today, so a lock is never open-ended.
   */
  private async renewsOn(schoolId: string): Promise<Date> {
    const today = new Date();
    const next = await prisma.term.findFirst({
      where: { schoolId, startDate: { gt: today } },
      orderBy: { startDate: "asc" },
      select: { startDate: true },
    });
    return next?.startDate ?? new Date(today.getTime() + 180 * DAY);
  }

  /**
   * Pin every school already on this plan to the rate they agreed, until they
   * renew.
   *
   * Without this a price change reaches everyone the moment it lands, including
   * schools part-way through a term they have already been invoiced for. A
   * school that has negotiated its own rate, or is already holding one, is left
   * alone: it has a price of its own and this is not it.
   */
  private async holdPriceForSubscribers(plan: SubscriptionPlan, oldMonthly: Prisma.Decimal, reason: string) {
    const schools = await prisma.school.findMany({ where: { deletedAt: null, plan }, select: { id: true } });
    let held = 0;
    for (const school of schools) {
      const sub = await prisma.schoolSubscription.findUnique({ where: { schoolId: school.id } });
      if (!sub) continue;
      if (sub.ratePerStudent !== null) continue;
      if (sub.priceLockedUntil && sub.priceLockedUntil > new Date()) continue;
      await prisma.schoolSubscription.update({
        where: { schoolId: school.id },
        data: {
          lockedMonthlyPrice: oldMonthly,
          priceLockedUntil: await this.renewsOn(school.id),
          priceLockReason: reason,
        },
      });
      held += 1;
    }
    return held;
  }

  async applyDuePriceChanges() {
    const due = await prisma.planPriceChange.findMany({ where: { status: "SCHEDULED", effectiveAt: { lte: new Date() } } });
    for (const change of due) {
      const plan = await prisma.platformSubscriptionPlan.findUnique({ where: { id: change.planId }, select: { plan: true, name: true } });
      // Hold the old price for everyone on the plan BEFORE the plan moves, so
      // what they are pinned at is the price they were actually sold.
      const held = plan
        ? await this.holdPriceForSubscribers(plan.plan, change.oldMonthly, `Held at the ${plan.name} price agreed before the change of ${change.effectiveAt.toISOString().slice(0, 10)}`)
        : 0;
      await prisma.platformSubscriptionPlan.update({ where: { id: change.planId }, data: { monthlyPrice: change.newMonthly, annualPrice: change.newAnnual } });
      await this.recordVersion(change.planId, `Price ₦${Number(change.oldMonthly).toLocaleString("en-NG")} → ₦${Number(change.newMonthly).toLocaleString("en-NG")} a month${change.reason ? ` — ${change.reason}` : ""}${held ? ` · ${held} school${held === 1 ? "" : "s"} held at the old price until renewal` : ""}`, change.createdById);
      await prisma.planPriceChange.update({ where: { id: change.id }, data: { status: "APPLIED", appliedAt: new Date() } });
    }
    return due.length;
  }

  /** Every school currently holding a price, for the Plans page. */
  async priceLocks() {
    const rows = await prisma.schoolSubscription.findMany({
      where: { priceLockedUntil: { gt: new Date() }, lockedMonthlyPrice: { not: null } },
      select: { schoolId: true, tier: true, lockedMonthlyPrice: true, priceLockedUntil: true, priceLockReason: true, school: { select: { name: true, plan: true } } },
      orderBy: { priceLockedUntil: "asc" },
    });
    return rows.map((row) => ({
      schoolId: row.schoolId,
      school: row.school.name,
      plan: row.school.plan as string,
      tier: row.tier,
      heldAt: Number(row.lockedMonthlyPrice),
      until: row.priceLockedUntil!.toISOString(),
      reason: row.priceLockReason,
    }));
  }

  /** Release a held price early — the school picks the current rate up at once. */
  async releasePriceLock(session: SessionPayload, schoolId: string) {
    const sub = await prisma.schoolSubscription.findUnique({ where: { schoolId }, select: { lockedMonthlyPrice: true, priceLockedUntil: true } });
    if (!sub?.priceLockedUntil || sub.priceLockedUntil <= new Date()) throw new BadRequestException("This school is not holding a price.");
    await prisma.schoolSubscription.update({ where: { schoolId }, data: { lockedMonthlyPrice: null, priceLockedUntil: null, priceLockReason: null } });
    await this.audit(session, AuditAction.BILLING_UPDATE, "SchoolSubscription", schoolId, { priceLockReleased: true, wasHeldAt: Number(sub.lockedMonthlyPrice) });
    return { schoolId, released: true };
  }

  /** An exception past its end date stops applying: it is marked expired, and the school is told. */
  async expireOverrides() {
    const lapsed = await prisma.platformFeatureFlagOverride.findMany({ where: { status: "APPROVED", expiryDate: { lte: new Date() } }, include: { flag: { select: { name: true } } } });
    for (const row of lapsed) {
      await prisma.platformFeatureFlagOverride.update({ where: { id: row.id }, data: { status: "EXPIRED", enabled: false } });
      await prisma.auditLog.create({ data: { schoolId: row.schoolId, actorId: null, action: AuditAction.UPDATE, entityType: "PlatformFeatureFlagOverride", entityId: row.id, metadata: { expired: true, automatic: true } } });
      await this.tellOwners([row.schoolId], `An exception for ${row.flag.name} has ended`, `The access your school was given outside its plan for ${row.flag.name} has reached its end date.`);
    }
    return lapsed.length;
  }

  /** The Plans page's overview: versions, scheduled prices, and how often schools move up or down. */
  async plansOverview() {
    const [versions, prices, plans, moves] = await Promise.all([
      prisma.planVersion.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
      prisma.planPriceChange.findMany({ orderBy: { announcedAt: "desc" }, take: 20 }),
      prisma.platformSubscriptionPlan.findMany({ select: { id: true, name: true, plan: true, lifecycle: true } }),
      prisma.auditLog.findMany({ where: { entityType: "School", action: { in: [AuditAction.BILLING_UPDATE, AuditAction.UPDATE] }, createdAt: { gte: new Date(Date.now() - 180 * DAY) } }, select: { metadata: true } })
    ]);
    const names = new Map(plans.map((plan) => [plan.id, plan.name]));
    const actors = await prisma.user.findMany({ where: { id: { in: [...versions.map((v) => v.changedById), ...prices.map((p) => p.createdById)].filter((id): id is string => Boolean(id)) } }, select: { id: true, firstName: true, lastName: true } });
    const who = new Map(actors.map((a) => [a.id, `${a.firstName} ${a.lastName}`]));
    // Upgrade and downgrade rates count only the moves that recorded where the school came from.
    const rates = TIERS.map((tier) => ({ tier, upgrades: 0, downgrades: 0 }));
    for (const move of moves) {
      const meta = (move.metadata ?? {}) as { plan?: string; fromPlan?: string };
      if (!meta.plan || !meta.fromPlan || meta.plan === meta.fromPlan) continue;
      const row = rates.find((r) => r.tier === meta.fromPlan);
      if (!row) continue;
      if ((TIER_RANK[meta.plan] ?? 0) > (TIER_RANK[meta.fromPlan] ?? 0)) row.upgrades += 1;
      else row.downgrades += 1;
    }
    return {
      versions: versions.map((v) => ({ id: v.id, plan: names.get(v.planId) ?? "A plan", version: v.version, summary: v.summary, by: v.changedById ? (who.get(v.changedById) ?? "—") : "System", at: v.createdAt.toISOString() })),
      prices: prices.map((p) => ({ id: p.id, plan: names.get(p.planId) ?? "A plan", planId: p.planId, oldMonthly: Number(p.oldMonthly), newMonthly: Number(p.newMonthly), oldAnnual: Number(p.oldAnnual), newAnnual: Number(p.newAnnual), announcedAt: p.announcedAt.toISOString(), effectiveAt: p.effectiveAt.toISOString(), status: p.status, told: p.subscribersTold, reason: p.reason, by: p.createdById ? (who.get(p.createdById) ?? "—") : "System" })),
      rates,
      noticeDays: PRICE_NOTICE_DAYS,
      lifecycle: Object.fromEntries(plans.map((plan) => [plan.id, plan.lifecycle]))
    };
  }

  /** The stage history across every flag, newest first. */
  async stageHistory() {
    const rows = await prisma.featureFlagStage.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { flag: { select: { name: true, key: true } } } });
    const actors = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.byId).filter((id): id is string => Boolean(id)) } }, select: { id: true, firstName: true, lastName: true } });
    const who = new Map(actors.map((a) => [a.id, `${a.firstName} ${a.lastName}`]));
    return rows.map((r) => ({ id: r.id, flag: r.flag.name, key: r.flag.key, from: r.fromStage, to: r.toStage, percent: r.percent, note: r.note, by: r.byId ? (who.get(r.byId) ?? "—") : "System", at: r.createdAt.toISOString() }));
  }
}

/** For code outside Nest's injection — the places that decide whether a school may use something. */
export const plansFeatures = new PlansFeaturesService();
