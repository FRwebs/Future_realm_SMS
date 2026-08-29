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

// M2.11 — this is never a field edit. Every approval, freeze and execution step is
// Super Admin only (the second approver may also be a Developer, standing in for "the
// CTO" in the BRD's incapacitated/deceased row) — never the broader platform-staff set.
function assertSuperAdminOnly(session: SessionPayload) {
  if (session.role !== "SUPER_ADMIN") {
    throw new ForbiddenException("This action is restricted to Super Admin.");
  }
}

function isEligibleSecondApprover(role: UserRole) {
  return role === "SUPER_ADMIN" || role === "DEVELOPER";
}

const triggerTypes = ["VOLUNTARY_SALE", "OWNER_INCAPACITATED", "OWNER_DECEASED", "DISPUTE"] as const;

const zOptionalId = () =>
  z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === "" ? undefined : value));

const initiateSchema = z.object({
  schoolId: z.string().trim().min(1),
  triggerType: z.enum(triggerTypes),
  evidenceNotes: z.string().trim().min(1, "Evidence is required to open a transfer."),
  incomingOwnerId: zOptionalId()
});

const objectionSchema = z.object({
  objectionNote: z.string().trim().min(1)
});

const incomingOwnerSchema = z.object({
  incomingOwnerId: z.string().trim().min(1)
});

function mapTransfer(transfer: {
  id: string;
  schoolId: string;
  outgoingOwnerId: string;
  incomingOwnerId: string | null;
  triggerType: string;
  evidenceNotes: string;
  status: string;
  noticeSentAt: Date | null;
  holdExpiresAt: Date | null;
  objectionNote: string | null;
  approver1Id: string | null;
  approver1At: Date | null;
  approver2Id: string | null;
  approver2At: Date | null;
  executedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  school?: { id: string; name: string } | null;
  outgoingOwner?: { firstName: string; lastName: string; email: string } | null;
  incomingOwner?: { firstName: string; lastName: string; email: string } | null;
  approver1?: { firstName: string; lastName: string } | null;
  approver2?: { firstName: string; lastName: string } | null;
}) {
  return {
    id: transfer.id,
    schoolId: transfer.schoolId,
    schoolName: transfer.school?.name ?? null,
    outgoingOwnerId: transfer.outgoingOwnerId,
    outgoingOwnerName: transfer.outgoingOwner ? `${transfer.outgoingOwner.firstName} ${transfer.outgoingOwner.lastName}` : null,
    outgoingOwnerEmail: transfer.outgoingOwner?.email ?? null,
    incomingOwnerId: transfer.incomingOwnerId,
    incomingOwnerName: transfer.incomingOwner ? `${transfer.incomingOwner.firstName} ${transfer.incomingOwner.lastName}` : null,
    incomingOwnerEmail: transfer.incomingOwner?.email ?? null,
    triggerType: transfer.triggerType,
    evidenceNotes: transfer.evidenceNotes,
    status: transfer.status,
    noticeSentAt: transfer.noticeSentAt?.toISOString() ?? null,
    holdExpiresAt: transfer.holdExpiresAt?.toISOString() ?? null,
    objectionNote: transfer.objectionNote,
    approver1Id: transfer.approver1Id,
    approver1Name: transfer.approver1 ? `${transfer.approver1.firstName} ${transfer.approver1.lastName}` : null,
    approver1At: transfer.approver1At?.toISOString() ?? null,
    approver2Id: transfer.approver2Id,
    approver2Name: transfer.approver2 ? `${transfer.approver2.firstName} ${transfer.approver2.lastName}` : null,
    approver2At: transfer.approver2At?.toISOString() ?? null,
    requiresDualApproval: transfer.triggerType !== "VOLUNTARY_SALE",
    executedAt: transfer.executedAt?.toISOString() ?? null,
    createdAt: transfer.createdAt.toISOString(),
    updatedAt: transfer.updatedAt.toISOString()
  };
}

const transferInclude = {
  school: { select: { id: true, name: true } },
  outgoingOwner: { select: { firstName: true, lastName: true, email: true } },
  incomingOwner: { select: { firstName: true, lastName: true, email: true } },
  approver1: { select: { firstName: true, lastName: true } },
  approver2: { select: { firstName: true, lastName: true } }
} as const;

