import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AutomationTrigger,
  MessageCampaignStatus,
  MessageDeliveryStatus,
  NotificationChannel,
  Prisma,
  TemplateOwner,
} from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { FamilyDispatchService } from "./family-dispatch.service";

/**
 * M12 Communication Center.
 *
 * The rule the whole module is built around: the number you approve is the
 * number that gets delivered. Everything here counts who can actually be
 * reached *before* quoting a cost, so a send never promises more than it does.
 */

/** What one SMS costs a school, in naira. Credits are one per recipient. */
const SMS_NAIRA = 3.8;

/** What the registry writes into a required phone column when none is known. */
const UNREACHABLE_PHONE = "\u2014";

const composeSchema = z.object({
  name: z.string().trim().min(3, "Give the send a name somebody will recognise later."),
  audience: z.enum(["One person", "Selected people", "Guardians", "Staff", "Everyone"]).optional(),
  channel: z.nativeEnum(NotificationChannel).default(NotificationChannel.SMS),
  body: z.string().trim().min(8, "A message needs something in it."),
  scheduledAt: z.string().datetime().optional(),
});

const decisionSchema = z.object({
  action: z.enum(["APPROVE", "RETURN", "CANCEL"]),
  note: z.string().trim().optional(),
});

const ruleSchema = z.object({
  isActive: z.boolean().optional(),
  channel: z.string().trim().optional(),
  timing: z.string().trim().optional(),
  audience: z.string().trim().optional(),
});

/**
 * The nine rules the mockup names, four of them locked.
 *
 * A mandatory rule carries its reason in one sentence, because "you cannot turn
 * this off" without a reason is how a setting page loses an argument with a
 * principal.
 */
const DEFAULT_RULES: Array<{
  name: string;
  trigger: AutomationTrigger;
  channel: string;
  timing: string;
  audience: string;
  template: string;
  isMandatory: boolean;
  lockedReason?: string;
}> = [
  {
    name: "Result published",
    trigger: AutomationTrigger.RESULT_PUBLISHED,
    channel: "SMS + in-app",
    timing: "Immediately",
    audience: "Guardians of the arm",
    template: "Result published",
    isMandatory: true,
    lockedReason: "A parent must know their child's result is out.",
  },
  {
    name: "Result revised",
    trigger: AutomationTrigger.RESULT_REVISED,
    channel: "SMS + in-app",
    timing: "Immediately",
    audience: "Guardian of the student",
    template: "Result revised",
    isMandatory: true,
    lockedReason: "A changed result must never arrive silently.",
  },
  {
    name: "Payment reversal",
    trigger: AutomationTrigger.PAYMENT_REVERSAL,
    channel: "SMS + in-app",
    timing: "Immediately",
    audience: "Guardian and Bursar",
    template: "Payment reversed",
    isMandatory: true,
    lockedReason: "Money leaving a ledger is always announced.",
  },
  {
    name: "Emergency broadcast",
    trigger: AutomationTrigger.EMERGENCY_BROADCAST,
    channel: "All channels",
    timing: "Immediately",
    audience: "Every family",
    template: "Emergency broadcast",
    isMandatory: true,
    lockedReason: "Bypasses scheduling, rate limits and opt-outs.",
  },
  {
    name: "Approval decision",
    trigger: AutomationTrigger.APPROVAL_DECISION,
    channel: "In-app",
    timing: "Immediately",
    audience: "The requester",
    template: "Approval decision",
    isMandatory: false,
  },
  {
    name: "Absence recorded",
    trigger: AutomationTrigger.ABSENCE_RECORDED,
    channel: "SMS",
    timing: "16:00 daily",
    audience: "Guardian of the student",
    template: "Absence recorded",
    isMandatory: false,
  },
  {
    name: "Chronic absence threshold crossed",
    trigger: AutomationTrigger.CONSECUTIVE_ABSENCE,
    channel: "SMS + in-app",
    timing: "Immediately",
    audience: "Guardian and form master",
    template: "Chronic absence",
    isMandatory: false,
  },
  {
    name: "Invoice published",
    trigger: AutomationTrigger.INVOICE_PUBLISHED,
    channel: "SMS + email",
    timing: "On publication",
    audience: "Guardians billed",
    template: "Invoice published",
    isMandatory: false,
  },
  {
    name: "Fee reminder · first",
    trigger: AutomationTrigger.FEE_OVERDUE,
    channel: "SMS",
    timing: "Day 14",
    audience: "Families overdue",
    template: "Fee reminder · first",
    isMandatory: false,
  },
];

