import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import {
  TIERS,
  currentTerm,
  nextInvoiceNo,
  nextTerm,
  rateOf,
  rollCount,
  schoolOf,
  taxRate,
  tierOf,
  type TierKey,
} from "./billing.shared";
import { termLabel } from "./term-label";
import {
  checkUpgradeWindow,
  directionOf,
  prorationBasis,
  proratedUpgradeCharge,
  round2,
  type TierDirection,
} from "./proration";

/**
 * Changing tier part-way through a term.
 *
 * The rule the whole module turns on: **an upgrade lands now, a downgrade lands
 * next term.** A school that wants more should have it the moment it pays for
 * it; a school that wants less has already paid for this term and keeps what it
 * bought until the term it paid for is over. The asymmetry is deliberate and is
 * the thing to preserve if any of this is changed later.
 */

const tierSchema = z.object({
  /** A tier key (ELITE) or its display name (Elite) — the UI sends either. */
  targetTier: z.string().min(1, "Choose the plan to change to."),
  reason: z.string().max(200).optional(),
});

export type MidtermPreview = {
  isUpgrade: boolean;
  direction: TierDirection;
  currentTier: { key: TierKey; name: string; rate: number };
  targetTier: { key: TierKey; name: string; rate: number };
  activeStudentCount: number;
  term: { id: string; label: string; startDate: string; endDate: string } | null;
  totalTermDays: number;
  remainingTermDays: number;
  prorationRatio: number;
  /** Nothing is due today on a downgrade or a change to the same tier. */
  immediateAmountDue: number;
  taxOnImmediate: number;
  immediateTotal: number;
  /** "Immediate" or "Next term". */
  effectiveDate: string;
  effectiveOn: string | null;
  /** What the school pays per term once the change has landed. */
  newTermlyAmount: number;
  termlyDifference: number;
  /** Set when the change cannot be made now, with the reason in plain words. */
  blocked: { code: string; message: string } | null;
};

