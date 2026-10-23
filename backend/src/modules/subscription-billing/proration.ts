/**
 * What a mid-term tier change costs.
 *
 * Future Realm bills per student per term, so a tier change part-way through a
 * term is only fair if the school pays the difference for the part of the term
 * it has not used yet. That is the whole of the arithmetic here — deliberately
 * pure, with no database and no clock of its own, because the one thing a
 * school will question is this number, and a number you cannot test in
 * isolation is a number you cannot defend.
 */

/** Below this, a part-term upgrade is not worth charging for. */
export const MIN_UPGRADE_DAYS = 7;

export const MS_PER_DAY = 86_400_000;

/** Midnight UTC, so a term's length is whole days rather than hours-since-now. */
export function startOfDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

/**
 * Whole days from one date to another, counting neither partial day twice.
 *
 * A term that runs 1 January to 31 March is 90 days long, not 89: a school has
 * the use of the last day.
 */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

export type TermWindow = { startDate: Date; endDate: Date };

export type ProrationBasis = {
  /** Days in the whole term — the denominator. */
  totalTermDays: number;
  /** Days the school has not used yet, including today. */
  remainingTermDays: number;
  /** remainingTermDays / totalTermDays, 0 to 1. */
  prorationRatio: number;
};

/**
 * How much of a term is still to come.
 *
 * Today counts as remaining: a school upgrading this morning gets today's use
 * of the higher tier, so it pays for today.
 */
export function prorationBasis(term: TermWindow, now: Date): ProrationBasis {
  const totalTermDays = Math.max(1, daysBetween(term.startDate, term.endDate) + 1);
  const rawRemaining = daysBetween(now, term.endDate) + 1;
  const remainingTermDays = Math.min(totalTermDays, Math.max(0, rawRemaining));
  return {
    totalTermDays,
    remainingTermDays,
    prorationRatio: round5(remainingTermDays / totalTermDays),
  };
}

/** Five places, because the ratio is stored as DECIMAL(6,5) and must round-trip. */
export function round5(value: number): number {
  return Math.round(value * 100_000) / 100_000;
}

export const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * The charge for moving up a tier for the rest of the term.
 *
 * Only the *difference* between the rates is charged: the school has already
 * paid the old rate for this term, and charging the full new rate again would
 * bill it twice for the same days.
 */
export function proratedUpgradeCharge(input: {
  activeStudentCount: number;
  oldRate: number;
  newRate: number;
  prorationRatio: number;
}): number {
  const difference = input.newRate - input.oldRate;
  if (difference <= 0) return 0;
  return round2(input.activeStudentCount * difference * input.prorationRatio);
}

export type GuardrailResult = { ok: true } | { ok: false; code: string; message: string };

/**
 * Whether a part-term upgrade may be charged at all.
 *
 * With almost none of the term left there is nothing worth billing, and the
 * school would be charged for days it cannot use — so the upgrade is refused
 * and pointed at the next term instead, which is a real answer rather than a
 * rounding error.
 */
export function checkUpgradeWindow(remainingTermDays: number): GuardrailResult {
  if (remainingTermDays < MIN_UPGRADE_DAYS) {
    return {
      ok: false,
      code: "UPGRADE_WINDOW_CLOSED",
      message:
        `Only ${remainingTermDays} day${remainingTermDays === 1 ? "" : "s"} of this term remain, so an upgrade cannot be prorated. ` +
        `Schedule it for the start of next term instead — it costs nothing to wait, and the school keeps what it has until then.`,
    };
  }
  return { ok: true };
}

export type TierDirection = "UPGRADE" | "DOWNGRADE" | "SAME";

/** Which way a change goes, decided by price and nothing else. */
export function directionOf(oldRate: number, newRate: number): TierDirection {
  if (newRate > oldRate) return "UPGRADE";
  if (newRate < oldRate) return "DOWNGRADE";
  return "SAME";
}