const DEFAULT_TEMPLATES: Array<{
  name: string;
  channel: NotificationChannel;
  body: string;
  variables: string[];
  owner: TemplateOwner;
}> = [
  {
    name: "Fee reminder · second",
    channel: NotificationChannel.SMS,
    body: "Dear {{guardian_title}} {{guardian_surname}}, {{student_first_name}}'s balance of {{outstanding_amount}} is now overdue. Kindly settle at the bursary.",
    variables: ["guardian_title", "guardian_surname", "student_first_name", "outstanding_amount"],
    owner: TemplateOwner.SCHOOL,
  },
  {
    name: "Result published",
    channel: NotificationChannel.SMS,
    body: "Dear {{guardian_title}} {{guardian_surname}}, {{student_first_name}}'s result for {{term}} has been published.",
    variables: ["guardian_title", "guardian_surname", "student_first_name"],
    owner: TemplateOwner.SCHOOL,
  },
  {
    name: "Consent request",
    channel: NotificationChannel.SMS,
    body: "Dear {{guardian_title}} {{guardian_surname}}, please confirm consent for {{student_first_name}}.",
    variables: ["guardian_title", "student_first_name"],
    owner: TemplateOwner.SCHOOL,
  },
  {
    name: "Absence recorded",
    channel: NotificationChannel.SMS,
    body: "{{student_first_name}} was marked absent on {{date}}.",
    variables: ["student_first_name", "date"],
    owner: TemplateOwner.SYSTEM,
  },
];

export type AudienceSnapshot = {
  key: string;
  matched: number;
  unreachable: number;
  reach: number;
  credits: number;
  naira: number;
  description: string;
};

@Injectable()
export class CommunicationCenterService {
  constructor(private readonly dispatcher: FamilyDispatchService) {}

  ok<T>(data: Promise<T> | T, message = "Request completed") {
    return Promise.resolve(data).then((resolved) => ({
      ok: true,
      success: true,
      message,
      data: resolved,
    }));
  }

  /**
   * The mass-communication threshold, read from the same ConfigurationItem row
   * Module 2 · Policies writes. The mockup is explicit that this is one record
   * shown in two places; reading a second copy here is how the two drift.
   */
  private async threshold(schoolId: string): Promise<number> {
    const row = await prisma.configurationItem.findFirst({
      where: { schoolId, resource: "school-policies", code: "mass_communication_threshold", deletedAt: null },
      select: { data: true },
    });
    const mode = (row?.data as { values?: { mode?: string } } | null)?.values?.mode;
    if (mode === "Never needs approval") return Number.POSITIVE_INFINITY;
    const parsed = mode ? Number(mode.replace(/\D+/g, "")) : NaN;
    // The product default, and what Policies shows until a school changes it.
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 150;
  }