@Injectable()
export class MidtermService {
  private async audit(session: SessionPayload, entityId: string, metadata: Record<string, unknown>) {
    await prisma.auditLog.create({
      data: {
        schoolId: session.schoolId,
        actorId: session.userId,
        action: AuditAction.UPDATE,
        entityType: "SchoolSubscription",
        entityId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  /** A tier key from whatever the caller sent — a key, or the name on screen. */
  private tierKey(value: string): TierKey {
    const keys = Object.keys(TIERS) as TierKey[];
    const direct = keys.find((key) => key === value.toUpperCase());
    if (direct) return direct;
    const named = keys.find((key) => value.startsWith(TIERS[key].name));
    if (!named) throw new BadRequestException(`"${value}" is not a plan.`);
    return named;
  }

  /**
   * What a change would cost, without making it.
   *
   * This is what the modal reads, and it is deliberately the same calculation
   * the write uses — the school should never be shown one figure and charged
   * another.
   */
  async preview(session: SessionPayload, targetTierInput: string): Promise<MidtermPreview> {
    const schoolId = session.schoolId;
    const school = await schoolOf(schoolId);
    if (!school) throw new NotFoundException("That school does not exist.");

    const target = this.tierKey(targetTierInput);
    const currentKey = tierOf(school);
    const oldRate = rateOf(school);
    const newRate = TIERS[target].rate;
    const direction = directionOf(oldRate, newRate);

    const term = await currentTerm(schoolId);
    const activeStudentCount = await rollCount(schoolId);
    const now = new Date();

    const basis = term
      ? prorationBasis({ startDate: term.startDate, endDate: term.endDate }, now)
      : { totalTermDays: 0, remainingTermDays: 0, prorationRatio: 0 };

    const isUpgrade = direction === "UPGRADE";
    const window = isUpgrade && term ? checkUpgradeWindow(basis.remainingTermDays) : ({ ok: true } as const);

    const immediateAmountDue =
      isUpgrade && term && window.ok
        ? proratedUpgradeCharge({
            activeStudentCount,
            oldRate,
            newRate,
            prorationRatio: basis.prorationRatio,
          })
        : 0;

    const rate = await taxRate(school.country);
    const taxOnImmediate = round2(immediateAmountDue * rate);

    const { next } = await nextTerm(schoolId);
    const effectiveNow = isUpgrade && window.ok && term;

    return {
      isUpgrade,
      direction,
      currentTier: { key: currentKey, name: TIERS[currentKey].name, rate: oldRate },
      targetTier: { key: target, name: TIERS[target].name, rate: newRate },
      activeStudentCount,
      term: term
        ? {
            id: term.id,
            label: termLabel(term),
            startDate: term.startDate.toISOString(),
            endDate: term.endDate.toISOString(),
          }
        : null,
      totalTermDays: basis.totalTermDays,
      remainingTermDays: basis.remainingTermDays,
      prorationRatio: basis.prorationRatio,
      immediateAmountDue,
      taxOnImmediate,
      immediateTotal: round2(immediateAmountDue + taxOnImmediate),
      effectiveDate: effectiveNow ? "Immediate" : "Next term",
      effectiveOn: effectiveNow ? now.toISOString() : (next?.startDate.toISOString() ?? null),
      newTermlyAmount: round2(activeStudentCount * newRate),
      termlyDifference: round2(activeStudentCount * (newRate - oldRate)),
      blocked: window.ok ? null : { code: window.code, message: window.message },
    };
  }

  /**
   * Make the change.
   *
   * Everything a change touches moves together or not at all: the ledger entry,
   * the invoice and the tier itself. A school billed for an upgrade whose tier
   * did not move — or moved without being billed — is the one outcome this must
   * never produce, so it is all one transaction.
   */
  async execute(session: SessionPayload, body: unknown) {
    const input = tierSchema.parse(body);
    const schoolId = session.schoolId;
    const preview = await this.preview(session, input.targetTier);

    if (preview.direction === "SAME") {
      throw new BadRequestException(`The school is already on ${preview.targetTier.name}.`);
    }
    if (preview.blocked) {
      throw new BadRequestException(preview.blocked.message);
    }

    const from = preview.currentTier.key;
    const to = preview.targetTier.key;

    if (preview.isUpgrade) {
      const result = await prisma.$transaction(async (tx) => {
        const subscription = await tx.schoolSubscription.upsert({
          where: { schoolId },
          update: {
            tier: to,
            // An upgrade overtakes anything that was scheduled: the school is
            // on the new tier now, so a pending change to it is spent.
            ...(preview.targetTier.key === to ? { pendingTier: null, pendingFrom: null } : {}),
            status: "ACTIVE",
            switchReason: input.reason ?? null,
          },
          create: { schoolId, tier: to, status: "ACTIVE", switchReason: input.reason ?? null },
        });

        const invoice =
          preview.immediateAmountDue > 0
            ? await tx.platformInvoice.create({
                data: {
                  schoolId,
                  invoiceNo: await nextInvoiceNo(),
                  amount: preview.immediateAmountDue,
                  taxAmount: preview.taxOnImmediate,
                  status: "PENDING",
                  dueAt: new Date(),
                  metadata: {
                    kind: "ONE_OFF",
                    reason: "MIDTERM_UPGRADE",
                    fromTier: from,
                    toTier: to,
                    termId: preview.term?.id ?? null,
                    students: preview.activeStudentCount,
                    prorationRatio: preview.prorationRatio,
                  } as Prisma.InputJsonValue,
                },
              })
            : null;

        const ledger = await tx.billingLedger.create({
          data: {
            schoolId,
            subscriptionId: subscription.id,
            termId: preview.term?.id ?? null,
            type: "MIDTERM_UPGRADE_CHARGE",
            amount: preview.immediateAmountDue,
            studentCountSnapshot: preview.activeStudentCount,
            prorationRatio: preview.prorationRatio,
            fromTier: from,
            toTier: to,
            invoiceId: invoice?.id ?? null,
            createdById: session.userId,
            description:
              `Upgrade ${TIERS[from].name} to ${TIERS[to].name} for the rest of ` +
              `${preview.term ? preview.term.label : "the term"} — ` +
              `${preview.activeStudentCount} students x ${round2(preview.targetTier.rate - preview.currentTier.rate)} ` +
              `x ${preview.remainingTermDays}/${preview.totalTermDays} days`,
          },
        });

        return { subscription, invoice, ledger };
      });

      await this.audit(session, schoolId, {
        summary: `Plan upgraded · ${TIERS[from].name} to ${TIERS[to].name}`,
        effective: "Immediate",
        students: preview.activeStudentCount,
        prorationRatio: preview.prorationRatio,
        amount: preview.immediateAmountDue,
        invoiceNo: result.invoice?.invoiceNo ?? null,
      });

      return {
        applied: "IMMEDIATE" as const,
        tier: TIERS[to].name,
        amountDue: preview.immediateAmountDue,
        tax: preview.taxOnImmediate,
        total: preview.immediateTotal,
        invoiceId: result.invoice?.id ?? null,
        invoiceNo: result.invoice?.invoiceNo ?? null,
        ledgerId: result.ledger.id,
        note:
          preview.immediateAmountDue > 0
            ? "The school is on the new plan now. The prorated difference is invoiced for the rest of this term."
            : "The school is on the new plan now. Nothing is owed for the rest of this term.",
      };
    }

    // A downgrade: scheduled, never applied here.
    const { next } = await nextTerm(schoolId);
    const effectiveOn = next?.startDate ?? null;
    if (!effectiveOn) {
      throw new BadRequestException(
        "There is no next term on the calendar yet, so a downgrade has nothing to take effect from. Add next term's dates in School Configuration first.",
      );
    }

    await prisma.schoolSubscription.upsert({
      where: { schoolId },
      update: {
        pendingTier: to,
        pendingFrom: effectiveOn,
        status: "PENDING_DOWNGRADE",
        switchReason: input.reason ?? null,
      },
      create: {
        schoolId,
        tier: from,
        pendingTier: to,
        pendingFrom: effectiveOn,
        status: "PENDING_DOWNGRADE",
        switchReason: input.reason ?? null,
      },
    });

    await this.audit(session, schoolId, {
      summary: `Plan downgrade scheduled · ${TIERS[from].name} to ${TIERS[to].name}`,
      effective: effectiveOn.toISOString(),
      reason: input.reason ?? null,
    });

    return {
      applied: "SCHEDULED" as const,
      tier: TIERS[to].name,
      effectiveOn: effectiveOn.toISOString(),
      amountDue: 0,
      note: `The school stays on ${TIERS[from].name} for the rest of this term. ${TIERS[to].name} starts on the first day of next term, and nothing is charged for the change.`,
    };
  }

  /** Change of mind, before the term turns over. */
  async cancelPendingDowngrade(session: SessionPayload) {
    const schoolId = session.schoolId;
    const subscription = await prisma.schoolSubscription.findUnique({ where: { schoolId } });
    if (!subscription?.pendingTier) {
      throw new BadRequestException("No plan change is scheduled, so there is nothing to withdraw.");
    }

    await prisma.schoolSubscription.update({
      where: { schoolId },
      data: { pendingTier: null, pendingFrom: null, switchReason: null, status: "ACTIVE" },
    });

    await this.audit(session, schoolId, {
      summary: "Scheduled plan change withdrawn",
      wasPending: subscription.pendingTier,
    });

    const school = await schoolOf(schoolId);
    return {
      tier: school ? TIERS[tierOf(school)].name : subscription.tier,
      note: "The scheduled change is withdrawn. The school stays on its current plan.",
    };
  }

  /** What the school was charged and why — the ledger, newest first. */
  async ledger(session: SessionPayload) {
    const rows = await prisma.billingLedger.findMany({
      where: { schoolId: session.schoolId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { term: { include: { academicSession: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      amount: Number(row.amount),
      studentCountSnapshot: row.studentCountSnapshot,
      prorationRatio: Number(row.prorationRatio),
      fromTier: row.fromTier ? (TIERS[row.fromTier as TierKey]?.name ?? row.fromTier) : null,
      toTier: row.toTier ? (TIERS[row.toTier as TierKey]?.name ?? row.toTier) : null,
      description: row.description,
      term: row.term ? termLabel(row.term) : null,
      invoiceId: row.invoiceId,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
