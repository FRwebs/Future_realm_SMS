import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { TEACHING_ROLES } from "../../common/teaching-scope";
import { PlatformTicketCategory, PlatformTicketPriority } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { plansFeatures } from "../plans-features/plans-features.service";
import { prisma } from "../../../../src/lib/db/prisma";
import { supportDesk } from "../support-desk/support-desk.service";
import { platformIdentity } from "../../../../src/lib/platform-identity";

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
    // A teaching person sees the tickets they raised themselves — not everything the school has asked of support.
    const own = TEACHING_ROLES.has(session.role);
    const rows = await prisma.supportTicket.findMany({
      where: { schoolId: session.schoolId, ...(own ? { createdById: session.userId } : {}) },
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
        slaDueAt: await supportDesk.slaDueAt(session.schoolId, parsed.priority ?? PlatformTicketPriority.MEDIUM),
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

  /**
   * Everything the Help & Support tab shows besides the tickets: whether the system answered just now (so "is it my
   * internet or is it the system" does not become a ticket), and the help articles written for this person's role.
   */
  async overview(session: SessionPayload) {
    const started = Date.now();
    let database = true;
    try {
      await prisma.$queryRaw`select 1`;
    } catch {
      database = false;
    }
    const latency = Date.now() - started;
    const [articles, csat, tickets] = await Promise.all([
      prisma.knowledgeBaseArticle.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ views: "desc" }, { createdAt: "desc" }], take: 60, select: { id: true, title: true, slug: true, category: true, roleTarget: true, videoUrl: true, views: true, helpfulYes: true, helpfulNo: true, body: true } }),
      prisma.ticketCsatResponse.aggregate({ where: { ticket: { schoolId: session.schoolId } }, _avg: { score: true }, _count: { _all: true } }),
      this.tickets(session),
    ]);
    // A dedicated account manager is part of some plans only. Without the entitlement the school is not told of one.
    const entitled = await plansFeatures.entitled(session.schoolId, "support.account_manager");
    const school = await prisma.school.findUnique({ where: { id: session.schoolId }, select: { accountManager: { select: { firstName: true, lastName: true, email: true, phone: true } } } });
    const manager = school?.accountManager ?? null;
    const mine = String(session.role);
    const target = (roleTarget: string | null) => !roleTarget || roleTarget.split(/[,;|]/).map((value) => value.trim().toUpperCase().replace(/\s+/g, "_")).includes(mine);
    return {
      status: { ok: database, checkedAt: new Date().toISOString(), databaseMs: latency, uptimeMinutes: Math.round(process.uptime() / 60) },
      articles: articles.map((article) => ({ id: article.id, title: article.title, category: article.category, roleTarget: article.roleTarget, video: Boolean(article.videoUrl), views: article.views, helpful: article.helpfulYes, unhelpful: article.helpfulNo, forMe: target(article.roleTarget), summary: article.body.replace(/\s+/g, " ").slice(0, 140), body: article.body.slice(0, 4000), slug: article.slug })),
      satisfaction: { average: csat._avg.score === null ? null : Math.round(csat._avg.score * 10) / 10, responses: csat._count._all },
      tickets,
      responseTarget: "4 working hours",
      contact: { platformName: platformIdentity().platformName, email: platformIdentity().supportEmail, phone: platformIdentity().supportPhone },
      accountManager: entitled.allowed
        ? manager ? { state: "assigned", name: `${manager.firstName} ${manager.lastName}`, email: manager.email, phone: manager.phone ?? null } : { state: "unassigned", name: null, email: null, phone: null }
        : { state: "not-in-plan", name: null, email: null, phone: null, why: entitled.why },
    };
  }
}
