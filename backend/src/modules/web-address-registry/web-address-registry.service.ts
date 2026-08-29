import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";

const platformRoles = new Set<UserRole>([
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "SUPPORT_AGENT",
  "SALES_MANAGER",
  "FINANCE_MANAGER",
  "DEVELOPER",
  "SUPER_ADMIN"
]);

function assertPlatformRole(session: SessionPayload) {
  if (!platformRoles.has(session.role as UserRole)) {
    throw new ForbiddenException("Platform admin access required.");
  }
}

// M2.10.2 — address change and dispute decisions are Super Admin only; every other
// registry action (viewing, logging a claim, recording a holder response) is open to
// any platform staff role.
function assertSuperAdminOnly(session: SessionPayload) {
  if (session.role !== "SUPER_ADMIN") {
    throw new ForbiddenException("This action is restricted to Super Admin.");
  }
}

// M2.10.1 — lowercase, letters and numbers only, 3 to 30 characters, never auto-numbered.
const ADDRESS_PATTERN = /^[a-z0-9]{3,30}$/;

// M2.10.1 — reserved/blocked words. Platform reserved words, regulatory-body names and
// obviously offensive terms. Scoped globally for now; per-country scoping can be layered
// on once a second country launches.
const BLOCKED_TERMS = [
  "admin",
  "administrator",
  "superadmin",
  "api",
  "www",
  "app",
  "system",
  "support",
  "help",
  "billing",
  "waec",
  "neco",
  "jamb",
  "nabteb",
  "moe",
  "ministry",
  "futurerealm",
  "future-realm"
];

const addressSchema = z
  .string()
  .trim()
  .toLowerCase();

function validateAddressFormat(address: string) {
  if (!ADDRESS_PATTERN.test(address)) {
    throw new BadRequestException("Address must be lowercase letters and numbers only, 3 to 30 characters.");
  }
}

const changeAddressSchema = z.object({
  schoolId: z.string().trim().min(1),
  newAddress: addressSchema,
  reason: z.string().trim().min(1, "A reason is required for every address change.")
});

const createDisputeSchema = z.object({
  claimedAddress: addressSchema,
  claimantSchoolName: z.string().trim().min(1),
  claimantContactName: z.string().trim().min(1),
  claimantContactEmail: z.string().trim().email(),
  claimantContactPhone: z.string().trim().optional(),
  evidenceNotes: z.string().trim().min(1, "Evidence notes are required.")
});

const holderResponseSchema = z.object({
  holderResponse: z.string().trim().min(1)
});

const decideDisputeSchema = z.object({
  outcome: z.enum(["NEGOTIATED", "REASSIGNED", "DECLINED"]),
  qualifiedAddressOffered: z.string().trim().toLowerCase().optional().transform((value) => (value === "" ? undefined : value)),
  reassignToSchoolId: z.string().trim().optional().transform((value) => (value === "" ? undefined : value))
});

