import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { AuditAction, MessageCampaignStatus, MessageDeliveryStatus, NotificationChannel, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { fullName } from "../fee-management/fees.shared";
import { ConfigStoreThreshold } from "./messages.threshold";
import { TeacherWorkspaceService } from "./workspace.service";

const SMS_NAIRA = 3.8;
const UNREACHABLE = "—";

const sendSchema = z.object({
  audience: z.enum(["all", "selected", "one"]).default("all"),
  families: z.union([z.string(), z.array(z.string())]).optional().transform((value) => (value === undefined ? [] : Array.isArray(value) ? value : [value])),
  channel: z.nativeEnum(NotificationChannel).default(NotificationChannel.IN_APP),
  body: z.string().trim().min(8, "A message needs something in it."),
  acknowledge: z.preprocess((value) => value === true || value === "true", z.boolean()).default(false)
});

/**
 * Messages, as a form master sends them: to the families of their own class and nobody else's, with the cost shown before it goes.
 * A family sees the school, not the teacher, and a send above the school's threshold waits for the Principal's decision.
 */
@Injectable()
export class TeacherMessagesService {
  constructor(private readonly workspace: TeacherWorkspaceService) {}

  private async families(session: SessionPayload) {
    const me = await this.workspace.me(session);
    const ids = me.formArms.map((arm) => arm.id);
    if (!ids.length) return { me, rows: [] as Array<{ id: string; name: string; phone: string; children: string[]; reachable: boolean }> };
    const links = await prisma.studentGuardian.findMany({
      where: { student: { schoolId: session.schoolId, currentClassId: { in: ids }, status: "ACTIVE" }, guardian: { mergedIntoId: null, safeguardingRestrictedAt: null } },
      include: { student: { select: { firstName: true, lastName: true } }, guardian: { select: { id: true, firstName: true, lastName: true, phone: true } } }
    });
    const byGuardian = new Map<string, { id: string; name: string; phone: string; children: string[]; reachable: boolean }>();
    for (const link of links) {
      const entry = byGuardian.get(link.guardianId) ?? { id: link.guardianId, name: fullName(link.guardian), phone: link.guardian.phone, children: [], reachable: Boolean(link.guardian.phone?.trim()) && link.guardian.phone.trim() !== UNREACHABLE };
      entry.children.push(fullName(link.student));
      byGuardian.set(link.guardianId, entry);
    }
    return { me, rows: [...byGuardian.values()].sort((a, b) => a.name.localeCompare(b.name)) };
  }

  async info(session: SessionPayload) {
    const { me, rows } = await this.families(session);
    const [wallet, school, threshold] = await Promise.all([
      prisma.notificationWallet.findUnique({ where: { schoolId: session.schoolId } }),
      prisma.school.findUnique({ where: { id: session.schoolId }, select: { name: true } }),
      ConfigStoreThreshold(session.schoolId)
    ]);
    return { arms: me.formArms, families: rows, wallet: { sms: wallet?.smsBalance ?? 0 }, threshold: Number.isFinite(threshold) ? threshold : null, sender: school?.name ?? "Your school", smsNaira: SMS_NAIRA };
  }

  async send(session: SessionPayload, body: unknown) {
    const input = sendSchema.parse(body);
    const { me, rows } = await this.families(session);
    if (!rows.length) throw new ForbiddenException("You are not the form master of a class with families on record, so there is nobody for you to message.");
    const chosen = input.audience === "all" ? rows : rows.filter((row) => input.families.includes(row.id));
    if (input.audience !== "all" && chosen.length !== input.families.length) throw new ForbiddenException("One of those families is not in your class — you may only message your own.");
    if (!chosen.length) throw new BadRequestException("Choose who this goes to.");
    const sms = input.channel === NotificationChannel.SMS;
    const reach = sms ? chosen.filter((row) => row.reachable) : chosen;
    if (!reach.length) throw new BadRequestException("Nobody in that audience can be reached, so there is nothing to send. Fix the contact details first.");
    const credits = sms ? reach.length : 0;
    const [wallet, threshold] = await Promise.all([prisma.notificationWallet.findUnique({ where: { schoolId: session.schoolId } }), ConfigStoreThreshold(session.schoolId)]);
    if (sms && (wallet?.smsBalance ?? 0) < credits) throw new BadRequestException(`This would cost ${credits} credits and the school has ${wallet?.smsBalance ?? 0}. Send it in-app, or ask the office to top up.`);
    const needsApproval = reach.length > threshold;
    const label = input.audience === "all" ? `Every ${me.formArms.map((arm) => arm.name).join(" and ")} family` : input.audience === "one" ? "One family" : "Selected families";
    const stamp = new Date();
    const campaign = await prisma.messageCampaign.create({
      data: {
        schoolId: session.schoolId, name: `${label} · ${input.body.slice(0, 40)}`, channel: input.channel, audienceLabel: label,
        audience: { key: "Class", classIds: me.formArms.map((arm) => arm.id), guardianIds: chosen.map((row) => row.id), acknowledge: input.acknowledge } as Prisma.InputJsonObject,
        body: input.body, status: needsApproval ? MessageCampaignStatus.AWAITING_APPROVAL : MessageCampaignStatus.SENT, thresholdAt: Number.isFinite(threshold) ? threshold : null,
        sentAt: needsApproval ? null : stamp, recipientCount: reach.length, creditsUsed: needsApproval ? 0 : credits, createdById: session.userId
      }
    });
    if (!needsApproval) {
      await prisma.messageDelivery.createMany({ data: chosen.map((row) => ({ schoolId: session.schoolId, campaignId: campaign.id, guardianId: row.id, recipientName: row.name, destination: row.phone, status: !sms || row.reachable ? MessageDeliveryStatus.DELIVERED : MessageDeliveryStatus.EXCLUDED, failureReason: !sms || row.reachable ? null : "No phone number on file — nothing was sent.", deliveredAt: !sms || row.reachable ? stamp : null })) });
      await prisma.messageCampaign.update({ where: { id: campaign.id }, data: { deliveredCount: reach.length } });
    }
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.CREATE, entityType: "MessageCampaign", entityId: campaign.id, metadata: { summary: `Message to ${label} · ${input.channel}`, recipients: reach.length, credits, needsApproval } } });
    return { id: campaign.id, reach: reach.length, credits, needsApproval, threshold: Number.isFinite(threshold) ? threshold : null, label, channel: input.channel };
  }

  async sent(session: SessionPayload) {
    const rows = await prisma.messageCampaign.findMany({ where: { schoolId: session.schoolId, createdById: session.userId }, orderBy: { createdAt: "desc" }, take: 60, include: { deliveries: { select: { status: true } } } });
    const failures = rows.reduce((sum, row) => sum + row.deliveries.filter((delivery) => delivery.status === MessageDeliveryStatus.FAILED).length, 0);
    const delivered = rows.reduce((sum, row) => sum + row.deliveredCount, 0);
    const counted = rows.reduce((sum, row) => sum + row.recipientCount, 0);
    return {
      rows: rows.map((row) => ({ id: row.id, name: row.name, audience: row.audienceLabel, channel: row.channel, status: row.status, recipients: row.recipientCount, credits: row.creditsUsed, delivered: row.deliveredCount, failed: row.failedCount, body: row.body, at: (row.sentAt ?? row.createdAt).toISOString(), note: row.decisionNote })),
      totals: { sent: rows.filter((row) => row.status === MessageCampaignStatus.SENT).length, credits: rows.reduce((sum, row) => sum + row.creditsUsed, 0), deliveredRate: counted ? Math.round((delivered / counted) * 100) : null, failures, held: rows.filter((row) => row.status === MessageCampaignStatus.AWAITING_APPROVAL).length }
    };
  }
}
