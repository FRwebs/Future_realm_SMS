import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PartnerDealStatus } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../../../src/lib/db/prisma";
import type {
  SuperAdminPartnerCommissionStatement,
  SuperAdminPartnerCommissionSummaryRow,
  SuperAdminPartnerDealRow,
  SuperAdminPartnerRow
} from "../../../../src/lib/domain/types";

/**
 * Transaction statuses that count as "reconciled money in the bank" for commission
 * purposes. "SUCCESS" is the literal status the platform billing flow writes when a
 * payment is recorded (see SuperAdminService.recordInvoicePayment), so it is always
 * included. "PAID" and "COMPLETED" are included too because they are the same
 * successful-transaction convention already used by the platform revenue dashboard
 * aggregates in SuperAdminService (getPlatformDashboard / getRevenueReport) — matching
 * that convention keeps commission figures consistent with the numbers Finance already
 * sees elsewhere in the product.
 */
const RECONCILED_TRANSACTION_STATUSES = ["SUCCESS", "PAID", "COMPLETED"] as const;

const DEAL_VALIDITY_DAYS = 90;

const partnerCreateSchema = z.object({
  name: z.string().trim().min(2, "Partner name is required."),
  territory: z.string().trim().optional().or(z.literal("")),
  agreementReference: z.string().trim().optional().or(z.literal("")),
  agreementValidTo: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), "Invalid agreement expiry date."),
  commissionRatePercent: z.coerce.number().min(0).max(100).optional()
});

const dealCreateSchema = z.object({
  partnerId: z.string().trim().min(1, "Select a partner."),
  prospectSchoolName: z.string().trim().min(2, "Prospect school name is required."),
  prospectLocation: z.string().trim().optional().or(z.literal("")),
  expectedTier: z.string().trim().optional().or(z.literal("")),
  stream: z.string().trim().optional().or(z.literal("")),
  introductionEvidence: z.string().trim().optional().or(z.literal("")),
  commissionRatePercent: z.coerce.number().min(0).max(100).optional()
});

const dealConvertSchema = z.object({
  schoolId: z.string().trim().min(1, "Select the school this prospect converted into.")
});

