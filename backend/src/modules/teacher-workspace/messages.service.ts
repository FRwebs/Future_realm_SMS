import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, MessageCampaignStatus, MessageDeliveryStatus, NotificationChannel, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { mergeBody } from "../../../../src/lib/messaging/merge";
import { FamilyDispatchService, SMS_NAIRA, channelOf, type Family } from "../communications/family-dispatch.service";
import { fullName } from "../fee-management/fees.shared";
import { guardianPortal } from "../guardian-management/guardians.shared";
import { ConfigStoreThreshold } from "./messages.threshold";
import { TeacherWorkspaceService } from "./workspace.service";

const sendSchema = z.object({
  audience: z.enum(["all", "selected", "one"]).default("all"),
  families: z.union([z.string(), z.array(z.string())]).optional().transform((value) => (value === undefined ? [] : Array.isArray(value) ? value : [value])),
  channel: z.nativeEnum(NotificationChannel).default(NotificationChannel.IN_APP),
  body: z.string().trim().min(8, "A message needs something in it."),
  acknowledge: z.preprocess((value) => value === true || value === "true", z.boolean()).default(false),
  /** Keep it for later instead of sending. */
  draft: z.preprocess((value) => value === true || value === "true", z.boolean()).default(false),
  draftId: z.string().optional(),
});

type Meta = { guardianIds?: string[]; classIds?: string[]; acknowledge?: boolean; draft?: boolean; audience?: string; key?: string };

/**
 * Messages, as a form master sends them: to the families of their own class and nobody else's, with the cost shown before it goes.
 * A family sees the school, not the teacher; replies reach the office; a send above the school's threshold waits for the Principal; and
 * what happens afterwards — delivered, read, acknowledged, answered — comes back here, on the message.
 */
@Injectable()
export class TeacherMessagesService {
  constructor(private readonly workspace: TeacherWorkspaceService, private readonly dispatcher: FamilyDispatchService) {}

  /** The families of the arms this person is form master of, with how each can be reached. */
  private async classFamilies(session: SessionPayload) {
    const me = await this.workspace.me(session);
    const ids = me.formArms.map((arm) => arm.id);
    if (!ids.length) return { me, families: [] as Array<Family & { portal: string }> };
    const links = await prisma.studentGuardian.findMany({
      where: { student: { schoolId: session.schoolId, currentClassId: { in: ids }, status: "ACTIVE" }, guardian: { mergedIntoId: null, safeguardingRestrictedAt: null } },
      select: { guardianId: true },
    });
    const guardianIds = [...new Set(links.map((link) => link.guardianId))];
    // A family is shown with their children of this class only: a form master writes about the child in front of them.
    const [families, users] = await Promise.all([
      this.dispatcher.families(session.schoolId, guardianIds),
      prisma.guardian.findMany({ where: { id: { in: guardianIds } }, select: { id: true, user: { select: { lastLoginAt: true } } } }),
    ]);
    const portal = new Map(users.map((row) => [row.id, guardianPortal(row.user)]));
    return { me, families: families.map((family) => ({ ...family, portal: portal.get(family.id) ?? "Not activated" })) };
  }

  async info(session: SessionPayload) {
    const { me, families } = await this.classFamilies(session);
    const [wallet, school, threshold, drafts] = await Promise.all([
      prisma.notificationWallet.findUnique({ where: { schoolId: session.schoolId } }),
      prisma.school.findUnique({ where: { id: session.schoolId }, select: { name: true } }),
      ConfigStoreThreshold(session.schoolId),
      prisma.messageCampaign.findMany({ where: { schoolId: session.schoolId, createdById: session.userId, status: MessageCampaignStatus.DRAFT }, orderBy: { updatedAt: "desc" }, take: 20 }),
    ]);
    return {
      arms: me.formArms,
      families: families.map((family) => ({
        id: family.id, name: family.name, phone: family.phone ?? "", email: family.email ?? "", children: family.children, arms: family.arms, canSms: family.canSms, canEmail: family.canEmail,
        portal: family.portal, language: family.language,
      })),
      wallet: { sms: wallet?.smsBalance ?? 0 }, threshold: Number.isFinite(threshold) ? threshold : null, sender: school?.name ?? "Your school", smsNaira: SMS_NAIRA,
      drafts: drafts.filter((row) => (row.audience as Meta | null)?.draft).map((row) => {
        const meta = (row.audience ?? {}) as Meta;
        return { id: row.id, body: row.body, channel: row.channel, audience: meta.audience ?? "all", families: meta.guardianIds ?? [], acknowledge: Boolean(meta.acknowledge), savedAt: row.updatedAt.toISOString() };
      }),
    };
  }