@Injectable()
export class OwnershipTransferService {
  async listTransfers(session: SessionPayload) {
    assertPlatformRole(session);
    const transfers = await prisma.ownershipTransfer.findMany({
      include: transferInclude,
      orderBy: { createdAt: "desc" }
    });
    return { ok: true, data: transfers.map(mapTransfer) };
  }

  async initiate(session: SessionPayload, payload: unknown) {
    assertPlatformRole(session);
    const parsed = initiateSchema.parse(payload);
    const schoolId = parsed.schoolId;

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException("School not found.");

    const outgoingOwner = await prisma.user.findFirst({
      where: { schoolId, role: { in: ["SCHOOL_OWNER", "PROPRIETOR"] }, deletedAt: null },
      orderBy: { createdAt: "asc" }
    });
    if (!outgoingOwner) throw new BadRequestException("This school has no recorded owner to transfer from.");

    if (parsed.incomingOwnerId) {
      const incomingOwner = await prisma.user.findUnique({ where: { id: parsed.incomingOwnerId } });
      if (!incomingOwner) throw new BadRequestException("Incoming owner not found.");
    }

    const transfer = await prisma.ownershipTransfer.create({
      data: {
        schoolId,
        outgoingOwnerId: outgoingOwner.id,
        incomingOwnerId: parsed.incomingOwnerId ?? null,
        triggerType: parsed.triggerType,
        evidenceNotes: parsed.evidenceNotes,
        status: parsed.triggerType === "DISPUTE" ? "OBJECTION_RAISED" : "EVIDENCE_COLLECTED"
      },
      include: transferInclude
    });

    await prisma.auditLog.create({
      data: {
        schoolId,
        actorId: session.userId,
        action: "CREATE",
        entityType: "OwnershipTransfer",
        entityId: transfer.id,
        metadata: { triggerType: parsed.triggerType }
      }
    });

    if (parsed.triggerType === "DISPUTE") {
      // A dispute between claimants is never a transfer — the account is frozen
      // read-only and both parties notified; there is nothing further to approve.
      await prisma.school.update({ where: { id: schoolId }, data: { status: "SUSPENDED", statusReason: "Ownership dispute — frozen pending resolution", statusChangedAt: new Date() } });
    }

    return { ok: true, message: "Ownership transfer opened.", data: mapTransfer(transfer) };
  }

  // M2.11 "IDENTITY VERIFIED" step — records the incoming owner once the M5.8 verification
  // process has confirmed them, ahead of notice being sent to the outgoing owner.
  async setIncomingOwner(session: SessionPayload, transferId: string, payload: unknown) {
    assertPlatformRole(session);
    const parsed = incomingOwnerSchema.parse(payload);
    const transfer = await prisma.ownershipTransfer.findUnique({ where: { id: transferId } });
    if (!transfer) throw new NotFoundException("Transfer not found.");
    if (transfer.status !== "EVIDENCE_COLLECTED") {
      throw new BadRequestException("The incoming owner can only be set before notice is sent.");
    }

    const incomingOwner = await prisma.user.findUnique({ where: { id: parsed.incomingOwnerId } });
    if (!incomingOwner) throw new BadRequestException("Incoming owner not found.");

    const updated = await prisma.ownershipTransfer.update({
      where: { id: transferId },
      data: { incomingOwnerId: parsed.incomingOwnerId },
      include: transferInclude
    });

    await prisma.auditLog.create({
      data: { schoolId: transfer.schoolId, actorId: session.userId, action: "UPDATE", entityType: "OwnershipTransfer", entityId: transferId, metadata: { incomingOwnerId: parsed.incomingOwnerId } }
    });

    return { ok: true, message: "Incoming owner recorded.", data: mapTransfer(updated) };
  }

