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
