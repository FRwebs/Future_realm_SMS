import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { PartnerDealStatus, Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../../../src/lib/db/prisma";
import { sendEmail } from "../../../../src/lib/integrations/mailer";
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
const EXPIRY_ALERT_WINDOW_DAYS = 14;

const optional = z.string().trim().optional().or(z.literal(""));
const partnerCreateSchema = z.object({
  name: z.string().trim().min(2, "Partner name is required."),
  email: z.string().trim().email("Invalid email address.").optional().or(z.literal("")),
  territory: optional,
  type: z.enum(["Reseller", "Consultant", "Association", "NGO", "Individual agent"]).optional(),
  tier: z.enum(["Bronze", "Silver", "Gold"]).optional(),
  registrationNumber: optional,
  agreementReference: optional,
  agreementVersion: optional,
  agreementValidTo: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), "Invalid agreement expiry date."),
  commissionRatePercent: z.coerce.number().min(0).max(100).optional(),
  streamARatePercent: z.coerce.number().min(0).max(100).optional(),
  /** "20, 12, 6" — what is paid in year one, two and three of a school's relationship. */
  yearRates: optional,
  primaryContactName: optional,
  primaryContactPhone: optional,
  opsContactName: optional,
  opsContactPhone: optional,
  partnerManagerId: optional,
  minRegistrationsPerTerm: z.coerce.number().int().min(0).max(100).optional(),
  minRetentionPercent: z.coerce.number().int().min(0).max(100).optional(),
  bankName: optional,
  bankAccountNumber: optional,
  bankAccountName: optional
});
const partnerUpdateSchema = partnerCreateSchema.partial();
const countersignSchema = z.object({ reference: z.string().trim().min(3, "Enter the reference of the countersigned agreement."), signedOn: z.string().optional() });
const suspendSchema = z.object({ reason: z.string().trim().min(5, "Say why.") });

function parseYearRates(text: string | undefined): number[] | undefined {
  if (!text || !text.trim()) return undefined;
  const rates = text.split(/[,\s]+/).filter(Boolean).map(Number);
  if (!rates.length || rates.some((rate) => !Number.isFinite(rate) || rate < 0 || rate > 100)) throw new BadRequestException("Year rates are percentages separated by commas, for example 20, 12, 6.");
  return rates;
}

/** A short permanent reference: PRT-GSR07. Never reused. */
async function issueCode(name: string) {
  const stem = name.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 3).padEnd(3, "X");
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const code = `PRT-${stem}${String(Math.floor(Math.random() * 90) + 10)}`;
    if (!(await prisma.partner.findUnique({ where: { code } }))) return code;
  }
  throw new BadRequestException("Could not issue a partner code. Try again.");
}

