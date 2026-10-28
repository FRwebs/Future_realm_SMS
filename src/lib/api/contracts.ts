import { z } from "zod";

import type { MyPermissionsView, ParentProfileView, PlatformSyncView, SchoolContextView } from "@/lib/domain/types";
import type { MyProfile } from "@/lib/modules/account";
import type { TimetableDetail } from "@/lib/modules/live/m3-types";

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

/** A saved Back Office report, run: the figures by segment, with what was left out to protect small groups. */
export const reportRunContract = z.object({
  name: z.string(),
  dimension: z.string(),
  metric: z.string(),
  question: z.string().nullable(),
  locked: z.boolean(),
  periodDays: z.number().nullable(),
  compare: z.boolean(),
  suppressUnder: z.number().nullable(),
  showDropoff: z.boolean(),
  weightChurned: z.boolean(),
  rows: z.array(
    z.object({
      label: z.string(),
      value: z.number().nullable(),
      suppressed: z.boolean(),
      schools: z.number().nullable(),
      previous: z.number().nullable(),
      churned: z.number().nullable(),
      churnedSchools: z.number().nullable(),
      schoolNames: z.array(z.string()),
      dropoff: z.number().nullable(),
    }),
  ),
});

/**
 * A timetable as the builder reads it. The version and the lists the builder cannot draw without are checked; the rest of the (large)
 * answer is passed through as it came, since the builder only reads what it was built against.
 */
export const timetableDetailContract = z
  .object({
    version: z
      .object({
        id: z.string(),
        name: z.string(),
        state: z.enum(["DRAFT", "RUNNING", "ARCHIVED"]),
        periodsPerDay: z.number(),
        periodMinutes: z.number(),
        firstStarts: z.string(),
        schoolDays: z.array(z.string()),
        live: z.boolean(),
      })
      .passthrough(),
    arms: z.array(z.object({ id: z.string(), name: z.string(), level: z.string() }).passthrough()),
    subjects: z.record(z.string(), z.array(z.object({ subjectId: z.string(), name: z.string(), periods: z.number() }).passthrough())),
  })
  .passthrough() as unknown as z.ZodType<TimetableDetail>;

/* ------------------------------------------------------------------ reads the server makes for a page */

/**
 * The page code was written against hand-made types; a contract for one of those reads checks the real answer against the shape the
 * page relies on, and hands back that same type — so nothing downstream changes, and a mismatch is caught at the edge.
 */
const typed = <T,>() => (schema: z.ZodTypeAny) => schema as unknown as z.ZodType<T>;

/** The school a signed-in person is in, and its current session and term (`/dashboard/context`). */
export const schoolContextContract = typed<SchoolContextView>()(z.object({
  schoolName: z.string(),
  schoolSlug: z.string().nullish(),
  currentSession: z.string(),
  currentTerm: z.string(),
}));

/** What the Back Office has decided the school's own app must show and obey (`/platform-sync`). */
export const platformSyncContract = typed<PlatformSyncView>()(z.object({
  school: z.object({ name: z.string(), plan: z.string(), tier: z.string(), status: z.string(), billingStatus: z.string(), trialEndsAt: z.string().nullable() }),
  pendingSwitch: z.object({ to: z.string(), from: z.string().nullable() }).nullable(),
  readOnly: z.object({ reason: z.string(), kind: z.enum(["maintenance", "trial"]) }).nullable(),
  platformMessage: z.string().nullable(),
  windows: z.array(z.object({ id: z.string(), title: z.string(), message: z.string(), startsAt: z.string(), endsAt: z.string(), active: z.boolean() })),
  announcements: z.array(z.object({ id: z.string(), title: z.string(), body: z.string(), type: z.enum(["INFO", "WARNING", "CRITICAL", "NEW_FEATURE", "PROMOTION"]), publishedAt: z.string().nullable() })),
  switchedOff: z.array(z.object({ slug: z.string(), name: z.string(), scope: z.enum(["platform", "school"]), reason: z.string() })),
}));

/** What a person may do in their school (`/roles-management/permissions/my`): the list is what every page checks. */
export const myPermissionsContract = typed<MyPermissionsView>()(z.object({ permissions: z.array(z.string()), grouped: z.array(z.object({ module: z.string() }).passthrough()) }));

/** The person's own profile (`/profile/me`): only what the account pages read from it. */
export const myProfileContract = typed<MyProfile>()(
  z.object({
    preferredName: z.string().nullish(),
    phone: z.string().nullish(),
    alternateEmail: z.string().nullish(),
    mfaEnabled: z.boolean().nullish(),
    locale: z.string().nullish(),
    preferences: z.record(z.string(), z.unknown()).nullish(),
    lastLoginAt: z.string().nullish(),
    accountStatus: z.string().nullish(),
  }).passthrough(),
);

/** A parent's own record and the children linked to it (`/parent-portal/profile`). */
export const parentProfileContract = typed<ParentProfileView>()(z.object({
  parentId: z.string(),
  parentName: z.string(),
  relationship: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  address: z.string().nullish(),
  canReceiveSms: z.boolean(),
  canReceiveEmail: z.boolean(),
  linkedChildren: z.array(z.object({ studentId: z.string(), studentName: z.string(), className: z.string(), admissionNumber: z.string() })),
}));