  /**
   * Who a send would reach, and who it would miss.
   *
   * Unreachable people are excluded *before* the count, never after: a guardian
   * with no phone number cannot receive an SMS, so counting them would quote a
   * cost for a message that was never going to arrive.
   */
  async audience(session: SessionPayload, key = "Guardians"): Promise<AudienceSnapshot[]> {
    const schoolId = session.schoolId;

    const [guardians, guardiansNoPhone, staff, staffInactive] = await Promise.all([
      prisma.guardian.count({ where: { schoolId } }),
      // Guardian.phone is a non-null column, so "no number" shows up as an empty
      // string or the em dash the registry writes when there is nothing on file.
      prisma.guardian.count({ where: { schoolId, OR: [{ phone: "" }, { phone: UNREACHABLE_PHONE }] } }),
      prisma.staffProfile.count({ where: { schoolId } }),
      prisma.staffProfile.count({ where: { schoolId, user: { accountStatus: { not: "ACTIVE" } } } }),
    ]);

    const make = (
      name: string,
      matched: number,
      unreachable: number,
      description: string,
    ): AudienceSnapshot => {
      const reach = Math.max(0, matched - unreachable);
      return {
        key: name,
        matched,
        unreachable,
        reach,
        credits: reach,
        naira: Math.round(reach * SMS_NAIRA * 100) / 100,
        description,
      };
    };

    const all: AudienceSnapshot[] = [
      make("One person", 1, 0, "A single guardian or staff member, by name."),
      make("Selected people", 0, 0, "A handful you pick by hand."),
      make("Guardians", guardians, guardiansNoPhone, "Every family, or a filtered group of them."),
      make("Staff", staff, staffInactive, "Teaching and non-teaching staff."),
      make(
        "Everyone",
        guardians + staff,
        guardiansNoPhone + staffInactive,
        "Every guardian and every staff member at once.",
      ),
    ];

    // The caller asked about one, but the picker shows all five with their own
    // counts, so return the set and let it choose.
    void key;
    return all;
  }