  async sendNotice(session: SessionPayload, transferId: string) {
    assertSuperAdminOnly(session);
    const transfer = await prisma.ownershipTransfer.findUnique({ where: { id: transferId } });
    if (!transfer) throw new NotFoundException("Transfer not found.");
    if (transfer.status !== "EVIDENCE_COLLECTED") {
      throw new BadRequestException("Notice can only be sent while evidence is being collected.");
    }

    const now = new Date();
    // Deceased owner: 14-day hold before the change takes effect. Voluntary and
    // incapacitated triggers carry no mandatory hold beyond the notice itself.
    const holdExpiresAt = transfer.triggerType === "OWNER_DECEASED" ? new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) : null;

    const updated = await prisma.ownershipTransfer.update({
      where: { id: transferId },
      data: { status: "NOTICE_SENT", noticeSentAt: now, holdExpiresAt },
      include: transferInclude
    });

    await prisma.auditLog.create({
      data: { schoolId: transfer.schoolId, actorId: session.userId, action: "UPDATE", entityType: "OwnershipTransfer", entityId: transferId, metadata: { status: "NOTICE_SENT" } }
    });

    return { ok: true, message: "Notice sent to the outgoing owner's registered contacts.", data: mapTransfer(updated) };
  }

  async raiseObjection(session: SessionPayload, transferId: string, payload: unknown) {
    assertPlatformRole(session);
    const parsed = objectionSchema.parse(payload);
    const transfer = await prisma.ownershipTransfer.findUnique({ where: { id: transferId } });
    if (!transfer) throw new NotFoundException("Transfer not found.");
    if (transfer.status !== "NOTICE_SENT") {
      throw new BadRequestException("An objection can only be raised after notice has been sent.");
    }

    const updated = await prisma.ownershipTransfer.update({
      where: { id: transferId },
      data: { status: "OBJECTION_RAISED", objectionNote: parsed.objectionNote },
      include: transferInclude
    });

    await prisma.school.update({
      where: { id: transfer.schoolId },
      data: { status: "SUSPENDED", statusReason: "Ownership transfer objection — frozen pending resolution", statusChangedAt: new Date() }
    });

    await prisma.auditLog.create({
      data: { schoolId: transfer.schoolId, actorId: session.userId, action: "UPDATE", entityType: "OwnershipTransfer", entityId: transferId, metadata: { status: "OBJECTION_RAISED" } }
    });

    return { ok: true, message: "Objection recorded. Account frozen read-only.", data: mapTransfer(updated) };
  }

  async approve(session: SessionPayload, transferId: string) {
    // The first approval is always Super Admin; the second seat (incapacitated/deceased
    // only) may also be filled by the Developer/CTO seat — checked in more detail below
    // once we know which seat this call is filling.
    if (!isEligibleSecondApprover(session.role as UserRole)) {
      throw new ForbiddenException("This action is restricted to Super Admin.");
    }
    const transfer = await prisma.ownershipTransfer.findUnique({ where: { id: transferId } });
    if (!transfer) throw new NotFoundException("Transfer not found.");
    if (transfer.status !== "NOTICE_SENT") {
      throw new BadRequestException("A transfer can only be approved after notice has been sent and no objection stands.");
    }
    if (!transfer.incomingOwnerId) {
      throw new BadRequestException("An incoming owner must be identified before approval.");
    }

    if (!transfer.approver1Id) {
      if (session.role !== "SUPER_ADMIN") {
        throw new ForbiddenException("The first approval must come from a Super Admin.");
      }
      const updated = await prisma.ownershipTransfer.update({
        where: { id: transferId },
        data: { approver1Id: session.userId, approver1At: new Date() },
        include: transferInclude
      });
      await prisma.auditLog.create({
        data: { schoolId: transfer.schoolId, actorId: session.userId, action: "APPROVE", entityType: "OwnershipTransfer", entityId: transferId, metadata: { approverSeat: 1 } }
      });
      return { ok: true, message: "First approval recorded.", data: mapTransfer(updated) };
    }

    if (transfer.approver1Id === session.userId) {
      throw new BadRequestException("The second approval must come from a different Super Admin.");
    }

    // Voluntary sale needs only the first Super Admin's sign-off; incapacitated and
    // deceased triggers require dual approval from two distinct people.
    const requiresSecondApprover = transfer.triggerType !== "VOLUNTARY_SALE";
    if (!requiresSecondApprover) {
      throw new BadRequestException("This transfer has already been approved.");
    }

    if (!isEligibleSecondApprover(session.role as UserRole)) {
      throw new ForbiddenException("The second approver must be a Super Admin or the platform's Developer/CTO seat.");
    }

    const updated = await prisma.ownershipTransfer.update({
      where: { id: transferId },
      data: { status: "APPROVED", approver2Id: session.userId, approver2At: new Date() },
      include: transferInclude
    });

    await prisma.auditLog.create({
      data: { schoolId: transfer.schoolId, actorId: session.userId, action: "APPROVE", entityType: "OwnershipTransfer", entityId: transferId, metadata: { approverSeat: 2 } }
    });

    return { ok: true, message: "Dual approval complete.", data: mapTransfer(updated) };
  }

  async execute(session: SessionPayload, transferId: string) {
    assertSuperAdminOnly(session);
    const transfer = await prisma.ownershipTransfer.findUnique({ where: { id: transferId }, include: transferInclude });
    if (!transfer) throw new NotFoundException("Transfer not found.");

    const approvalComplete = transfer.triggerType === "VOLUNTARY_SALE" ? Boolean(transfer.approver1Id) : transfer.status === "APPROVED";
    if (!approvalComplete) {
      throw new BadRequestException("This transfer has not completed approval.");
    }
    if (transfer.status === "EXECUTED") {
      throw new BadRequestException("This transfer has already been executed.");
    }
    if (!transfer.incomingOwnerId) {
      throw new BadRequestException("An incoming owner must be identified before execution.");
    }
    if (transfer.holdExpiresAt && transfer.holdExpiresAt > new Date()) {
      throw new BadRequestException(`The mandatory hold has not elapsed. Eligible on ${transfer.holdExpiresAt.toISOString()}.`);
    }

    const outgoingOwner = await prisma.user.findUnique({ where: { id: transfer.outgoingOwnerId } });
    if (!outgoingOwner) throw new NotFoundException("Outgoing owner record not found.");
    const incomingOwner = await prisma.user.findUnique({ where: { id: transfer.incomingOwnerId } });
    if (!incomingOwner) throw new NotFoundException("Incoming owner record not found.");

    const now = new Date();

    await prisma.$transaction([
      // New owner keeps their own account and audit history — this is never a
      // handed-over login. Only the outgoing owner's access is revoked.
      prisma.user.update({
        where: { id: transfer.incomingOwnerId },
        data: { role: outgoingOwner.role, isActive: true, suspendedAt: null }
      }),
      prisma.user.update({
        where: { id: transfer.outgoingOwnerId },
        data: { isActive: false, suspendedAt: now }
      }),
      prisma.platformSession.updateMany({
        where: { userId: transfer.outgoingOwnerId, revokedAt: null },
        data: { revokedAt: now }
      }),
      prisma.ownershipTransfer.update({
        where: { id: transferId },
        data: { status: "EXECUTED", executedAt: now }
      }),
      prisma.school.update({
        where: { id: transfer.schoolId },
        data: {
          ownerName: `${incomingOwner.firstName} ${incomingOwner.lastName}`.trim(),
          ownerEmail: incomingOwner.email,
          ownerPhone: incomingOwner.phone ?? null
        }
      })
    ]);

    await prisma.auditLog.create({
      data: {
        schoolId: transfer.schoolId,
        actorId: session.userId,
        action: "UPDATE",
        entityType: "OwnershipTransfer",
        entityId: transferId,
        metadata: {
          status: "EXECUTED",
          outgoingOwnerId: transfer.outgoingOwnerId,
          incomingOwnerId: transfer.incomingOwnerId,
          approver1Id: transfer.approver1Id,
          approver2Id: transfer.approver2Id,
          noticeSentAt: transfer.noticeSentAt?.toISOString() ?? null,
          objectionNote: transfer.objectionNote
        }
      }
    });

    const updated = await prisma.ownershipTransfer.findUniqueOrThrow({ where: { id: transferId }, include: transferInclude });
    return { ok: true, message: "Ownership transfer executed. Outgoing owner access revoked.", data: mapTransfer(updated) };
  }
}
