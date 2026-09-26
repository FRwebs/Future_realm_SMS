import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ApprovalKind, ApprovalStatus, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";

/**
 * The one queue every decision in the school lands in.
 *
 * Before this, a decision lived in whichever table raised it — a result sheet,
 * a fee waiver, a profile edit request — and two kinds had nowhere to live at
 * all. Listing "what is waiting on me" meant a union of five tables re-sorted
 * in application code, and two kinds were simply missing from it.
 *
 * A service that raises a decision writes a row here and keeps its own record
 * as the subject. The queue orders and decides; it never needs to know what a
 * ResultSheet is.
 */

const raiseSchema = z.object({
  kind: z.nativeEnum(ApprovalKind),
  subjectType: z.string().trim().min(1, "Name the record this decision is about."),
  subjectId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1, "A decision needs a title somebody can read."),
  summary: z.string().trim().optional(),
  blocking: z.string().trim().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  assigneeId: z.string().trim().optional(),
  assigneeRole: z.nativeEnum(UserRole).optional(),
  escalatesAt: z.string().datetime().optional(),
});

const decideSchema = z.object({
  action: z.enum(["APPROVE", "RETURN", "REJECT", "WITHDRAW"]),
  note: z.string().trim().optional(),
});

/**
 * Anything but an approval has to say why.
 *
 * A refusal with no reason is the thing that makes people stop trusting a
 * queue: the requester learns only that they were refused, and asks in person.
 */
const actionToStatus: Record<string, ApprovalStatus> = {
  APPROVE: ApprovalStatus.APPROVED,
  RETURN: ApprovalStatus.RETURNED,
  REJECT: ApprovalStatus.REJECTED,
  WITHDRAW: ApprovalStatus.WITHDRAWN,
};

export type ApprovalView = {
  id: string;
  kind: ApprovalKind;
  subjectType: string;
  subjectId: string | null;
  title: string;
  summary: string | null;
  blocking: string | null;
  priority: number;
  status: ApprovalStatus;
  requestedBy: string | null;
  requestedByRole: string | null;
  assignedTo: string | null;
  assigneeRole: UserRole | null;
  decisionNote: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  escalatesAt: string | null;
  /** Whole days since it was raised — what the queue sorts on after priority. */
  ageDays: number;
  overdue: boolean;
  raisedAt: string;
};

type PersonRow = { firstName: string; lastName: string; preferredName: string | null; role: UserRole } | null;

function personName(person: PersonRow) {
  if (!person) return null;
  return person.preferredName?.trim() || [person.firstName, person.lastName].filter(Boolean).join(" ");
}

const includePeople = {
  requestedBy: { select: { firstName: true, lastName: true, preferredName: true, role: true } },
  assignee: { select: { firstName: true, lastName: true, preferredName: true, role: true } },
  decidedBy: { select: { firstName: true, lastName: true, preferredName: true, role: true } },
} satisfies Prisma.ApprovalRequestInclude;

type ApprovalRow = Prisma.ApprovalRequestGetPayload<{ include: typeof includePeople }>;

@Injectable()
export class ApprovalsService {
  ok<T>(data: Promise<T> | T, message = "Request completed") {
    return Promise.resolve(data).then((resolved) => ({ ok: true, success: true, message, data: resolved }));
  }

  private toView(row: ApprovalRow): ApprovalView {
    const ageMs = Date.now() - row.createdAt.getTime();
    return {
      id: row.id,
      kind: row.kind,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      title: row.title,
      summary: row.summary,
      blocking: row.blocking,
      priority: row.priority,
      status: row.status,
      requestedBy: personName(row.requestedBy),
      requestedByRole: row.requestedBy?.role ?? null,
      assignedTo: personName(row.assignee),
      assigneeRole: row.assigneeRole,
      decisionNote: row.decisionNote,
      decidedBy: personName(row.decidedBy),
      decidedAt: row.decidedAt?.toISOString() ?? null,
      escalatesAt: row.escalatesAt?.toISOString() ?? null,
      ageDays: Math.floor(ageMs / 86_400_000),
      overdue: Boolean(row.escalatesAt && row.escalatesAt.getTime() < Date.now()),
      raisedAt: row.createdAt.toISOString(),
    };
  }