  /** Everything the Sent tab paints, in one call. */
  async campaigns(session: SessionPayload) {
    const schoolId = session.schoolId;
    const [rows, threshold, wallet] = await Promise.all([
      prisma.messageCampaign.findMany({
        where: { schoolId },
        orderBy: [{ createdAt: "desc" }],
        take: 60,
        include: {
          createdBy: { select: { firstName: true, lastName: true, role: true } },
          approvedBy: { select: { firstName: true, lastName: true } },
        },
      }),
      this.threshold(schoolId),
      prisma.notificationWallet.findUnique({ where: { schoolId } }),
    ]);

    const failures = await prisma.messageDelivery.findMany({
      where: { schoolId, status: MessageDeliveryStatus.FAILED },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { campaign: { select: { name: true } } },
    });

    const creditsUsed = rows.reduce((sum, row) => sum + row.creditsUsed, 0);

    return {
      threshold: Number.isFinite(threshold) ? threshold : null,
      wallet: wallet ? { sms: wallet.smsBalance, low: wallet.smsBalance <= wallet.lowBalanceThreshold } : null,
      stats: {
        campaigns: rows.length,
        creditsUsed,
        naira: Math.round(creditsUsed * SMS_NAIRA * 100) / 100,
        awaiting: rows.filter((row) => row.status === MessageCampaignStatus.AWAITING_APPROVAL).length,
        failed: rows.reduce((sum, row) => sum + row.failedCount, 0),
        scheduled: rows.filter((row) => row.status === MessageCampaignStatus.SCHEDULED).length,
      },
      campaigns: rows.map((row) => ({
        id: row.id,
        name: row.name,
        channel: row.channel,
        audienceLabel: row.audienceLabel,
        status: row.status,
        recipientCount: row.recipientCount,
        deliveredCount: row.deliveredCount,
        failedCount: row.failedCount,
        creditsUsed: row.creditsUsed,
        thresholdAt: row.thresholdAt,
        decisionNote: row.decisionNote,
        scheduledAt: row.scheduledAt?.toISOString() ?? null,
        sentAt: row.sentAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        senderName: row.createdBy
          ? `${row.createdBy.firstName} ${row.createdBy.lastName}`.trim()
          : "Automation",
        senderRole: row.createdBy?.role ?? null,
        approvedBy: row.approvedBy
          ? `${row.approvedBy.firstName} ${row.approvedBy.lastName}`.trim()
          : null,
      })),
      failures: failures.map((row) => ({
        id: row.id,
        recipientName: row.recipientName,
        destination: row.destination,
        campaignName: row.campaign.name,
        reason: row.failureReason,
        at: row.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Compose a send.
   *
   * Above the school's threshold it does not go out — it becomes a decision,
   * which is the whole point of the threshold. Below it, the deliveries are
   * written straight away so the Sent tab shows real per-recipient outcomes
   * rather than a count nobody can audit.
   */
  async compose(session: SessionPayload, payload: unknown, to?: string) {
    const parsed = composeSchema.parse(payload);
    // The picker lives above the form and travels in the URL, so the audience
    // arrives on the query rather than as a field somebody retypes.
    const audienceKey = parsed.audience ?? to ?? "Guardians";
    const snapshots = await this.audience(session, audienceKey);
    const snapshot = snapshots.find((item) => item.key === audienceKey);
    if (!snapshot) throw new BadRequestException("That audience is not one this school can send to.");
    if (snapshot.reach === 0) {
      throw new BadRequestException(
        "Nobody in that audience can be reached, so there is nothing to send. Fix the contact details first.",
      );
    }

    if (audienceKey === "One person" || audienceKey === "Selected people") {
      throw new BadRequestException("Pick the families this goes to first — a message to named people is sent from a guardian's row or a form master's Compose, where the people are chosen.");
    }
    const threshold = await this.threshold(session.schoolId);
    const needsApproval = snapshot.reach > threshold;
    const toStaff = audienceKey === "Staff";

    // Written as a draft first: it is only "sent" once the dispatcher has taken the credits and written a row for each family.
    const campaign = await prisma.messageCampaign.create({
      data: {
        schoolId: session.schoolId,
        name: parsed.name,
        channel: parsed.channel,
        audienceLabel: audienceKey,
        audience: { key: audienceKey } as Prisma.InputJsonObject,
        body: parsed.body,
        status: needsApproval
          ? MessageCampaignStatus.AWAITING_APPROVAL
          : parsed.scheduledAt
            ? MessageCampaignStatus.SCHEDULED
            : MessageCampaignStatus.DRAFT,
        thresholdAt: Number.isFinite(threshold) ? threshold : null,
        scheduledAt: parsed.scheduledAt ? new Date(parsed.scheduledAt) : null,
        recipientCount: snapshot.reach,
        createdById: session.userId,
      },
    });

    let credits = 0;
    let status: MessageCampaignStatus = campaign.status;
    if (campaign.status === MessageCampaignStatus.DRAFT) {
      try {
        if (toStaff) {
          credits = (await this.dispatcher.dispatchStaff(campaign.id)).credits;
        } else {
          credits = (await this.dispatcher.dispatch(campaign.id)).credits;
          if (audienceKey === "Everyone") credits += (await this.dispatcher.dispatchStaff(campaign.id)).credits;
        }
        status = MessageCampaignStatus.SENT;
      } catch (error) {
        await prisma.messageCampaign.delete({ where: { id: campaign.id } });
        throw error;
      }
    }

    return {
      id: campaign.id,
      status,
      reach: snapshot.reach,
      unreachable: snapshot.unreachable,
      credits,
      threshold: Number.isFinite(threshold) ? threshold : null,
      needsApproval,
    };
  }

  /** Approve, return or cancel a send that is waiting on a decision. */
  async decide(session: SessionPayload, id: string, payload: unknown) {
    const parsed = decisionSchema.parse(payload);
    const campaign = await prisma.messageCampaign.findFirst({
      where: { id, schoolId: session.schoolId },
    });
    if (!campaign) throw new NotFoundException("That send is not in this school's list.");
    if (campaign.status !== MessageCampaignStatus.AWAITING_APPROVAL) {
      throw new BadRequestException(`This send is already ${campaign.status.toLowerCase().replace("_", " ")}.`);
    }
    // Segregation of duties: approving your own send defeats the threshold.
    if (parsed.action === "APPROVE" && campaign.createdById === session.userId) {
      throw new BadRequestException("You cannot approve a send you composed yourself.");
    }
    if (parsed.action !== "APPROVE" && !parsed.note) {
      throw new BadRequestException("Say why. A send returned without a reason cannot be corrected.");
    }

    if (parsed.action === "APPROVE") {
      // Approving sends it — to the families it was written for (a form master's class, not the whole school), at their own cost.
      const audience = (campaign.audience ?? {}) as { key?: string };
      if (audience.key === "Staff") await this.dispatcher.dispatchStaff(id, session.userId);
      else {
        await this.dispatcher.dispatch(id, session.userId);
        if (audience.key === "Everyone") await this.dispatcher.dispatchStaff(id);
      }
      if (parsed.note) await prisma.messageCampaign.update({ where: { id }, data: { decisionNote: parsed.note } });
      const updated = await prisma.messageCampaign.findUniqueOrThrow({ where: { id } });
      return { id: updated.id, status: updated.status };
    }

    const updated = await prisma.messageCampaign.update({
      where: { id },
      data: {
        status:
          parsed.action === "RETURN" ? MessageCampaignStatus.RETURNED : MessageCampaignStatus.CANCELLED,
        approvedById: session.userId,
        decisionNote: parsed.note,
      },
    });
    return { id: updated.id, status: updated.status };
  }

  /**
   * The notification rules, seeding the ones the product defines the first time
   * a school opens this tab. A school that has never touched them still has
   * them — that is what makes the four mandatory ones meaningful.
   */
  async rules(session: SessionPayload) {
    const schoolId = session.schoolId;
    const existing = await prisma.automationRule.findMany({ where: { schoolId }, select: { name: true } });
    const have = new Set(existing.map((row) => row.name));
    const missing = DEFAULT_RULES.filter((rule) => !have.has(rule.name));

    if (missing.length) {
      await prisma.automationRule.createMany({
        data: missing.map((rule) => ({
          schoolId,
          name: rule.name,
          trigger: rule.trigger,
          channel: rule.channel,
          audience: rule.audience,
          template: rule.template,
          timing: rule.timing,
          isMandatory: rule.isMandatory,
          lockedReason: rule.lockedReason ?? null,
          isActive: true,
        })),
        skipDuplicates: true,
      });
    }

    const rows = await prisma.automationRule.findMany({
      where: { schoolId },
      orderBy: [{ isMandatory: "desc" }, { name: "asc" }],
    });

    return {
      stats: {
        total: rows.length,
        enabled: rows.filter((row) => row.isActive && !row.isMandatory).length,
        mandatory: rows.filter((row) => row.isMandatory).length,
      },
      rules: rows.map((row) => ({
        id: row.id,
        name: row.name,
        channel: row.channel,
        timing: row.timing,
        audience: row.audience,
        isActive: row.isActive,
        isMandatory: row.isMandatory,
        lockedReason: row.lockedReason,
        lastRunAt: row.lastRunAt?.toISOString() ?? null,
        sendCount: row.sendCount,
      })),
    };
  }

  /** Turn a rule on or off. A mandatory rule refuses, and says why. */
  async updateRule(session: SessionPayload, id: string, payload: unknown) {
    const parsed = ruleSchema.parse(payload);
    const rule = await prisma.automationRule.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!rule) throw new NotFoundException("There is no such rule for this school.");
    if (rule.isMandatory && parsed.isActive === false) {
      throw new BadRequestException(
        rule.lockedReason
          ? `This rule cannot be switched off. ${rule.lockedReason}`
          : "This rule cannot be switched off.",
      );
    }

    const updated = await prisma.automationRule.update({
      where: { id },
      data: {
        isActive: parsed.isActive ?? rule.isActive,
        channel: parsed.channel ?? rule.channel,
        timing: parsed.timing ?? rule.timing,
        audience: parsed.audience ?? rule.audience,
      },
    });
    return { id: updated.id, isActive: updated.isActive };
  }

  /** The school's templates, seeded the same way the rules are. */
  async templates(session: SessionPayload) {
    const schoolId = session.schoolId;
    const existing = await prisma.schoolMessageTemplate.count({ where: { schoolId } });
    if (existing === 0) {
      await prisma.schoolMessageTemplate.createMany({
        data: DEFAULT_TEMPLATES.map((template) => ({ schoolId, ...template })),
        skipDuplicates: true,
      });
    }

    const rows = await prisma.schoolMessageTemplate.findMany({
      where: { schoolId },
      orderBy: [{ owner: "asc" }, { name: "asc" }],
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      channel: row.channel,
      owner: row.owner,
      version: row.version,
      variables: row.variables,
      body: row.body,
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    }));
  }
}
