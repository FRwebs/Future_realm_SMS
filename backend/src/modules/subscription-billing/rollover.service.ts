import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { prisma } from "../../../../src/lib/db/prisma";
import {
  TIERS,
  nextInvoiceNo,
  rollCount,
  taxRate,
  type TierKey,
} from "./billing.shared";
import { termLabel } from "./term-label";
import { round2 } from "./proration";

/**
 * Turning the term over.
 *
 * A downgrade is a promise made during one term and kept at the start of the
 * next, so something has to be awake at the boundary to keep it. This is that
 * something: it finds the subscriptions whose scheduled change has come due,
 * moves them onto the tier they asked for, and bills the new term at the new
 * rate.
 *
 * It runs on an interval rather than a cron daemon because the rest of this
 * product's background work does (see the delivery worker), and because the job
 * is idempotent — a term that has already been billed is skipped — so running
 * it more often than necessary costs nothing and missing a window costs
 * nothing either.
 */
@Injectable()
export class TermRolloverService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(TermRolloverService.name);
  private timer: NodeJS.Timeout | null = null;

  private get enabled() {
    return process.env.TERM_ROLLOVER_ENABLED !== "false";
  }

  onModuleInit() {
    if (!this.enabled) {
      this.log.warn("TERM_ROLLOVER_ENABLED is false; scheduled plan changes will not be applied.");
      return;
    }
    const minutes = Number(process.env.TERM_ROLLOVER_INTERVAL_MINUTES || 60);
    this.timer = setInterval(
      () => void this.run().catch((error) => this.log.error(error)),
      Math.max(1, minutes) * 60_000,
    );
    this.timer.unref();
    // Once at boot as well: a server that was down over a term boundary should
    // keep the promise as soon as it is back, not at the top of the next hour.
    void this.run().catch((error) => this.log.error(error));
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Apply every scheduled change that has come due.
   *
   * Returns what it did, so the same method can be called from a test or by
   * hand without waiting an hour for the timer.
   */
  async run(now = new Date()) {
    const due = await prisma.schoolSubscription.findMany({
      where: { pendingTier: { not: null }, pendingFrom: { lte: now } },
      select: { id: true, schoolId: true, tier: true, pendingTier: true, pendingFrom: true },
    });

    const applied: Array<{ schoolId: string; from: string; to: string; billed: number | null }> = [];

    for (const subscription of due) {
      try {
        const result = await this.applyOne(subscription, now);
        if (result) applied.push(result);
      } catch (error) {
        // One school's bad calendar must not stop every other school's rollover.
        this.log.error(`Rollover failed for school ${subscription.schoolId}: ${String(error)}`);
      }
    }

    if (applied.length) {
      this.log.log(`Applied ${applied.length} scheduled plan change(s) at term rollover.`);
    }
    return { checked: due.length, applied };
  }

  private async applyOne(
    subscription: { id: string; schoolId: string; tier: string; pendingTier: string | null; pendingFrom: Date | null },
    now: Date,
  ) {
    const { schoolId } = subscription;
    const to = subscription.pendingTier as TierKey | null;
    if (!to || !(to in TIERS)) return null;
    const from = subscription.tier as TierKey;

    // The term the change takes effect in: the one running at pendingFrom.
    const term = await prisma.term.findFirst({
      where: { schoolId, startDate: { lte: subscription.pendingFrom ?? now }, endDate: { gte: subscription.pendingFrom ?? now } },
      include: { academicSession: true },
      orderBy: { startDate: "desc" },
    });

    // VAT follows the school's country, as it does everywhere else that bills.
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { country: true } });
    const students = await rollCount(schoolId);
    const rate = TIERS[to].rate;
    const amount = round2(students * rate);
    const tax = round2(amount * (await taxRate(school?.country ?? null)));

    // Billed already? A rollover that runs twice must not invoice twice.
    const alreadyBilled = term
      ? await prisma.billingLedger.count({
          where: { schoolId, termId: term.id, type: "INITIAL_BILL" },
        })
      : 0;

    const invoiceNo = alreadyBilled ? null : await nextInvoiceNo();

    await prisma.$transaction(async (tx) => {
      await tx.schoolSubscription.update({
        where: { id: subscription.id },
        data: {
          tier: to,
          pendingTier: null,
          pendingFrom: null,
          switchReason: null,
          status: "ACTIVE",
          // The rate follows the tier unless the school holds a negotiated one.
          ratePerStudent: null,
          baseSms: TIERS[to].baseSms,
          baseWhatsapp: TIERS[to].baseWhatsapp,
        },
      });

      if (alreadyBilled || !invoiceNo) return;

      const invoice = await tx.platformInvoice.create({
        data: {
          schoolId,
          invoiceNo,
          amount,
          taxAmount: tax,
          status: "PENDING",
          dueAt: term?.startDate ?? now,
          metadata: {
            kind: "TERMLY",
            reason: "TERM_ROLLOVER",
            fromTier: from,
            toTier: to,
            termId: term?.id ?? null,
            students,
          } as Prisma.InputJsonValue,
        },
      });

      await tx.billingLedger.create({
        data: {
          schoolId,
          subscriptionId: subscription.id,
          termId: term?.id ?? null,
          type: "INITIAL_BILL",
          amount,
          studentCountSnapshot: students,
          prorationRatio: 1,
          fromTier: from,
          toTier: to,
          invoiceId: invoice.id,
          description:
            `${TIERS[to].name} for ${term ? termLabel(term) : "the new term"} — ` +
            `${students} students x ${rate} per student`,
        },
      });
    });

    return { schoolId, from: TIERS[from]?.name ?? from, to: TIERS[to].name, billed: alreadyBilled ? null : amount };
  }
}
