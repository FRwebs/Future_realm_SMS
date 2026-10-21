import { AuditAction, type SubscriptionPlan } from "@prisma/client";

import { prisma } from "../../../../src/lib/db/prisma";
import { PLAN_TO_TIER, TIERS, type TierKey } from "../subscription-billing/billing.shared";

/**
 * A school's plan is held in two places that were written separately: `School.plan` (the five plans the Back Office sells and the
 * feature matrix is read from) and `SchoolSubscription.tier` (the three tiers the school is billed on). Left alone they drift —
 * the Back Office moves a school to Professional and the school still sees, and pays for, Standard. These helpers are the only
 * way either side should change a plan, so the other follows.
 */

const TIER_TO_PLAN: Record<TierKey, SubscriptionPlan> = { STANDARD: "STANDARD", PREMIUM: "PROFESSIONAL", ELITE: "ENTERPRISE" };

export const tierForPlan = (plan: string): TierKey => PLAN_TO_TIER[plan] ?? "STANDARD";

/**
 * The plan to record when a tier takes effect. A plan that already maps to that tier is kept (Basic stays Basic). Custom is never
 * rewritten: it is how a negotiated arrangement or a discount is marked, and a tier switch must not quietly undo it.
 */
export const planForTier = (tier: TierKey, current: string): SubscriptionPlan => (current === "CUSTOM" || tierForPlan(current) === tier ? (current as SubscriptionPlan) : TIER_TO_PLAN[tier]);

/** The Back Office changed `School.plan`: bring the school's own billing tier with it, and drop a pending switch that is now moot. */
export async function alignTierToPlan(schoolId: string, plan: string) {
  // Custom marks a negotiated price or a concession, not a billing tier — moving a school to it must not re-rate its invoices.
  if (plan === "CUSTOM") return;
  const sub = await prisma.schoolSubscription.findUnique({ where: { schoolId }, select: { tier: true, pendingTier: true } });
  if (!sub) return;
  const tier = tierForPlan(plan);
  if (sub.tier === tier && sub.pendingTier !== tier) return;
  await prisma.schoolSubscription.update({
    where: { schoolId },
    data: { tier, ...(sub.pendingTier === tier ? { pendingTier: null, pendingFrom: null, switchReason: null } : {}) }
  });
}

/**
 * A tier switch the school scheduled has reached its date: make it the tier, and move `School.plan` to match. Until now the
 * pending switch only changed the next invoice — the tier itself never moved, so the Back Office kept showing the old plan.
 */
export async function applyDueTierSwitches(schoolId?: string): Promise<number> {
  const due = await prisma.schoolSubscription.findMany({
    where: { pendingTier: { not: null }, pendingFrom: { lte: new Date() }, ...(schoolId ? { schoolId } : {}) },
    include: { school: { select: { id: true, plan: true } } }
  });
  let applied = 0;
  for (const row of due) {
    const tier = row.pendingTier as TierKey;
    if (!(tier in TIERS)) {
      await prisma.schoolSubscription.update({ where: { schoolId: row.schoolId }, data: { pendingTier: null, pendingFrom: null, switchReason: null } });
      continue;
    }
    const plan = planForTier(tier, row.school.plan);
    await prisma.$transaction([
      prisma.schoolSubscription.update({ where: { schoolId: row.schoolId }, data: { tier, pendingTier: null, pendingFrom: null, switchReason: null } }),
      prisma.school.update({ where: { id: row.schoolId }, data: { plan } }),
      prisma.auditLog.create({
        data: {
          schoolId: row.schoolId, actorId: null, action: AuditAction.BILLING_UPDATE, entityType: "School", entityId: row.schoolId,
          metadata: { plan, fromPlan: row.school.plan, tier, fromTier: row.tier, reason: row.switchReason ?? "Scheduled plan switch took effect", byPlanSwitch: true }
        }
      })
    ]);
    applied += 1;
  }
  return applied;
}
