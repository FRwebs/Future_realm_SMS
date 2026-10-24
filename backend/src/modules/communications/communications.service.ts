import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { AnnouncementView } from "../../../../src/lib/domain/types";
import { sendNotification } from "../../../../src/lib/integrations/notifications";
import { isForStudents, notifyStudents } from "../student-portal/student-notify";

export const announcementSchema = z.object({
  title: z.string().min(5),
  body: z.string().min(10),
  audience: z.string().min(2),
  channel: z.enum(["SMS", "EMAIL", "PUSH", "IN_APP"]).default("IN_APP")
});

@Injectable()
export class CommunicationsService {
  async listAnnouncements(schoolId: string) {
    const announcements = await prisma.announcement.findMany({
      where: { schoolId },
      orderBy: { publishedAt: "desc" }
    });

    return announcements.map<AnnouncementView>((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      audience: item.audience,
      channel: item.channel,
      publishedAt: item.publishedAt.toISOString()
    }));
  }

  async createAnnouncement(schoolId: string, createdById: string, payload: unknown) {
    const parsed = announcementSchema.parse(payload);

    const record = await prisma.announcement.create({
      data: {
        schoolId,
        createdById,
        title: parsed.title,
        body: parsed.body,
        audience: parsed.audience,
        channel: parsed.channel
      }
    });

    // Students are told too when the notice is for them: in-app always, email as each of them has chosen.
    if (isForStudents(parsed.audience)) {
      const students = await prisma.student.findMany({ where: { schoolId, status: "ACTIVE", userId: { not: null } }, select: { userId: true } });
      await notifyStudents(schoolId, students.map((student) => ({ userId: student.userId!, kind: "school" as const, title: parsed.title, body: parsed.body.slice(0, 240), meta: { kind: "ANNOUNCEMENT", announcementId: record.id } })));
    }

    await sendNotification({
      channel: parsed.channel,
      recipient: parsed.audience,
      title: parsed.title,
      body: parsed.body
    });

    return {
      id: record.id,
      title: record.title,
      body: record.body,
      audience: record.audience,
      channel: record.channel,
      publishedAt: record.publishedAt.toISOString()
    };
  }

  /**
   * The school's messaging balance.
   *
   * A school with no wallet row has never set messaging up, which the page has
   * to say differently from a wallet that has run dry — so the absence is
   * reported rather than coerced to zero.
   */
  async wallet(session: SessionPayload) {
    const [wallet, guardians, announcements] = await Promise.all([
      prisma.notificationWallet.findUnique({ where: { schoolId: session.schoolId } }),
      prisma.guardian.count({ where: { schoolId: session.schoolId } }),
      prisma.announcement.count({ where: { schoolId: session.schoolId } })
    ]);

    return {
      configured: Boolean(wallet),
      smsBalance: wallet?.smsBalance ?? 0,
      whatsappBalance: wallet?.whatsappBalance ?? 0,
      lowBalanceThreshold: wallet?.lowBalanceThreshold ?? 0,
      low: wallet ? wallet.smsBalance <= wallet.lowBalanceThreshold : false,
      lastToppedUpAt: wallet?.lastToppedUpAt?.toISOString() ?? null,
      guardians,
      announcements,
      // How many school-wide SMS sends the balance covers, which is the figure
      // a bursar actually decides on — a raw credit count is not one.
      sendsCovered: wallet && guardians > 0 ? Math.floor(wallet.smsBalance / guardians) : 0
    };
  }


  /**
   * This school's subscription: the plan it is on, what that plan allows, and
   * how close the school is to each limit.
   *
   * A plan page that prints a price teaches nobody anything. The question a
   * proprietor has is whether the school is about to outgrow what it pays for,
   * so every limit is reported against actual usage.
   */
  async subscription(session: SessionPayload) {
    const school = await prisma.school.findUnique({
      where: { id: session.schoolId },
      select: { plan: true, billingStatus: true, nextBillingAt: true, currency: true, createdAt: true }
    });
    if (!school) return null;

    const [plan, allPlans, students, staff, wallet, transactions] = await Promise.all([
      prisma.platformSubscriptionPlan.findFirst({ where: { plan: school.plan } }),
      prisma.platformSubscriptionPlan.findMany({ orderBy: { monthlyPrice: "asc" } }),
      prisma.student.count({ where: { schoolId: session.schoolId, status: "ACTIVE" } }),
      prisma.staffProfile.count({ where: { schoolId: session.schoolId } }),
      prisma.notificationWallet.findUnique({ where: { schoolId: session.schoolId } }),
      prisma.platformBillingTransaction.findMany({
        where: { schoolId: session.schoolId },
        orderBy: { processedAt: "desc" },
        take: 24,
        select: {
          id: true,
          amount: true,
          currency: true,
          method: true,
          status: true,
          reference: true,
          processedAt: true
        }
      })
    ]);

    /** Null limit means the plan does not cap it, which is not the same as zero. */
    const usage = (used: number, limit: number | null | undefined) => ({
      used,
      limit: limit ?? null,
      percent: limit ? Math.round((used / limit) * 100) : null,
      over: limit ? used > limit : false
    });

    return {
      plan: String(school.plan),
      planName: plan?.name ?? String(school.plan),
      billingStatus: String(school.billingStatus),
      nextBillingAt: school.nextBillingAt?.toISOString() ?? null,
      currency: school.currency,
      monthlyPrice: plan ? Number(plan.monthlyPrice) : null,
      annualPrice: plan ? Number(plan.annualPrice) : null,
      supportTier: plan?.supportTier ? String(plan.supportTier) : null,
      apiAccess: plan?.apiAccess ?? false,
      customBranding: plan?.customBranding ?? false,
      students: usage(students, plan?.studentLimit),
      staff: usage(staff, plan?.staffLimit),
      smsIncluded: plan?.smsUnitsPerMonth ?? 0,
      smsBalance: wallet?.smsBalance ?? 0,
      since: school.createdAt.toISOString(),
      transactions: transactions.map((row) => ({
        id: row.id,
        amount: Number(row.amount),
        currency: row.currency,
        method: row.method,
        status: row.status,
        reference: row.reference,
        processedAt: row.processedAt.toISOString()
      })),
      plans: allPlans.map((item) => ({
        name: item.name,
        plan: String(item.plan),
        monthlyPrice: Number(item.monthlyPrice),
        annualPrice: Number(item.annualPrice),
        studentLimit: item.studentLimit,
        smsUnitsPerMonth: item.smsUnitsPerMonth,
        current: item.plan === school.plan
      }))
    };
  }


  /** Standing rules that send without anybody pressing a button. */
  async automations(session: SessionPayload) {
    const rows = await prisma.automationRule.findMany({
      where: { schoolId: session.schoolId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      trigger: String(row.trigger),
      threshold: row.threshold,
      channel: row.channel,
      audience: row.audience,
      template: row.template,
      isActive: row.isActive,
      lastRunAt: row.lastRunAt?.toISOString() ?? null,
      sendCount: row.sendCount,
      /** Active, but has never fired — usually a rule nothing can satisfy. */
      neverRun: row.isActive && !row.lastRunAt
    }));
  }

}
