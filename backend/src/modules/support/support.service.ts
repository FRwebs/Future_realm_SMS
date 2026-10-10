import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PlatformTicketCategory, PlatformTicketPriority } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";

/**
 * A school's own support tickets.
 *
 * Everything under super-admin is platform-wide: it lists every school's
 * tickets and every message on them, including the internal notes support
 * staff write to each other. A school needs to see its own, and must not see
 * those notes — `internalOnly` is the line, and it is enforced here rather
 * than trusted to the caller.
 */

const raiseSchema = z.object({
  category: z.nativeEnum(PlatformTicketCategory),
  subject: z.string().trim().min(5, "Give the ticket a subject somebody can scan."),
  description: z.string().trim().min(20, "Describe what happened — twenty characters at minimum."),
  priority: z.nativeEnum(PlatformTicketPriority).optional(),
});

const replySchema = z.object({
  body: z.string().trim().min(2, "Write something before sending."),
});

/** Statuses where the school is the one being waited on. */
const WAITING_ON_SCHOOL = new Set(["AWAITING_SCHOOL_RESPONSE"]);
const CLOSED = new Set(["RESOLVED", "CLOSED"]);

@Injectable()
export class SupportService {
  ok<T>(data: Promise<T> | T, message = "Request completed") {
    return Promise.resolve(data).then((resolved) => ({
      ok: true,
      success: true,
      message,
      data: resolved,
    }));
  }

  async tickets(session: SessionPayload) {
    const rows = await prisma.supportTicket.findMany({
      where: { schoolId: session.schoolId },
      include: {
        // Internal notes are support's own working-out. They are excluded at
        // the query rather than filtered afterwards, so a change to the shape
        // of this response cannot accidentally leak them.
        messages: {
          where: { internalOnly: false },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            body: true,
            createdAt: true,
            author: { select: { firstName: true, lastName: true, role: true } },
          },
        },
        assignedTo: { select: { firstName: true, lastName: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const now = Date.now();
    const tickets = rows.map((ticket) => {
      const open = !CLOSED.has(String(ticket.status));
      const lastMessage = ticket.messages.at(-1);
      return {
        id: ticket.id,
        ticketNo: ticket.ticketNo,
        category: String(ticket.category),
        subject: ticket.subject,
        description: ticket.description,
        priority: String(ticket.priority),
        status: String(ticket.status),
        open,
        waitingOnSchool: WAITING_ON_SCHOOL.has(String(ticket.status)),
        slaDueAt: ticket.slaDueAt?.toISOString() ?? null,
        /** Past its promised answer time and still open. */
        slaBreached: Boolean(ticket.slaDueAt && open && ticket.slaDueAt.getTime() < now),
        assignedTo: ticket.assignedTo
          ? [ticket.assignedTo.firstName, ticket.assignedTo.lastName].filter(Boolean).join(" ")
          : null,
        raisedBy: ticket.createdBy
          ? [ticket.createdBy.firstName, ticket.createdBy.lastName].filter(Boolean).join(" ")
          : null,
        messageCount: ticket.messages.length,
        lastMessageAt: lastMessage?.createdAt.toISOString() ?? null,
        ageDays: Math.max(0, Math.floor((now - ticket.createdAt.getTime()) / 86_400_000)),
        resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
        createdAt: ticket.createdAt.toISOString(),
        messages: ticket.messages.map((message) => ({
          id: message.id,
          body: message.body,
          author: message.author
            ? [message.author.firstName, message.author.lastName].filter(Boolean).join(" ")
            : "Support",
          authorRole: message.author?.role ? String(message.author.role) : null,
          createdAt: message.createdAt.toISOString(),
        })),
      };
    });

    const open = tickets.filter((ticket) => ticket.open);
    return {
      tickets,
      open: open.length,
      waitingOnSchool: open.filter((ticket) => ticket.waitingOnSchool).length,
      breached: open.filter((ticket) => ticket.slaBreached).length,
      resolved: tickets.length - open.length,
    };
  }

  async raise(session: SessionPayload, payload: unknown) {
    const parsed = raiseSchema.parse(payload);
    const ticket = await prisma.supportTicket.create({
      data: {
        schoolId: session.schoolId,
        userId: session.userId,
        createdById: session.userId,
        ticketNo: `SUP-${Date.now().toString(36).toUpperCase()}`,
        category: parsed.category,
        subject: parsed.subject,
        description: parsed.description,
        priority: parsed.priority ?? PlatformTicketPriority.MEDIUM,
      },
      select: { id: true, ticketNo: true },
    });
    return ticket;
  }

  async reply(session: SessionPayload, ticketId: string, payload: unknown) {
    const parsed = replySchema.parse(payload);
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: ticketId, schoolId: session.schoolId },
      select: { id: true, status: true },
    });
    if (!ticket) throw new NotFoundException("That ticket is not on this school.");
    if (CLOSED.has(String(ticket.status))) {
      throw new BadRequestException("This ticket is closed. Raise a new one rather than reopening it.");
    }

    await prisma.ticketMessage.create({
      data: { ticketId: ticket.id, authorId: session.userId, body: parsed.body, internalOnly: false },
    });
    return { id: ticket.id };
  }
}
