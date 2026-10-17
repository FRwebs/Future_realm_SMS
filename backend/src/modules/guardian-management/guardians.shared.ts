import { Prisma } from "@prisma/client";

import { prisma } from "../../../../src/lib/db/prisma";
import { fullName, normalPhone, portalOf, validMobile } from "../student-records/records.shared";

export { fullName, normalPhone, validMobile };

/**
 * What the Guardians tabs all read the same way: who a family is, whether the portal reaches
 * them, whether a message can be delivered, and where their consent stands.
 */

export type GuardianPortal = "Active" | "Invited" | "Not activated";
export type Delivery = "Delivered" | "Failing" | "No number";
export type ConsentCoverage = "Complete" | "Gaps" | "None";

/** A login that has been used is active; one that exists and has never been used is only invited. */
export function guardianPortal(user: { lastLoginAt: Date | null } | null | undefined): GuardianPortal {
  if (!user) return "Not activated";
  return portalOf(user) === "Active" ? "Active" : "Invited";
}

export function deliveryOf(guardian: { phone: string | null; email: string | null }): Delivery {
  if (!guardian.phone?.trim() && !guardian.email?.trim()) return "No number";
  if (guardian.phone?.trim() && !validMobile(guardian.phone) && !guardian.email?.trim()) return "Failing";
  return "Delivered";
}

export const VISIBILITY = ["Results and report cards", "Attendance", "Fee amounts", "Announcements", "Disciplinary and guidance notes"];

export const RELATIONS = ["Mother", "Father", "Grandparent", "Aunt", "Uncle", "Sponsor", "Legal guardian", "Sibling over 18"];

/** Queue a message on every channel that reaches a family, and say which did. */
export async function notifyGuardian(schoolId: string, guardianId: string, title: string, body: string, channels: string[]) {
  const guardian = await prisma.guardian.findFirst({ where: { id: guardianId, schoolId } });
  if (!guardian) return { sent: [] as string[], skipped: ["No guardian on record"] };
  const sent: string[] = [];
  const rows: Prisma.NotificationLogCreateManyInput[] = [];
  if (channels.some((channel) => /In-app/i.test(channel)) && guardian.userId) {
    rows.push({ schoolId, userId: guardian.userId, channel: "IN_APP", title, body, status: "QUEUED", sentAt: new Date() });
    sent.push("In-app");
  }
  if (channels.some((channel) => /SMS/i.test(channel)) && guardian.canReceiveSms && guardian.phone) {
    rows.push({ schoolId, userId: guardian.userId ?? undefined, channel: "SMS", title, body, status: "QUEUED", metadata: { phone: guardian.phone } as Prisma.InputJsonValue, sentAt: new Date() });
    sent.push("SMS");
  }
  if (channels.some((channel) => /Email/i.test(channel)) && guardian.canReceiveEmail && guardian.email) {
    rows.push({ schoolId, userId: guardian.userId ?? undefined, channel: "EMAIL", title, body, status: "QUEUED", metadata: { email: guardian.email } as Prisma.InputJsonValue, sentAt: new Date() });
    sent.push("Email");
  }
  if (rows.length) await prisma.notificationLog.createMany({ data: rows });
  return { sent, skipped: sent.length ? [] : ["No channel reaches them"] };
}
