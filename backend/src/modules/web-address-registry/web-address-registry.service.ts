import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { sendNotification } from "../../../../src/lib/integrations/notifications";

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

// M2.10.1 — lowercase, letters, numbers and single inner hyphens, 3 to 30 characters, never
// auto-numbered. Hyphens are here because the addresses already issued use them — a school
// distinguishes itself by its town, "queens-ibadan", not by a digit on the end.
const ADDRESS_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ADDRESS_MIN = 3;
const ADDRESS_MAX = 30;

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

/** Whether an address is the right shape to be issued at all. */
export function addressFormatOk(address: string) {
  return address.length >= ADDRESS_MIN && address.length <= ADDRESS_MAX && ADDRESS_PATTERN.test(address);
}

/** Whether an address is, or contains, a term nobody may hold. */
export function addressIsReserved(address: string) {
  return BLOCKED_TERMS.some((term) => address === term || address.includes(term));
}

function validateAddressFormat(address: string) {
  if (!addressFormatOk(address)) {
    throw new BadRequestException(
      `Address must be ${ADDRESS_MIN} to ${ADDRESS_MAX} characters: lowercase letters, numbers and single hyphens between them.`
    );
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

  /**
   * Whether an address can be issued, and what to try instead when it cannot.
   *
   * The registry table is not the only place an address lives: a row is written there the first
   * time a school's address is touched, so a school that has never been edited holds its address
   * through `School.slug` alone. Asking only the registry is how a name that is plainly taken comes
   * back free, so both are asked.
   */
  async checkAvailability(session: SessionPayload, rawAddress: string) {
    assertPlatformRole(session);
    const address = addressSchema.parse(rawAddress ?? "");
    validateAddressFormat(address);

    const taken = async (reason: string) => ({
      ok: true,
      data: { address, available: false, reason, suggestions: await this.suggestionsFor(address) }
    });

    if (addressIsReserved(address)) return taken("Reserved or blocked term.");

    const existing = await prisma.webAddressRecord.findUnique({ where: { address } });
    const released = existing?.state === "RETIRED" && existing.releaseEligibleAt && existing.releaseEligibleAt <= new Date();
    if (existing && !released) return taken(`Address is ${existing.state.toLowerCase()}.`);

    const school = await prisma.school.findFirst({
      where: { deletedAt: null, OR: [{ slug: address }, { subdomain: address }] },
      select: { id: true }
    });
    if (school) return taken("A school already holds this address.");

    return { ok: true, data: { address, available: true, reason: null, suggestions: [] as string[] } };
  }

  /**
   * Three addresses near the one that was refused, and free.
   *
   * Never the asked-for name with a number after it: two schools called Queens separated by a `2`
   * is how a parent ends up at the wrong school's gate. A place name is what actually tells them
   * apart, so that is what is offered.
   */
  private async suggestionsFor(address: string): Promise<string[]> {
    const QUALIFIERS = ["lagos", "abuja", "ibadan", "kano", "ph", "enugu", "school", "academy"];
    const candidates = QUALIFIERS.map((qualifier) => `${address}-${qualifier}`).filter(
      (candidate) => candidate.length <= ADDRESS_MAX && !addressIsReserved(candidate)
    );
    if (candidates.length === 0) return [];
    const [records, schools] = await Promise.all([
      prisma.webAddressRecord.findMany({ where: { address: { in: candidates } }, select: { address: true } }),
      prisma.school.findMany({
        where: { deletedAt: null, OR: [{ slug: { in: candidates } }, { subdomain: { in: candidates } }] },
        select: { slug: true, subdomain: true }
      })
    ]);
    const used = new Set([
      ...records.map((record) => record.address),
      ...schools.flatMap((school) => [school.slug, school.subdomain].filter(Boolean) as string[])
    ]);
    return candidates.filter((candidate) => !used.has(candidate)).slice(0, 3);
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

    // Both parties are told in writing — the claimant at the address they gave, the holder at its owner's.
    const outcomeText = parsed.outcome === "REASSIGNED" ? "The address has been reassigned to the claimant, and the holder keeps a redirect for 90 days." : parsed.outcome === "NEGOTIATED" ? `The two parties have agreed a way forward${parsed.qualifiedAddressOffered ? `; the claimant has been offered ${parsed.qualifiedAddressOffered}` : ""}.` : "The claim was declined: the current holder keeps the address.";
    const holderRecord = dispute.webAddressRecordId ? await prisma.webAddressRecord.findUnique({ where: { id: dispute.webAddressRecordId }, select: { school: { select: { name: true, ownerEmail: true } } } }) : null;
    // An address that predates the registry is still held by the school whose subdomain it is.
    const holder = holderRecord?.school ? holderRecord : { school: await prisma.school.findFirst({ where: { subdomain: dispute.claimedAddress, deletedAt: null }, select: { name: true, ownerEmail: true } }) };
    const notice = `The dispute over the web address "${dispute.claimedAddress}" has been decided. ${outcomeText}`;
    const told: string[] = [];
    for (const [who, email] of [["claimant", dispute.claimantContactEmail], ["holder", holder?.school?.ownerEmail ?? null]] as const) {
      if (!email) continue;
      await sendNotification({ channel: "EMAIL", recipient: email, title: `Decision on the web address ${dispute.claimedAddress}`, body: notice }).catch(() => undefined);
      told.push(who);
    }
    await prisma.auditLog.create({ data: { actorId: session.userId, action: "UPDATE", entityType: "AddressDisputeNotice", entityId: disputeId, metadata: { told, outcome: parsed.outcome } } });

    return { ok: true, message: told.length ? "Dispute decided and both parties told." : "Dispute decided.", data: mapDispute(updated) };
  }
}