function mapRecord(record: {
  id: string;
  address: string;
  schoolId: string | null;
  state: string;
  countryScope: string;
  reservedReason: string | null;
  issuedAt: Date;
  retiredAt: Date | null;
  releaseEligibleAt: Date | null;
  redirectFromAddress: string | null;
  redirectExpiresAt: Date | null;
  changeReason: string | null;
  changedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  school?: { id: string; name: string } | null;
}) {
  return {
    id: record.id,
    address: record.address,
    schoolId: record.schoolId,
    schoolName: record.school?.name ?? null,
    state: record.state,
    countryScope: record.countryScope,
    reservedReason: record.reservedReason,
    issuedAt: record.issuedAt.toISOString(),
    retiredAt: record.retiredAt?.toISOString() ?? null,
    releaseEligibleAt: record.releaseEligibleAt?.toISOString() ?? null,
    redirectFromAddress: record.redirectFromAddress,
    redirectExpiresAt: record.redirectExpiresAt?.toISOString() ?? null,
    changeReason: record.changeReason,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function mapDispute(dispute: {
  id: string;
  claimedAddress: string;
  webAddressRecordId: string | null;
  claimantSchoolName: string;
  claimantContactName: string;
  claimantContactEmail: string;
  claimantContactPhone: string | null;
  evidenceNotes: string;
  status: string;
  holderNotifiedAt: Date | null;
  holderResponseDueAt: Date | null;
  holderRespondedAt: Date | null;
  holderResponse: string | null;
  outcome: string | null;
  qualifiedAddressOffered: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  decidedBy?: { firstName: string; lastName: string } | null;
}) {
  return {
    id: dispute.id,
    claimedAddress: dispute.claimedAddress,
    webAddressRecordId: dispute.webAddressRecordId,
    claimantSchoolName: dispute.claimantSchoolName,
    claimantContactName: dispute.claimantContactName,
    claimantContactEmail: dispute.claimantContactEmail,
    claimantContactPhone: dispute.claimantContactPhone,
    evidenceNotes: dispute.evidenceNotes,
    status: dispute.status,
    holderNotifiedAt: dispute.holderNotifiedAt?.toISOString() ?? null,
    holderResponseDueAt: dispute.holderResponseDueAt?.toISOString() ?? null,
    holderRespondedAt: dispute.holderRespondedAt?.toISOString() ?? null,
    holderResponse: dispute.holderResponse,
    outcome: dispute.outcome,
    qualifiedAddressOffered: dispute.qualifiedAddressOffered,
    decidedAt: dispute.decidedAt?.toISOString() ?? null,
    decidedByName: dispute.decidedBy ? `${dispute.decidedBy.firstName} ${dispute.decidedBy.lastName}` : null,
    createdAt: dispute.createdAt.toISOString(),
    updatedAt: dispute.updatedAt.toISOString()
  };
}

@Injectable()
export class WebAddressRegistryService {
  // Every school with a live slug already has an implicit address; this backfills a
  // registry row for it on first touch rather than requiring a one-off migration script.
  private async ensureRecordForSchool(schoolId: string) {
    const existing = await prisma.webAddressRecord.findFirst({ where: { schoolId, state: { in: ["LIVE", "HELD"] } } });
    if (existing) return existing;

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, slug: true, subdomain: true, createdAt: true }
    });
    if (!school) throw new NotFoundException("School not found.");

    const address = school.subdomain ?? school.slug;
    const existingByAddress = await prisma.webAddressRecord.findUnique({ where: { address } });
    if (existingByAddress) return existingByAddress;

    return prisma.webAddressRecord.create({
      data: {
        address,
        schoolId: school.id,
        state: "LIVE",
        issuedAt: school.createdAt
      }
    });
  }

  async listRegistry(session: SessionPayload) {
    assertPlatformRole(session);
    const records = await prisma.webAddressRecord.findMany({
      include: { school: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" }
    });
    return { ok: true, data: records.map(mapRecord) };
  }

  async checkAvailability(session: SessionPayload, rawAddress: string) {
    assertPlatformRole(session);
    const address = addressSchema.parse(rawAddress ?? "");
    validateAddressFormat(address);

    if (BLOCKED_TERMS.some((term) => address === term || address.includes(term))) {
      return { ok: true, data: { address, available: false, reason: "Reserved or blocked term." } };
    }

    const existing = await prisma.webAddressRecord.findUnique({ where: { address } });
    if (!existing) {
      return { ok: true, data: { address, available: true, reason: null } };
    }

    if (existing.state === "RETIRED" && existing.releaseEligibleAt && existing.releaseEligibleAt <= new Date()) {
      return { ok: true, data: { address, available: true, reason: null } };
    }

    return {
      ok: true,
      data: { address, available: false, reason: `Address is ${existing.state.toLowerCase()}.` }
    };
  }

  async changeAddress(session: SessionPayload, payload: unknown) {
    assertSuperAdminOnly(session);
    const parsed = changeAddressSchema.parse(payload);
    const schoolId = parsed.schoolId;

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException("School not found.");

    const availability = await this.checkAvailability(session, parsed.newAddress);
    if (!availability.data.available) {
      throw new BadRequestException(availability.data.reason ?? "Address is not available.");
    }

    const oldRecord = await this.ensureRecordForSchool(schoolId);
    const now = new Date();
    const redirectExpiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const [, newRecord] = await prisma.$transaction([
      prisma.webAddressRecord.update({
        where: { id: oldRecord.id },
        data: {
          state: "RETIRED",
          schoolId: null,
          retiredAt: now,
          releaseEligibleAt: redirectExpiresAt
        }
      }),
      prisma.webAddressRecord.create({
        data: {
          address: parsed.newAddress,
          schoolId,
          state: "LIVE",
          redirectFromAddress: oldRecord.address,
          redirectExpiresAt,
          changeReason: parsed.reason,
          changedById: session.userId
        }
      }),
      prisma.school.update({ where: { id: schoolId }, data: { subdomain: parsed.newAddress, slug: parsed.newAddress } })
    ]);

    await prisma.auditLog.create({
      data: {
        schoolId,
        actorId: session.userId,
        action: "UPDATE",
        entityType: "WebAddressRecord",
        entityId: newRecord.id,
        metadata: { oldAddress: oldRecord.address, newAddress: parsed.newAddress, reason: parsed.reason, redirectExpiresAt: redirectExpiresAt.toISOString() }
      }
    });

    return { ok: true, message: `Address changed to ${parsed.newAddress}. Redirect active for 90 days.`, data: mapRecord(newRecord) };
  }

  async listDisputes(session: SessionPayload) {
    assertPlatformRole(session);
    const disputes = await prisma.addressDispute.findMany({
      include: { decidedBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" }
    });
    return { ok: true, data: disputes.map(mapDispute) };
  }

  async createDispute(session: SessionPayload, payload: unknown) {
    assertPlatformRole(session);
    const parsed = createDisputeSchema.parse(payload);
    const record = await prisma.webAddressRecord.findUnique({ where: { address: parsed.claimedAddress } });

    const dispute = await prisma.addressDispute.create({
      data: {
        claimedAddress: parsed.claimedAddress,
        webAddressRecordId: record?.id ?? null,
        claimantSchoolName: parsed.claimantSchoolName,
        claimantContactName: parsed.claimantContactName,
        claimantContactEmail: parsed.claimantContactEmail,
        claimantContactPhone: parsed.claimantContactPhone || null,
        evidenceNotes: parsed.evidenceNotes
      }
    });

    await prisma.auditLog.create({
      data: {
        actorId: session.userId,
        action: "CREATE",
        entityType: "AddressDispute",
        entityId: dispute.id,
        metadata: { claimedAddress: parsed.claimedAddress, claimant: parsed.claimantSchoolName }
      }
    });

    return { ok: true, message: "Dispute logged.", data: mapDispute({ ...dispute, decidedBy: null }) };
  }

  async notifyHolder(session: SessionPayload, disputeId: string) {
    assertPlatformRole(session);
    const dispute = await prisma.addressDispute.findUnique({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException("Dispute not found.");
    if (dispute.status !== "EVIDENCE_PENDING") {
      throw new BadRequestException("Holder can only be contacted while evidence is pending.");
    }

    const now = new Date();
    // 10 working days ≈ 14 calendar days.
    const dueAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const updated = await prisma.addressDispute.update({
      where: { id: disputeId },
      data: { status: "HOLDER_CONTACTED", holderNotifiedAt: now, holderResponseDueAt: dueAt },
      include: { decidedBy: { select: { firstName: true, lastName: true } } }
    });

    await prisma.auditLog.create({
      data: { actorId: session.userId, action: "UPDATE", entityType: "AddressDispute", entityId: disputeId, metadata: { status: "HOLDER_CONTACTED" } }
    });

    return { ok: true, message: "Holder contacted — 10 working days to respond.", data: mapDispute(updated) };
  }

  async recordHolderResponse(session: SessionPayload, disputeId: string, payload: unknown) {
    assertPlatformRole(session);
    const parsed = holderResponseSchema.parse(payload);
    const dispute = await prisma.addressDispute.findUnique({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException("Dispute not found.");
    if (dispute.status !== "HOLDER_CONTACTED") {
      throw new BadRequestException("A holder response can only be recorded after they have been contacted.");
    }

    const updated = await prisma.addressDispute.update({
      where: { id: disputeId },
      data: { holderRespondedAt: new Date(), holderResponse: parsed.holderResponse },
      include: { decidedBy: { select: { firstName: true, lastName: true } } }
    });

    return { ok: true, message: "Holder response recorded.", data: mapDispute(updated) };
  }

  async decideDispute(session: SessionPayload, disputeId: string, payload: unknown) {
    assertSuperAdminOnly(session);
    const parsed = decideDisputeSchema.parse(payload);
    const dispute = await prisma.addressDispute.findUnique({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException("Dispute not found.");
    if (dispute.status === "DECIDED") throw new BadRequestException("This dispute has already been decided.");

    if (parsed.outcome === "REASSIGNED") {
      if (!parsed.reassignToSchoolId) {
        throw new BadRequestException("A destination school is required to reassign an address.");
      }
      // The default is possession — reassignment only happens where the holder cannot
      // evidence a legitimate claim, executed here via the same 90-day redirect used for
      // an ordinary address change.
      await this.changeAddress(session, {
        schoolId: parsed.reassignToSchoolId,
        newAddress: dispute.claimedAddress,
        reason: `Address dispute ${dispute.id} — reassigned to claimant`
      });
    }

    const updated = await prisma.addressDispute.update({
      where: { id: disputeId },
      data: {
        status: "DECIDED",
        outcome: parsed.outcome,
        qualifiedAddressOffered: parsed.qualifiedAddressOffered ?? null,
        decidedById: session.userId,
        decidedAt: new Date()
      },
      include: { decidedBy: { select: { firstName: true, lastName: true } } }
    });

    await prisma.auditLog.create({
      data: {
        actorId: session.userId,
        action: "APPROVE",
        entityType: "AddressDispute",
        entityId: disputeId,
        metadata: { outcome: parsed.outcome, qualifiedAddressOffered: parsed.qualifiedAddressOffered ?? null }
      }
    });

    return { ok: true, message: "Dispute decided.", data: mapDispute(updated) };
  }
}
