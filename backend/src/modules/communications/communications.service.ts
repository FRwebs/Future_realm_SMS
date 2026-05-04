import { Injectable } from "@nestjs/common";
import { z } from "zod";

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
}