function toNumber(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

function emptyToUndefined(value: string | undefined | null) {
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

@Injectable()
export class PartnersService {
  async listPartners(): Promise<SuperAdminPartnerRow[]> {
    const partners = await prisma.partner.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { deals: true } } }
    });

    return partners.map((partner) => ({
      id: partner.id,
      name: partner.name,
      territory: partner.territory,
      agreementReference: partner.agreementReference,
      agreementValidTo: partner.agreementValidTo ? partner.agreementValidTo.toISOString() : null,
      commissionRatePercent: toNumber(partner.commissionRatePercent),
      isActive: partner.isActive,
      createdAt: partner.createdAt.toISOString(),
      dealCount: partner._count.deals
    }));
  }

  async createPartner(body: unknown): Promise<SuperAdminPartnerRow> {
    const parsed = partnerCreateSchema.parse(body);

    const partner = await prisma.partner.create({
      data: {
        name: parsed.name,
        territory: emptyToUndefined(parsed.territory) ?? null,
        agreementReference: emptyToUndefined(parsed.agreementReference) ?? null,
        agreementValidTo: emptyToUndefined(parsed.agreementValidTo) ? new Date(parsed.agreementValidTo as string) : null,
        commissionRatePercent: parsed.commissionRatePercent ?? undefined
      },
      include: { _count: { select: { deals: true } } }
    });

    return {
      id: partner.id,
      name: partner.name,
      territory: partner.territory,
      agreementReference: partner.agreementReference,
      agreementValidTo: partner.agreementValidTo ? partner.agreementValidTo.toISOString() : null,
      commissionRatePercent: toNumber(partner.commissionRatePercent),
      isActive: partner.isActive,
      createdAt: partner.createdAt.toISOString(),
      dealCount: partner._count.deals
    };
  }

  /**
   * Sums reconciled PlatformBillingTransaction amounts for a school and applies the
   * deal's commission rate. Always recomputed live — never stored.
   */
  private async computeCommissionForSchool(schoolId: string, commissionRatePercent: number) {
    const aggregate = await prisma.platformBillingTransaction.aggregate({
      where: { schoolId, status: { in: [...RECONCILED_TRANSACTION_STATUSES] } },
      _sum: { amount: true }
    });

    const grossRevenue = toNumber(aggregate._sum.amount);
    const commissionOwed = Math.round(grossRevenue * (commissionRatePercent / 100) * 100) / 100;

    return { grossRevenue, commissionOwed };
  }

  async listDeals(status?: string): Promise<SuperAdminPartnerDealRow[]> {
    const statusFilter =
      status && (Object.values(PartnerDealStatus) as string[]).includes(status) ? (status as PartnerDealStatus) : undefined;

    const deals = await prisma.partnerDeal.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      orderBy: { registeredAt: "desc" },
      include: { partner: true, school: { select: { id: true, name: true } } }
    });

    const rows: SuperAdminPartnerDealRow[] = [];
    for (const deal of deals) {
      let grossRevenue = 0;
      let commissionOwed = 0;
      const commissionRatePercent = toNumber(deal.commissionRatePercent);

      if (deal.schoolId && (deal.status === "CONVERTED" || deal.status === "COMMISSION_PAID")) {
        const computed = await this.computeCommissionForSchool(deal.schoolId, commissionRatePercent);
        grossRevenue = computed.grossRevenue;
        commissionOwed = computed.commissionOwed;
      }

      rows.push({
        id: deal.id,
        partnerId: deal.partnerId,
        partnerName: deal.partner.name,
        schoolId: deal.schoolId,
        schoolName: deal.school?.name ?? null,
        prospectSchoolName: deal.prospectSchoolName,
        prospectLocation: deal.prospectLocation,
        expectedTier: deal.expectedTier,
        stream: deal.stream,
        introductionEvidence: deal.introductionEvidence,
        registeredAt: deal.registeredAt.toISOString(),
        validUntil: deal.validUntil.toISOString(),
        status: deal.status,
        commissionRatePercent,
        convertedAt: deal.convertedAt ? deal.convertedAt.toISOString() : null,
        createdAt: deal.createdAt.toISOString(),
        grossRevenue,
        commissionOwed
      });
    }

    return rows;
  }

  async createDeal(userId: string, body: unknown): Promise<SuperAdminPartnerDealRow> {
    const parsed = dealCreateSchema.parse(body);

    const partner = await prisma.partner.findUnique({ where: { id: parsed.partnerId } });
    if (!partner) throw new NotFoundException("Partner not found.");

    const registeredAt = new Date();
    const validUntil = new Date(registeredAt.getTime() + DEAL_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

    const deal = await prisma.partnerDeal.create({
      data: {
        partnerId: partner.id,
        prospectSchoolName: parsed.prospectSchoolName,
        prospectLocation: emptyToUndefined(parsed.prospectLocation) ?? null,
        expectedTier: emptyToUndefined(parsed.expectedTier) ?? null,
        stream: emptyToUndefined(parsed.stream) ?? null,
        introductionEvidence: emptyToUndefined(parsed.introductionEvidence) ?? null,
        registeredAt,
        validUntil,
        commissionRatePercent: parsed.commissionRatePercent ?? partner.commissionRatePercent,
        createdById: userId
      },
      include: { partner: true, school: { select: { id: true, name: true } } }
    });

    return {
      id: deal.id,
      partnerId: deal.partnerId,
      partnerName: deal.partner.name,
      schoolId: deal.schoolId,
      schoolName: deal.school?.name ?? null,
      prospectSchoolName: deal.prospectSchoolName,
      prospectLocation: deal.prospectLocation,
      expectedTier: deal.expectedTier,
      stream: deal.stream,
      introductionEvidence: deal.introductionEvidence,
      registeredAt: deal.registeredAt.toISOString(),
      validUntil: deal.validUntil.toISOString(),
      status: deal.status,
      commissionRatePercent: toNumber(deal.commissionRatePercent),
      convertedAt: deal.convertedAt ? deal.convertedAt.toISOString() : null,
      createdAt: deal.createdAt.toISOString(),
      grossRevenue: 0,
      commissionOwed: 0
    };
  }

  private async getDealOrThrow(dealId: string) {
    const deal = await prisma.partnerDeal.findUnique({ where: { id: dealId } });
    if (!deal) throw new NotFoundException("Deal not found.");
    return deal;
  }

  async convertDeal(dealId: string, body: unknown) {
    const parsed = dealConvertSchema.parse(body);
    const deal = await this.getDealOrThrow(dealId);

    if (deal.status === "CONVERTED" || deal.status === "COMMISSION_PAID") {
      throw new BadRequestException("This deal has already been converted.");
    }

    const school = await prisma.school.findUnique({ where: { id: parsed.schoolId }, select: { id: true, name: true, deletedAt: true } });
    if (!school || school.deletedAt) throw new NotFoundException("School not found.");

    const existingConvertedDeal = await prisma.partnerDeal.findFirst({
      where: { schoolId: parsed.schoolId, status: { in: ["CONVERTED", "COMMISSION_PAID"] }, id: { not: dealId } }
    });
    if (existingConvertedDeal) {
      throw new BadRequestException(`${school.name} is already linked to another converted partner deal.`);
    }

    await prisma.partnerDeal.update({
      where: { id: dealId },
      data: { status: "CONVERTED", schoolId: parsed.schoolId, convertedAt: new Date() }
    });

    return { ok: true };
  }

  async expireDeal(dealId: string) {
    const deal = await this.getDealOrThrow(dealId);
    if (deal.status !== "REGISTERED") {
      throw new BadRequestException("Only a registered deal can be marked expired.");
    }

    await prisma.partnerDeal.update({ where: { id: dealId }, data: { status: "EXPIRED" } });
    return { ok: true };
  }

  async markCommissionPaid(dealId: string) {
    const deal = await this.getDealOrThrow(dealId);
    if (deal.status !== "CONVERTED") {
      throw new BadRequestException("Only a converted deal with commission owed can be marked paid.");
    }

    await prisma.partnerDeal.update({ where: { id: dealId }, data: { status: "COMMISSION_PAID" } });
    return { ok: true };
  }

  async getCommissionSummary(): Promise<SuperAdminPartnerCommissionSummaryRow[]> {
    const partners = await prisma.partner.findMany({
      orderBy: { name: "asc" },
      include: {
        deals: {
          where: { status: { in: ["CONVERTED", "COMMISSION_PAID"] }, schoolId: { not: null } },
          include: { school: { select: { id: true, name: true } } }
        }
      }
    });

    const summary: SuperAdminPartnerCommissionSummaryRow[] = [];

    for (const partner of partners) {
      const statements: SuperAdminPartnerCommissionStatement[] = [];
      let totalCommissionOwed = 0;
      let totalCommissionPaid = 0;
      let totalCommissionPending = 0;

      for (const deal of partner.deals) {
        if (!deal.schoolId || !deal.school) continue;
        const commissionRatePercent = toNumber(deal.commissionRatePercent);
        const { grossRevenue, commissionOwed } = await this.computeCommissionForSchool(deal.schoolId, commissionRatePercent);

        statements.push({
          dealId: deal.id,
          schoolId: deal.schoolId,
          schoolName: deal.school.name,
          commissionRatePercent,
          grossRevenue,
          commissionOwed,
          status: deal.status
        });

        totalCommissionOwed += commissionOwed;
        if (deal.status === "COMMISSION_PAID") {
          totalCommissionPaid += commissionOwed;
        } else {
          totalCommissionPending += commissionOwed;
        }
      }

      summary.push({
        partnerId: partner.id,
        partnerName: partner.name,
        territory: partner.territory,
        convertedDealCount: partner.deals.length,
        totalCommissionOwed: Math.round(totalCommissionOwed * 100) / 100,
        totalCommissionPaid: Math.round(totalCommissionPaid * 100) / 100,
        totalCommissionPending: Math.round(totalCommissionPending * 100) / 100,
        statements
      });
    }

    return summary;
  }
}