  async send(session: SessionPayload, body: unknown) {
    const input = sendSchema.parse(body);
    const { me, families } = await this.classFamilies(session);
    if (!families.length) throw new ForbiddenException("You are not the form master of a class with families on record, so there is nobody for you to message.");
    const chosen = input.audience === "all" ? families : families.filter((row) => input.families.includes(row.id));
    if (input.audience !== "all" && chosen.length !== new Set(input.families).size) throw new ForbiddenException("One of those families is not in your class — you may only message your own.");
    if (!chosen.length) throw new BadRequestException("Choose who this goes to.");
    const label = input.audience === "all" ? (me.formArms.length > 3 ? `Every family of your ${me.formArms.length} classes` : `Every ${me.formArms.map((arm) => arm.name).join(" and ")} family`) : input.audience === "one" ? "One family" : "Selected families";
    const meta: Meta = { key: "Class", audience: input.audience, classIds: me.formArms.map((arm) => arm.id), guardianIds: chosen.map((row) => row.id), acknowledge: input.acknowledge, draft: input.draft };
    // The title of a send is read in lists by someone who is not looking at any one family, so the fields in it are read generically.
    const gist = mergeBody(input.body, { Guardian: "parent", Child: "your child", Class: "the class" });
    const name = `${label} · ${gist.slice(0, 40)}`;

    if (input.draft) {
      const data = { name: `Draft · ${gist.slice(0, 40)}`, channel: input.channel, audienceLabel: label, audience: meta as Prisma.InputJsonObject, body: input.body, recipientCount: chosen.length };
      const existing = input.draftId ? await prisma.messageCampaign.findFirst({ where: { id: input.draftId, schoolId: session.schoolId, createdById: session.userId, status: MessageCampaignStatus.DRAFT } }) : null;
      const saved = existing
        ? await prisma.messageCampaign.update({ where: { id: existing.id }, data })
        : await prisma.messageCampaign.create({ data: { ...data, schoolId: session.schoolId, status: MessageCampaignStatus.DRAFT, createdById: session.userId } });
      return { id: saved.id, draft: true, reach: chosen.length, credits: 0, needsApproval: false, threshold: null, label, channel: input.channel };
    }

    // The same arithmetic the composer showed: who can be reached on this channel, and what each family's own message costs.
    const plan = this.dispatcher.plan(channelOf(input.channel), input.body, chosen);
    if (!plan.reach) throw new BadRequestException("Nobody in that audience can be reached on this channel, so there is nothing to send. Fix the contact details first.");
    const [wallet, threshold] = await Promise.all([prisma.notificationWallet.findUnique({ where: { schoolId: session.schoolId } }), ConfigStoreThreshold(session.schoolId)]);
    if (plan.credits > (wallet?.smsBalance ?? 0)) throw new BadRequestException(`This would cost ${plan.credits} credits and the school has ${wallet?.smsBalance ?? 0}. Send it in-app, or ask the office to top up.`);
    const needsApproval = plan.reach > threshold;

    const fields = {
      name, channel: input.channel, audienceLabel: label, audience: { ...meta, draft: false } as Prisma.InputJsonObject, body: input.body, status: needsApproval ? MessageCampaignStatus.AWAITING_APPROVAL : MessageCampaignStatus.DRAFT,
      thresholdAt: Number.isFinite(threshold) ? threshold : null, recipientCount: plan.reach,
    };
    const prior = input.draftId ? await prisma.messageCampaign.findFirst({ where: { id: input.draftId, schoolId: session.schoolId, createdById: session.userId, status: MessageCampaignStatus.DRAFT } }) : null;
    const campaign = prior ? await prisma.messageCampaign.update({ where: { id: prior.id }, data: fields }) : await prisma.messageCampaign.create({ data: { ...fields, schoolId: session.schoolId, createdById: session.userId } });
    let credits = 0;
    if (!needsApproval) {
      try {
        credits = (await this.dispatcher.dispatch(campaign.id)).credits;
      } catch (error) {
        // Nothing went and nothing was charged: what was written is kept as a draft, so the words are not lost.
        await prisma.messageCampaign.update({ where: { id: campaign.id }, data: { status: MessageCampaignStatus.DRAFT, audience: { ...meta, draft: true } as Prisma.InputJsonObject } });
        throw error;
      }
    }
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.CREATE, entityType: "MessageCampaign", entityId: campaign.id, metadata: { summary: `Message to ${label} · ${input.channel}`, recipients: plan.reach, credits, needsApproval } } });
    return { id: campaign.id, draft: false, reach: plan.reach, credits, needsApproval, threshold: Number.isFinite(threshold) ? threshold : null, label, channel: input.channel };
  }

  async discardDraft(session: SessionPayload, id: string) {
    const row = await prisma.messageCampaign.findFirst({ where: { id, schoolId: session.schoolId, createdById: session.userId, status: MessageCampaignStatus.DRAFT } });
    if (!row) throw new NotFoundException("That draft is not yours, or it has already gone.");
    await prisma.messageCampaign.delete({ where: { id } });
    return { id };
  }

  async sent(session: SessionPayload) {
    const rows = await prisma.messageCampaign.findMany({
      where: { schoolId: session.schoolId, createdById: session.userId, status: { not: MessageCampaignStatus.DRAFT } }, orderBy: { createdAt: "desc" }, take: 80,
      include: { deliveries: { select: { status: true, acknowledgeAsked: true, acknowledgedAt: true, readAt: true } } },
    });
    const failures = rows.reduce((sum, row) => sum + row.deliveries.filter((delivery) => delivery.status === MessageDeliveryStatus.FAILED).length, 0);
    const delivered = rows.reduce((sum, row) => sum + row.deliveredCount, 0);
    // A text still with the carrier is neither delivered nor failed: the rate is taken over what has been settled.
    const counted = rows.reduce((sum, row) => sum + row.deliveries.filter((delivery) => delivery.status === MessageDeliveryStatus.DELIVERED || delivery.status === MessageDeliveryStatus.FAILED).length, 0);
    return {
      rows: rows.map((row) => {
        const asked = row.deliveries.filter((delivery) => delivery.acknowledgeAsked && delivery.status !== MessageDeliveryStatus.EXCLUDED);
        return {
          id: row.id, name: row.name, audience: row.audienceLabel, channel: row.channel, status: row.status, recipients: row.recipientCount, credits: row.creditsUsed, delivered: row.deliveredCount, failed: row.failedCount,
          pending: row.deliveries.filter((delivery) => delivery.status === MessageDeliveryStatus.PENDING).length, read: row.deliveries.filter((delivery) => delivery.readAt).length,
          asked: asked.length, acknowledged: asked.filter((delivery) => delivery.acknowledgedAt).length, body: row.body, at: (row.sentAt ?? row.createdAt).toISOString(), note: row.decisionNote,
        };
      }),
      totals: { sent: rows.filter((row) => row.status === MessageCampaignStatus.SENT).length, credits: rows.reduce((sum, row) => sum + row.creditsUsed, 0), deliveredRate: counted ? Math.round((delivered / counted) * 100) : null, failures, held: rows.filter((row) => row.status === MessageCampaignStatus.AWAITING_APPROVAL).length },
    };
  }

  /** One of your own messages, recipient by recipient: what happened to each, whether they read it, and what they said back. */
  async sentOne(session: SessionPayload, id: string) {
    const row = await prisma.messageCampaign.findFirst({ where: { id, schoolId: session.schoolId, createdById: session.userId } });
    if (!row) throw new NotFoundException("That message is not one of yours.");
    const deliveries = await prisma.messageDelivery.findMany({ where: { campaignId: id }, orderBy: { recipientName: "asc" }, take: 400 });
    const replies = deliveries.length ? await prisma.guardianSubmission.findMany({ where: { schoolId: session.schoolId, deliveryId: { in: deliveries.map((delivery) => delivery.id) } }, select: { deliveryId: true, detail: true, createdAt: true } }) : [];
    const guardians = await prisma.guardian.findMany({ where: { id: { in: deliveries.map((delivery) => delivery.guardianId).filter((guardianId): guardianId is string => Boolean(guardianId)) } }, select: { id: true, students: { select: { student: { select: { firstName: true, lastName: true } } } } } });
    const kids = new Map(guardians.map((guardian) => [guardian.id, guardian.students.map((link) => fullName(link.student))]));
    return {
      recipients: deliveries.map((delivery) => ({
        id: delivery.id, name: delivery.recipientName, children: delivery.guardianId ? kids.get(delivery.guardianId) ?? [] : [], status: delivery.status, reason: delivery.failureReason, text: delivery.body,
        readAt: delivery.readAt?.toISOString() ?? null, acknowledgeAsked: delivery.acknowledgeAsked, acknowledgedAt: delivery.acknowledgedAt?.toISOString() ?? null,
        replies: replies.filter((reply) => reply.deliveryId === delivery.id).map((reply) => ({ text: reply.detail, at: reply.createdAt.toISOString() })),
      })),
    };
  }
}