const dealCreateSchema = z.object({
  partnerId: z.string().trim().min(1, "Select a partner."),
  prospectSchoolName: z.string().trim().min(2, "Prospect school name is required."),
  prospectLocation: z.string().trim().optional().or(z.literal("")),
  expectedTier: z.string().trim().optional().or(z.literal("")),
  stream: z.string().trim().optional().or(z.literal("")),
  introductionEvidence: z.string().trim().optional().or(z.literal("")),
  contactName: optional,
  contactPhone: optional,
  expectedStudents: z.coerce.number().int().min(1).max(20000).optional(),
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
export class PartnersService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly alertLog = new Logger("PartnerAlerts");
  private alertTimer: NodeJS.Timeout | null = null;

  /** A registration window closing quietly is the most common partner complaint, so the alert goes out by itself, hourly. */
  onApplicationBootstrap() {
    if (process.env.PARTNER_ALERTS_SCHEDULER === "off") return;
    this.alertTimer = setInterval(() => void this.sendExpiryAlerts().catch((error) => this.alertLog.error(error)), 3_600_000);
    this.alertTimer.unref();
  }

  onModuleDestroy() {
    if (this.alertTimer) clearInterval(this.alertTimer);
  }

  private view(partner: Awaited<ReturnType<typeof prisma.partner.findMany>>[number] & { _count?: { deals: number } }): SuperAdminPartnerRow & Record<string, unknown> {
    const rates = Array.isArray(partner.yearRates) ? (partner.yearRates as number[]) : null;
    return {
      id: partner.id, name: partner.name, email: partner.email, territory: partner.territory, agreementReference: partner.agreementReference,
      agreementValidTo: partner.agreementValidTo ? partner.agreementValidTo.toISOString() : null, commissionRatePercent: toNumber(partner.commissionRatePercent),
      isActive: partner.isActive, createdAt: partner.createdAt.toISOString(), dealCount: partner._count?.deals ?? 0,
      code: partner.code, type: partner.type, tier: partner.tier, status: partner.status, suspendedReason: partner.suspendedReason, registrationNumber: partner.registrationNumber,
      primaryContactName: partner.primaryContactName, primaryContactPhone: partner.primaryContactPhone, opsContactName: partner.opsContactName, opsContactPhone: partner.opsContactPhone,
      partnerManagerId: partner.partnerManagerId, minRegistrationsPerTerm: partner.minRegistrationsPerTerm, minRetentionPercent: partner.minRetentionPercent,
      bank: partner.bankName ? `${partner.bankName} · ${partner.bankAccountNumber ? `****${partner.bankAccountNumber.slice(-4)}` : "no number"} · ${partner.bankAccountName ?? "no account name"}` : null,
      agreementVersion: partner.agreementVersion, countersignedAt: partner.countersignedAt?.toISOString() ?? null, countersignedRef: partner.countersignedRef,
      yearRates: rates, streamARatePercent: partner.streamARatePercent === null ? null : toNumber(partner.streamARatePercent)
    };
  }

  async listPartners(): Promise<SuperAdminPartnerRow[]> {
    const partners = await prisma.partner.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { deals: true } } } });
    return partners.map((partner) => this.view(partner));
  }

  /** The registry's figures: who is on it, how many schools they brought, and what is owed to them. */
  async registry() {
    const [partners, attributed, unsettled, settled, clawbacks, schools] = await Promise.all([
      prisma.partner.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { deals: true } } } }),
      prisma.partnerDeal.groupBy({ by: ["partnerId"], where: { status: { in: ["CONVERTED", "COMMISSION_PAID"] }, schoolId: { not: null } }, _count: { _all: true } }),
      prisma.partnerAccrual.groupBy({ by: ["partnerId"], where: { voidedAt: null, statementId: null }, _sum: { commission: true } }),
      prisma.partnerStatement.aggregate({ where: { status: "SETTLED", settledAt: { gte: new Date(Date.now() - 120 * 86_400_000) } }, _sum: { net: true }, _count: true }),
      prisma.partnerAccrual.aggregate({ where: { voidedAt: null, kind: "CLAWBACK", reconciledAt: { gte: new Date(Date.now() - 120 * 86_400_000) } }, _sum: { commission: true }, _count: true }),
      prisma.school.count({ where: { deletedAt: null, isPersonalWorkspace: false } })
    ]);
    const schoolsOf = new Map(attributed.map((row) => [row.partnerId, row._count._all]));
    const owed = new Map(unsettled.map((row) => [row.partnerId, toNumber(row._sum.commission)]));
    const attributedTotal = attributed.reduce((sum, row) => sum + row._count._all, 0);
    return {
      kpis: {
        partners: partners.length, active: partners.filter((partner) => partner.status === "ACTIVE").length, dormant: partners.filter((partner) => partner.status === "DORMANT").length, suspended: partners.filter((partner) => partner.status === "SUSPENDED").length,
        attributedSchools: attributedTotal, attributedShare: schools ? Math.round((attributedTotal / schools) * 100) : null,
        liability: Math.round(Array.from(owed.values()).reduce((sum, value) => sum + value, 0) * 100) / 100,
        settled: toNumber(settled._sum.net), settledStatements: settled._count, clawbacks: toNumber(clawbacks._sum.commission), clawbackCount: clawbacks._count
      },
      partners: partners.map((partner) => ({ ...this.view(partner), schools: schoolsOf.get(partner.id) ?? 0, accrued: owed.get(partner.id) ?? 0 }))
    };
  }

  async createPartner(body: unknown): Promise<SuperAdminPartnerRow> {
    const parsed = partnerCreateSchema.parse(body);
    const yearRates = parseYearRates(parsed.yearRates);
    const partner = await prisma.partner.create({
      data: {
        name: parsed.name, code: await issueCode(parsed.name),
        email: emptyToUndefined(parsed.email) ?? null, territory: emptyToUndefined(parsed.territory) ?? null,
        type: parsed.type ?? null, tier: parsed.tier ?? null, registrationNumber: emptyToUndefined(parsed.registrationNumber) ?? null,
        agreementReference: emptyToUndefined(parsed.agreementReference) ?? null, agreementVersion: emptyToUndefined(parsed.agreementVersion) ?? null,
        agreementValidTo: emptyToUndefined(parsed.agreementValidTo) ? new Date(parsed.agreementValidTo as string) : null,
        commissionRatePercent: parsed.commissionRatePercent ?? undefined, streamARatePercent: parsed.streamARatePercent ?? null, yearRates: yearRates ?? undefined,
        primaryContactName: emptyToUndefined(parsed.primaryContactName) ?? null, primaryContactPhone: emptyToUndefined(parsed.primaryContactPhone) ?? null,
        opsContactName: emptyToUndefined(parsed.opsContactName) ?? null, opsContactPhone: emptyToUndefined(parsed.opsContactPhone) ?? null,
        partnerManagerId: emptyToUndefined(parsed.partnerManagerId) ?? null,
        minRegistrationsPerTerm: parsed.minRegistrationsPerTerm ?? null, minRetentionPercent: parsed.minRetentionPercent ?? null,
        bankName: emptyToUndefined(parsed.bankName) ?? null, bankAccountNumber: emptyToUndefined(parsed.bankAccountNumber) ?? null, bankAccountName: emptyToUndefined(parsed.bankAccountName) ?? null
      },
      include: { _count: { select: { deals: true } } }
    });
    return this.view(partner);
  }

  async updatePartner(id: string, body: unknown) {
    const parsed = partnerUpdateSchema.parse(body);
    if (!(await prisma.partner.findUnique({ where: { id } }))) throw new NotFoundException("Partner not found.");
    const data: Prisma.PartnerUpdateInput = {};
    const text = (key: keyof typeof parsed) => (parsed[key] === undefined ? undefined : emptyToUndefined(parsed[key] as string) ?? null);
    for (const key of ["name", "email", "territory", "registrationNumber", "agreementReference", "agreementVersion", "primaryContactName", "primaryContactPhone", "opsContactName", "opsContactPhone", "partnerManagerId", "bankName", "bankAccountNumber", "bankAccountName"] as const) {
      const value = key === "name" ? parsed.name : text(key);
      if (value !== undefined) (data as Record<string, unknown>)[key] = value;
    }
    if (parsed.type !== undefined) data.type = parsed.type;
    if (parsed.tier !== undefined) data.tier = parsed.tier;
    if (parsed.commissionRatePercent !== undefined) data.commissionRatePercent = parsed.commissionRatePercent;
    if (parsed.streamARatePercent !== undefined) data.streamARatePercent = parsed.streamARatePercent;
    if (parsed.minRegistrationsPerTerm !== undefined) data.minRegistrationsPerTerm = parsed.minRegistrationsPerTerm;
    if (parsed.minRetentionPercent !== undefined) data.minRetentionPercent = parsed.minRetentionPercent;
    if (parsed.agreementValidTo !== undefined) data.agreementValidTo = emptyToUndefined(parsed.agreementValidTo) ? new Date(parsed.agreementValidTo) : null;
    if (parsed.yearRates !== undefined) data.yearRates = parseYearRates(parsed.yearRates) ?? Prisma.DbNull;
    const updated = await prisma.partner.update({ where: { id }, data, include: { _count: { select: { deals: true } } } });
    return this.view(updated);
  }

  /** A deal is only registered for a partner whose signed agreement we hold, so countersigning is its own recorded act. */
  async countersign(id: string, body: unknown) {
    const parsed = countersignSchema.parse(body);
    if (!(await prisma.partner.findUnique({ where: { id } }))) throw new NotFoundException("Partner not found.");
    await prisma.partner.update({ where: { id }, data: { countersignedAt: parsed.signedOn ? new Date(parsed.signedOn) : new Date(), countersignedRef: parsed.reference } });
    return { ok: true };
  }

  async suspend(id: string, body: unknown) {
    const parsed = suspendSchema.parse(body);
    if (!(await prisma.partner.findUnique({ where: { id } }))) throw new NotFoundException("Partner not found.");
    await prisma.partner.update({ where: { id }, data: { status: "SUSPENDED", isActive: false, suspendedReason: parsed.reason } });
    return { ok: true };
  }

  async reactivate(id: string) {
    if (!(await prisma.partner.findUnique({ where: { id } }))) throw new NotFoundException("Partner not found.");
    await prisma.partner.update({ where: { id }, data: { status: "ACTIVE", isActive: true, suspendedReason: null } });
    return { ok: true };
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
        commissionOwed,
        rejectedReason: deal.rejectedReason,
        expectedStudents: deal.expectedStudents,
        contactName: deal.contactName
      } as SuperAdminPartnerDealRow);
    }

    return rows;
  }

  /**
   * Attribution is established before the introduction, never argued about afterwards. A registration is refused — and the
   * refusal is kept on the register with its reason — when the partner has not countersigned, the school is already a
   * customer, or another partner registered it first. First valid registration wins.
   */
  async createDeal(userId: string, body: unknown): Promise<SuperAdminPartnerDealRow> {
    const parsed = dealCreateSchema.parse(body);

    const partner = await prisma.partner.findUnique({ where: { id: parsed.partnerId } });
    if (!partner) throw new NotFoundException("Partner not found.");

    const registeredAt = new Date();
    const validUntil = new Date(registeredAt.getTime() + DEAL_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
    const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const wanted = norm(parsed.prospectSchoolName);

    let rejected: string | null = null;
    if (partner.status !== "ACTIVE") rejected = partner.status === "SUSPENDED" ? "partner suspended" : "partner not active";
    else if (!partner.countersignedAt) rejected = "partner not countersigned";
    if (!rejected) {
      const customers = await prisma.school.findMany({ where: { deletedAt: null, isPersonalWorkspace: false }, select: { name: true } });
      if (customers.some((school) => { const name = norm(school.name); return name === wanted || name.startsWith(`${wanted} `) || wanted.startsWith(`${name} `); })) rejected = "already a customer";
    }
    if (!rejected) {
      const earlier = await prisma.partnerDeal.findMany({ where: { status: { in: ["REGISTERED", "CONVERTED", "COMMISSION_PAID"] }, validUntil: { gt: registeredAt } }, include: { partner: { select: { name: true } } } });
      const clash = earlier.find((deal) => norm(deal.prospectSchoolName) === wanted);
      if (clash) rejected = `already registered by ${clash.partner.name}`;
    }

    const deal = await prisma.partnerDeal.create({
      data: {
        partnerId: partner.id,
        prospectSchoolName: parsed.prospectSchoolName,
        prospectLocation: emptyToUndefined(parsed.prospectLocation) ?? null,
        expectedTier: emptyToUndefined(parsed.expectedTier) ?? null,
        stream: emptyToUndefined(parsed.stream) ?? null,
        introductionEvidence: emptyToUndefined(parsed.introductionEvidence) ?? null,
        contactName: emptyToUndefined(parsed.contactName) ?? null,
        contactPhone: emptyToUndefined(parsed.contactPhone) ?? null,
        expectedStudents: parsed.expectedStudents ?? null,
        registeredAt,
        validUntil: rejected ? registeredAt : validUntil,
        status: rejected ? "REJECTED" : "REGISTERED",
        rejectedReason: rejected,
        commissionRatePercent: parsed.commissionRatePercent ?? partner.commissionRatePercent,
        createdById: userId
      },
      include: { partner: true, school: { select: { id: true, name: true } } }
    });

    if (!rejected && deal.partner.email) {
      const validUntilLabel = deal.validUntil.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
      await sendEmail({
        to: deal.partner.email,
        subject: `Deal registered: ${deal.prospectSchoolName}`,
        text: `Hi ${deal.partner.name},\n\nWe've registered your introduction of ${deal.prospectSchoolName}. This registration is valid until ${validUntilLabel} — the school must sign up within that window for the attribution to hold.\n\nFirst valid registration wins, and the rule is the same for every partner.`
      });
    }

    return this.dealRow(deal);
  }

  private dealRow(deal: { id: string; partnerId: string; schoolId: string | null; prospectSchoolName: string; prospectLocation: string | null; expectedTier: string | null; stream: string | null; introductionEvidence: string | null; registeredAt: Date; validUntil: Date; status: PartnerDealStatus; commissionRatePercent: Prisma.Decimal; convertedAt: Date | null; createdAt: Date; rejectedReason?: string | null; expectedStudents?: number | null; contactName?: string | null; partner: { name: string }; school: { id: string; name: string } | null }) {
    return {
      id: deal.id, partnerId: deal.partnerId, partnerName: deal.partner.name, schoolId: deal.schoolId, schoolName: deal.school?.name ?? null,
      prospectSchoolName: deal.prospectSchoolName, prospectLocation: deal.prospectLocation, expectedTier: deal.expectedTier, stream: deal.stream,
      introductionEvidence: deal.introductionEvidence, registeredAt: deal.registeredAt.toISOString(), validUntil: deal.validUntil.toISOString(),
      status: deal.status, commissionRatePercent: toNumber(deal.commissionRatePercent), convertedAt: deal.convertedAt ? deal.convertedAt.toISOString() : null,
      createdAt: deal.createdAt.toISOString(), grossRevenue: 0, commissionOwed: 0,
      rejectedReason: deal.rejectedReason ?? null, expectedStudents: deal.expectedStudents ?? null, contactName: deal.contactName ?? null
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

  /**
   * There's no scheduler in this codebase, so expiry alerts aren't sent automatically — this
   * is triggered by hand, same as the manual backup run. It emails every partner with a
   * REGISTERED deal expiring within 14 days who hasn't already been alerted for that deal.
   */
  async sendExpiryAlerts() {
    const alertWindowEnd = new Date(Date.now() + EXPIRY_ALERT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const expiringDeals = await prisma.partnerDeal.findMany({
      where: {
        status: "REGISTERED",
        expiryAlertSentAt: null,
        validUntil: { lte: alertWindowEnd, gt: new Date() }
      },
      include: { partner: true }
    });

    let emailed = 0;
    let skippedNoEmail = 0;

    for (const deal of expiringDeals) {
      if (!deal.partner.email) {
        skippedNoEmail += 1;
        continue;
      }

      const validUntilLabel = deal.validUntil.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
      await sendEmail({
        to: deal.partner.email,
        subject: `Registration expiring soon: ${deal.prospectSchoolName}`,
        text: `Hi ${deal.partner.name},\n\nYour registration for ${deal.prospectSchoolName} expires on ${validUntilLabel}. If ${deal.prospectSchoolName} hasn't signed up with FutureRealm by then, this introduction will no longer count toward your commission.\n\n— FutureRealm SMS`
      });
      await prisma.partnerDeal.update({ where: { id: deal.id }, data: { expiryAlertSentAt: new Date() } });
      emailed += 1;
    }

    return {
      emailed,
      skippedNoEmail,
      checked: expiringDeals.length,
      message: emailed > 0 ? `Sent ${emailed} expiry alert${emailed === 1 ? "" : "s"}.` : "No registrations are due to expire within 14 days."
    };
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
