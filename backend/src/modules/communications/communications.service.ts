import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { AnnouncementView } from "../../../../src/lib/domain/types";
import { sendNotification } from "../../../../src/lib/integrations/notifications";

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

}