  /**
   * What is waiting on this person: decisions named to them, plus decisions
   * routed to a role they hold. A decision routed to "Head of Sciences" has to
   * reach whoever that is, or it sits unread — which is the failure this whole
   * queue exists to make visible.
   */
  private assignedToMe(session: SessionPayload): Prisma.ApprovalRequestWhereInput {
    return {
      OR: [{ assigneeId: session.userId }, { assigneeId: null, assigneeRole: session.role as UserRole }],
    };
  }

  async listQueue(
    session: SessionPayload,
    query: { assignee?: string; status?: string; kind?: string; take?: string },
  ) {
    const take = Math.min(Number(query.take) || 50, 200);
    const status = query.status && query.status !== "ALL"
      ? (query.status as ApprovalStatus)
      : query.status === "ALL"
        ? undefined
        : ApprovalStatus.PENDING;

    const rows = await prisma.approvalRequest.findMany({
      where: {
        schoolId: session.schoolId,
        ...(query.assignee === "me" ? this.assignedToMe(session) : {}),
        ...(status ? { status } : {}),
        ...(query.kind && query.kind !== "ALL" ? { kind: query.kind as ApprovalKind } : {}),
      },
      include: includePeople,
      // Priority first, then age — the order the Command Center reads them in.
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take,
    });

    return rows.map((row) => this.toView(row));
  }

  /** The count for the sidebar badge, without paying for the rows. */
  async countWaitingOnMe(session: SessionPayload) {
    const waiting = await prisma.approvalRequest.count({
      where: {
        schoolId: session.schoolId,
        status: ApprovalStatus.PENDING,
        ...this.assignedToMe(session),
      },
    });
    return { waiting };
  }

  async getOne(session: SessionPayload, id: string) {
    const row = await prisma.approvalRequest.findFirst({
      where: { id, schoolId: session.schoolId },
      include: includePeople,
    });
    if (!row) throw new NotFoundException("That decision is not in this school's queue.");
    return this.toView(row);
  }

  async raise(session: SessionPayload, payload: unknown) {
    const parsed = raiseSchema.parse(payload);
    if (!parsed.assigneeId && !parsed.assigneeRole) {
      throw new BadRequestException(
        "A decision needs somebody to decide it — name a person or a role.",
      );
    }

    const row = await prisma.approvalRequest.create({
      data: {
        schoolId: session.schoolId,
        kind: parsed.kind,
        subjectType: parsed.subjectType,
        subjectId: parsed.subjectId,
        title: parsed.title,
        summary: parsed.summary,
        blocking: parsed.blocking,
        priority: parsed.priority ?? 0,
        requestedById: session.userId,
        assigneeId: parsed.assigneeId,
        assigneeRole: parsed.assigneeRole,
        escalatesAt: parsed.escalatesAt ? new Date(parsed.escalatesAt) : undefined,
      },
      include: includePeople,
    });
    return this.toView(row);
  }

  async decide(session: SessionPayload, id: string, payload: unknown) {
    const parsed = decideSchema.parse(payload);
    const row = await prisma.approvalRequest.findFirst({
      where: { id, schoolId: session.schoolId },
    });
    if (!row) throw new NotFoundException("That decision is not in this school's queue.");
    if (row.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException(`This was already ${row.status.toLowerCase()}.`);
    }

    // Segregation of duties, enforced at the moment of the decision rather than
    // flagged afterwards: you cannot approve something you raised yourself.
    if (parsed.action === "APPROVE" && row.requestedById === session.userId) {
      throw new BadRequestException("You cannot approve a request you raised yourself.");
    }

    if (parsed.action !== "APPROVE" && !parsed.note) {
      throw new BadRequestException(
        "Say why. A decision returned or refused without a reason cannot be acted on.",
      );
    }

    const updated = await prisma.approvalRequest.update({
      where: { id: row.id },
      data: {
        status: actionToStatus[parsed.action]!,
        decisionNote: parsed.note,
        decidedById: session.userId,
        decidedAt: new Date(),
      },
      include: includePeople,
    });
    return this.toView(updated);
  }
}
