import { z } from "zod";

/**
 * What the browser expects the API to answer for the reads it makes after a page has loaded. The shapes are checked at the boundary: an
 * answer that does not match is reported as one clear error here instead of an `undefined` three components down. Extra fields are fine —
 * the API may add; it may not remove or retype what the page uses.
 */
export const membershipsContract = z.array(z.object({ schoolId: z.string(), schoolName: z.string(), role: z.string(), current: z.boolean() }));

/** Three feeds share this bell — staff, parent and student — and they do not carry quite the same fields: only the staff feed has a `href`, only the others a `channel`. */
export const notificationsContract = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    body: z.string(),
    status: z.string(),
    channel: z.string().optional(),
    href: z.string().nullable().optional(),
    sentAt: z.string().optional().nullable(),
  }),
);

export const countriesContract = z.array(z.string());

export const plansContract = z.array(
  z.object({ slug: z.string(), name: z.string(), plan: z.string(), monthlyPrice: z.number(), annualPrice: z.number(), includedModules: z.array(z.string()) }),
);

export const slugCheckContract = z.object({ tone: z.enum(["idle", "good", "warn", "bad"]), badge: z.string(), note: z.string() });

export const schoolSearchContract = z.array(z.object({ id: z.string(), name: z.string(), location: z.string().nullable() }));

/** What the partner portal's overview page reads: who is signed in, the partner, its schools and deals, and the commission statements. */
export const partnerOverviewContract = z.object({
  person: z.object({ name: z.string(), email: z.string() }),
  partner: z.object({ name: z.string(), code: z.string().nullable(), tier: z.string().nullable(), territory: z.string().nullable() }),
  schools: z.array(z.object({ name: z.string(), location: z.string(), tier: z.string(), tenureMonths: z.number(), state: z.string(), commission: z.number() })),
  deals: z.array(
    z.object({ prospect: z.string(), location: z.string().nullable(), registeredAt: z.string(), validUntil: z.string(), status: z.string(), daysLeft: z.number() }),
  ),
  commission: z.object({
    accrued: z.number(),
    statements: z.array(z.object({ ref: z.string(), period: z.string(), net: z.number(), status: z.string(), dueAt: z.string(), settledAt: z.string().nullable() })),
  }),
});

/** The devices an internal-team member has signed in from, and what they currently own — read when their review sheet opens. */
export const internalDevicesContract = z.array(z.object({ device: z.string(), first: z.string(), last: z.string(), count: z.number(), ip: z.string().nullable() }));
export const internalOwnsContract = z.object({ openTickets: z.number(), schools: z.number(), openFlags: z.number() });

/** The price of moving a school to another tier: what is due now, what the term costs after, and why it may be blocked. */
const tierRef = z.object({ key: z.string(), name: z.string(), rate: z.number() });
export const tierChangePreviewContract = z.object({
  isUpgrade: z.boolean(),
  direction: z.enum(["UPGRADE", "DOWNGRADE", "SAME"]),
  currentTier: tierRef,
  targetTier: tierRef,
  activeStudentCount: z.number(),
  term: z.object({ id: z.string(), label: z.string(), startDate: z.string(), endDate: z.string() }).nullable(),
  totalTermDays: z.number(),
  remainingTermDays: z.number(),
  prorationRatio: z.number(),
  immediateAmountDue: z.number(),
  taxOnImmediate: z.number(),
  immediateTotal: z.number(),
  effectiveDate: z.string(),
  effectiveOn: z.string().nullable(),
  newTermlyAmount: z.number(),
  termlyDifference: z.number(),
  blocked: z.object({ code: z.string(), message: z.string() }).nullable(),
});
