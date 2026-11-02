import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { MessageCampaignStatus, MessageDeliveryStatus, NotificationChannel, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { prisma } from "../../../../src/lib/db/prisma";
import { familyAllows, whatsappChosen, type FamilyChoices } from "../../../../src/lib/messaging/family-choices";
import { joinNames, mergeBody, reachOf, smsSegments, unknownFields, whatsappText, type Channel } from "../../../../src/lib/messaging/merge";
import { plansFeatures } from "../plans-features/plans-features.service";

import { armName, fullName } from "../fee-management/fees.shared";

export const SMS_NAIRA = 3.8;
const bad = (body: string) => { const names = unknownFields(body); return names.length ? `${names.map((name) => `{${name}}`).join(", ")} ${names.length === 1 ? "is not a merge field" : "are not merge fields"} — use {Guardian}, {Child} or {Class}.` : null; };

export type Family = {
  id: string; name: string; phone: string | null; email: string | null; canSms: boolean; canEmail: boolean; canWhatsApp?: boolean; userId: string | null; language: string;
  children: string[]; arms: string[];
  /** Each child with the class they sit in, so a family that asked for one message per child can be written to child by child. */
  kids?: Array<{ first: string; arm: string }>;
  /** What this family chose to hear by SMS and email; null when they never chose. */
  choices?: FamilyChoices;
};
export type PlannedRow = Family & { text: string; segments: number; reachable: boolean; reason: string | null };

/**
 * Takes a school message the rest of the way to a family.
 *
 * One path for every sender — a form master, the office, an approval that was waiting — so a message means the same thing whoever wrote it:
 *  - each family's own words, merge fields resolved against their own record;
 *  - the cost counted per family (a long SMS is more than one credit) and taken from the school's wallet at the moment it goes, with a
 *    ledger row, never before and never twice;
 *  - one row per recipient saying what happened to them — in-app is delivered by being in the family's inbox, SMS and email are queued for the
 *    carrier and only become "delivered" when the carrier says so, and a family that cannot be reached is recorded as such, not as a failure.
 */
@Injectable()
export class FamilyDispatchService {
  /** The families a send addresses: never a merged-away duplicate, never a guardian the Safeguarding Lead has restricted. */
  async families(schoolId: string, guardianIds?: string[]): Promise<Family[]> {
    const rows = await prisma.guardian.findMany({
      where: { schoolId, mergedIntoId: null, safeguardingRestrictedAt: null, ...(guardianIds ? { id: { in: guardianIds } } : { students: { some: {} } }) },
      take: guardianIds ? undefined : 2000,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: { students: { include: { student: { select: { firstName: true, lastName: true, status: true, currentClass: { select: { name: true, arm: true } } } } } } },
    });
    const accounts = await prisma.user.findMany({ where: { id: { in: rows.map((guardian) => guardian.userId).filter((id): id is string => Boolean(id)) } }, select: { id: true, preferences: true } });
    const chosen = new Map(accounts.map((account) => [account.id, account.preferences as FamilyChoices]));
    return rows.map((guardian) => {
      const kids = guardian.students.filter((link) => link.student.status === "ACTIVE");
      return {
        id: guardian.id, name: fullName(guardian), phone: guardian.phone, email: guardian.email, canSms: guardian.canReceiveSms, canEmail: guardian.canReceiveEmail, canWhatsApp: guardian.userId ? whatsappChosen(chosen.get(guardian.userId)) : false, userId: guardian.userId, language: guardian.language, choices: guardian.userId ? chosen.get(guardian.userId) ?? null : null,
        kids: kids.map((link) => ({ first: link.student.firstName, arm: link.student.currentClass ? armName(link.student.currentClass) : "" })),
        children: kids.map((link) => link.student.firstName), arms: [...new Set(kids.map((link) => (link.student.currentClass ? armName(link.student.currentClass) : "")).filter(Boolean))],
      };
    });
  }

  /** What each family would read and what it would cost, before anything is sent. */
  plan(channel: Channel, body: string, families: Family[], name = ""): { rows: PlannedRow[]; credits: number; reach: number } {
    const bad = unknownFields(body);
    if (bad.length) throw new BadRequestException(`${bad.map((name) => `{${name}}`).join(", ")} ${bad.length === 1 ? "is not a merge field" : "are not merge fields"} — use {Guardian}, {Child} or {Class}.`);
    // A family that asked for one message per child is written to child by child: the same words, each with that child's own name and class.
    const addressed = families.flatMap((family) =>
      family.choices?.digest === "separate" && (family.kids?.length ?? 0) > 1
        ? family.kids!.map((kid) => ({ ...family, children: [kid.first], arms: kid.arm ? [kid.arm] : [] }))
        : [family],
    );
    const rows = addressed.map((family) => {
      const text = mergeBody(body, { Guardian: family.name, Child: joinNames(family.children) || "your child", Class: joinNames(family.arms) || "your child’s class" });
      const contact = reachOf(channel, { phone: family.phone, email: family.email, canSms: family.canSms, canEmail: family.canEmail, canWhatsApp: family.canWhatsApp });
      // A family's own choice about what to hear by SMS or email comes after whether they can be reached at all.
      const reach = contact.ok ? familyAllows(family.choices, channel, `${name} ${body}`) : contact;
      return { ...family, text, segments: channel === "SMS" ? smsSegments(text) : channel === "WHATSAPP" && reach.ok ? 1 : 0, reachable: reach.ok, reason: reach.ok ? null : reach.reason };
    });
    const reached = rows.filter((row) => row.reachable);
    return { rows, credits: reached.reduce((sum, row) => sum + row.segments, 0), reach: reached.length };
  }

  /** The words a family reads as the title of a message: the first line, trimmed. */
  titleOf(text: string) {
    const first = text.split(/\n/)[0] ?? text;
    return first.length > 70 ? `${first.slice(0, 67)}…` : first;
  }

  /** Send one campaign: take the credits, write a row per family, queue what needs a carrier. Safe to call once; a second call finds it sent. */
  async dispatch(campaignId: string, approvedById?: string) {
    const campaign = await prisma.messageCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException("That send is not in this school's list.");
    if (campaign.status === MessageCampaignStatus.SENT) return { reach: campaign.recipientCount, credits: campaign.creditsUsed, already: true };
    const audience = (campaign.audience ?? {}) as { guardianIds?: string[]; acknowledge?: boolean };
    const channel = campaign.channel as Channel;
    const families = await this.families(campaign.schoolId, audience.guardianIds);
    if (!families.length) throw new BadRequestException("Nobody is on record for that audience, so there is nothing to send.");
    const planned = this.plan(channel, campaign.body, families, campaign.name);
    if (!planned.reach) throw new BadRequestException("Nobody in that audience can be reached on this channel, so there is nothing to send. Fix the contact details first.");
    const school = await prisma.school.findUnique({ where: { id: campaign.schoolId }, select: { name: true } });
    const stamp = new Date();
    const sms = channel === "SMS";
    const email = channel === "EMAIL";
    const whatsapp = channel === "WHATSAPP";
    // A plan without WhatsApp cannot send it; saying so now is kinder than queueing messages the delivery worker would refuse.
    if (whatsapp) {
      const allowed = await plansFeatures.entitled(campaign.schoolId, "communications.whatsapp");
      if (!allowed.allowed) throw new BadRequestException(`WhatsApp is not part of this school's plan. ${allowed.why}`);
    }
    const field = whatsapp ? "whatsappBalance" : "smsBalance";
    const template = { name: process.env.WHATSAPP_TEMPLATE_NAME?.trim() || "school_message", language: process.env.WHATSAPP_LANGUAGE?.trim() || "en" };

    await prisma.$transaction(async (tx) => {
      if (planned.credits > 0) {
        const taken = await tx.notificationWallet.updateMany({ where: { schoolId: campaign.schoolId, [field]: { gte: planned.credits } }, data: { [field]: { decrement: planned.credits } } });
        if (!taken.count) {
          const wallet = await tx.notificationWallet.findUnique({ where: { schoolId: campaign.schoolId } });
          throw new BadRequestException(`This would cost ${planned.credits} credits and the school has ${(whatsapp ? wallet?.whatsappBalance : wallet?.smsBalance) ?? 0}. Send it in-app, or ask the office to top up.`);
        }
        await tx.creditLedger.create({ data: { schoolId: campaign.schoolId, channel: whatsapp ? "WHATSAPP" : "SMS", kind: "USED", credits: -planned.credits, note: `${campaign.name}`.slice(0, 120) } });
      }
      const deliveries: Prisma.MessageDeliveryCreateManyInput[] = [];
      const logs: Prisma.NotificationLogCreateManyInput[] = [];
      for (const row of planned.rows) {
        const id = randomUUID();
        const needsCarrier = (sms || email || whatsapp) && row.reachable;
        const logId = needsCarrier || (channel === "IN_APP" && row.userId) ? randomUUID() : null;
        deliveries.push({
          id, schoolId: campaign.schoolId, campaignId: campaign.id, guardianId: row.id, recipientName: row.name, destination: sms || whatsapp ? row.phone : email ? row.email : "In-app",
          status: !row.reachable ? MessageDeliveryStatus.EXCLUDED : needsCarrier ? MessageDeliveryStatus.PENDING : MessageDeliveryStatus.DELIVERED,
          failureReason: row.reason, deliveredAt: row.reachable && !needsCarrier ? stamp : null, body: row.text, channel: campaign.channel, credits: row.reachable ? row.segments : 0,
          acknowledgeAsked: Boolean(audience.acknowledge), logId,
        });
        if (logId && row.reachable) {
          logs.push({
            id: logId, schoolId: campaign.schoolId, userId: row.userId ?? undefined, channel: campaign.channel, title: school?.name ?? "Your school", body: row.text,
            status: needsCarrier ? "QUEUED" : "SENT", sentAt: stamp,
            metadata: {
              campaignId: campaign.id, deliveryId: id,
              ...(sms ? { phone: row.phone, credits: row.segments, prepaid: true } : {}),
              ...(whatsapp ? { phone: row.phone, credits: row.segments, prepaid: true, template: { ...template, params: [whatsappText(row.text)] } } : {}),
              ...(email ? { email: row.email } : {}),
            } as Prisma.InputJsonValue,
          });
        }
      }
      await tx.messageDelivery.createMany({ data: deliveries });
      if (logs.length) await tx.notificationLog.createMany({ data: logs });
      await tx.messageCampaign.update({
        where: { id: campaign.id },
        data: {
          status: MessageCampaignStatus.SENT, sentAt: stamp, recipientCount: planned.reach, creditsUsed: planned.credits, ...(approvedById ? { approvedById } : {}),
          deliveredCount: deliveries.filter((row) => row.status === MessageDeliveryStatus.DELIVERED).length, failedCount: 0,
        },
      });
    });
    return { reach: planned.reach, credits: planned.credits, already: false };
  }

  /**
   * The same for staff: they are reached through their account, so an account that is not active is left out rather than failed, and the
   * credits and carrier queue work exactly as they do for a family. Safe to call after a send to families (an "everyone" send), in which case
   * it adds to that send's counts instead of closing it.
   */
  async dispatchStaff(campaignId: string, approvedById?: string) {
    const campaign = await prisma.messageCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException("That send is not in this school's list.");
    const alone = campaign.status !== MessageCampaignStatus.SENT;
    const channel = campaign.channel as Channel;
    const sms = channel === "SMS";
    const email = channel === "EMAIL";
    const people = await prisma.staffProfile.findMany({ where: { schoolId: campaign.schoolId }, take: 500, include: { user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, accountStatus: true } } } });
    const unbadged = bad(campaign.body);
    if (unbadged) throw new BadRequestException(unbadged);
    const rows = people.map((person) => {
      const active = person.user.accountStatus === "ACTIVE";
      const reach = active ? reachOf(channel, { phone: person.user.phone, email: person.user.email, canSms: true, canEmail: true }) : ({ ok: false, reason: "Account is not active, so nothing was sent." } as const);
      const text = mergeBody(campaign.body, { Guardian: fullName(person.user), Child: "", Class: "" });
      return { user: person.user, text, reachable: reach.ok, reason: reach.ok ? null : reach.reason, segments: sms && reach.ok ? smsSegments(text) : 0 };
    });
    const reached = rows.filter((row) => row.reachable);
    if (!reached.length) throw new BadRequestException("Nobody in that audience can be reached on this channel, so there is nothing to send.");
    const credits = reached.reduce((sum, row) => sum + row.segments, 0);
    const school = await prisma.school.findUnique({ where: { id: campaign.schoolId }, select: { name: true } });
    const stamp = new Date();
    await prisma.$transaction(async (tx) => {
      if (credits > 0) {
        const taken = await tx.notificationWallet.updateMany({ where: { schoolId: campaign.schoolId, smsBalance: { gte: credits } }, data: { smsBalance: { decrement: credits } } });
        if (!taken.count) {
          const wallet = await tx.notificationWallet.findUnique({ where: { schoolId: campaign.schoolId } });
          throw new BadRequestException(`This would cost ${credits} credits and the school has ${wallet?.smsBalance ?? 0}. Send it in-app, or ask the office to top up.`);
        }
        await tx.creditLedger.create({ data: { schoolId: campaign.schoolId, channel: "SMS", kind: "USED", credits: -credits, note: `${campaign.name} · staff`.slice(0, 120) } });
      }
      const deliveries: Prisma.MessageDeliveryCreateManyInput[] = [];
      const logs: Prisma.NotificationLogCreateManyInput[] = [];
      for (const row of rows) {
        const id = randomUUID();
        const needsCarrier = (sms || email) && row.reachable;
        const logId = row.reachable ? randomUUID() : null;
        deliveries.push({
          id, schoolId: campaign.schoolId, campaignId: campaign.id, recipientName: fullName(row.user), destination: sms ? row.user.phone : email ? row.user.email : "In-app",
          status: !row.reachable ? MessageDeliveryStatus.EXCLUDED : needsCarrier ? MessageDeliveryStatus.PENDING : MessageDeliveryStatus.DELIVERED,
          failureReason: row.reason, deliveredAt: row.reachable && !needsCarrier ? stamp : null, body: row.text, channel: campaign.channel, credits: row.reachable ? row.segments : 0, logId,
        });
        if (logId) {
          logs.push({
            id: logId, schoolId: campaign.schoolId, userId: row.user.id, channel: campaign.channel, title: school?.name ?? "Your school", body: row.text, status: needsCarrier ? "QUEUED" : "SENT", sentAt: stamp,
            metadata: { campaignId: campaign.id, deliveryId: id, ...(sms ? { phone: row.user.phone, credits: row.segments, prepaid: true } : {}), ...(email ? { email: row.user.email } : {}) } as Prisma.InputJsonValue,
          });
        }
      }
      await tx.messageDelivery.createMany({ data: deliveries });
      if (logs.length) await tx.notificationLog.createMany({ data: logs });
      const delivered = deliveries.filter((row) => row.status === MessageDeliveryStatus.DELIVERED).length;
      await tx.messageCampaign.update({
        where: { id: campaign.id },
        data: alone
          ? { status: MessageCampaignStatus.SENT, sentAt: stamp, recipientCount: reached.length, creditsUsed: credits, deliveredCount: delivered, failedCount: 0, ...(approvedById ? { approvedById } : {}) }
          : { recipientCount: { increment: reached.length }, creditsUsed: { increment: credits }, deliveredCount: { increment: delivered } },
      });
    });
    return { reach: reached.length, credits };
  }
}

export const channelOf = (value: NotificationChannel | string): Channel => (value === "SMS" ? "SMS" : value === "EMAIL" ? "EMAIL" : value === "WHATSAPP" ? "WHATSAPP" : "IN_APP");
