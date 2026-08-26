import { Injectable } from "@nestjs/common";
import type {
  DataCorrectionRecord,
  DataPrivacyRequest,
  MigrationJobStatus,
  PlatformTicketPriority,
  PlatformTicketStatus,
  School,
  SupportTicket
} from "@prisma/client";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import type {
  MyWorkApprovalItem,
  MyWorkCaseRow,
  MyWorkNowCard,
  MyWorkSchoolRow,
  MyWorkSummary,
  MyWorkTicketBreakdownRow,
  MyWorkTone
} from "../../../../src/lib/domain/types";
import { prisma } from "../../../../src/lib/db/prisma";

const OPEN_TICKET_STATUSES: PlatformTicketStatus[] = ["OPEN", "TRIAGED", "IN_PROGRESS", "AWAITING_SCHOOL_RESPONSE", "ESCALATED"];
const OPEN_MIGRATION_STATUSES: MigrationJobStatus[] = ["INVITED", "FILES_AWAITED", "IN_PROGRESS", "PREVIEW_READY", "SIGNED_OFF"];
const DEAL_EXPIRY_WINDOW_DAYS = 14;
const TICKET_PRIORITY_ORDER: PlatformTicketPriority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const CAN_APPROVE_CORRECTIONS = new Set(["PLATFORM_OWNER", "SUPER_ADMIN"]);
const CAN_APPROVE_PRIVACY = new Set(["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPER_ADMIN"]);

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "less than an hour ago";
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

function slaCountdown(ticket: SupportTicket): { text: string; tone: MyWorkTone } {
  if (!ticket.slaDueAt) return { text: "No SLA set", tone: "neutral" };
  const msLeft = ticket.slaDueAt.getTime() - Date.now();
  if (msLeft <= 0) return { text: "SLA breached", tone: "danger" };
  const hoursLeft = Math.round(msLeft / (1000 * 60 * 60));
  if (hoursLeft < 4) return { text: `${hoursLeft}h left`, tone: "danger" };
  if (hoursLeft < 24) return { text: `${hoursLeft}h left`, tone: "warning" };
  const daysLeft = Math.round(hoursLeft / 24);
  return { text: `${daysLeft}d left`, tone: "neutral" };
}

function priorityTone(priority: PlatformTicketPriority): MyWorkTone {
  if (priority === "CRITICAL") return "danger";
  if (priority === "HIGH") return "warning";
  if (priority === "MEDIUM") return "info";
  return "neutral";
}

function schoolSignals(school: School, openTicketCount: number, breachedTicketCount: number): string[] {
  const signals: string[] = [];
  if (school.flaggedForReviewReason && !school.verifiedAt) {
    signals.push(`Flagged for review — ${school.flaggedForReviewReason}`);
  }
  if (school.billingStatus === "OVERDUE") signals.push("Billing overdue");
  if (school.billingStatus === "SUSPENDED") signals.push("Billing suspended");
  if (school.healthScore < 50) signals.push(`Health score ${school.healthScore}/100`);
  if (openTicketCount > 0) {
    signals.push(
      breachedTicketCount > 0
        ? `${openTicketCount} open ticket${openTicketCount > 1 ? "s" : ""}, ${breachedTicketCount} breached SLA`
        : `${openTicketCount} open ticket${openTicketCount > 1 ? "s" : ""}`
    );
  }
  return signals;
}

@Injectable()
export class MyWorkService {
  private response<T>(data: T, message = "Request completed") {
    return { ok: true, success: true, message, data };
  }

  async getMyWork(session: SessionPayload) {
    const [now, schools, cases, approvals, tickets] = await Promise.all([
      this.buildNowCards(session),
      this.buildMySchools(session),
      this.buildMyCases(session),
      this.buildApprovals(session),
      this.buildTicketBreakdown(session)
    ]);

    const summary: MyWorkSummary = {
      refreshedAt: new Date().toISOString(),
      now,
      schools,
      cases,
      approvals,
      tickets
    };

    return this.response(summary, "My Work loaded");
  }

  // ---------------------------------------------------------------------
  // "Needs me now" headline cards
  // ---------------------------------------------------------------------
  private async buildNowCards(session: SessionPayload): Promise<MyWorkNowCard[]> {
    const [myTickets, approvalCounts, schoolSignalSummary, dealSummary] = await Promise.all([
      prisma.supportTicket.findMany({ where: { assignedToId: session.userId, status: { in: OPEN_TICKET_STATUSES } } }),
      this.getApprovalCounts(session),
      this.getSchoolSignalSummary(session),
      this.getExpiringDealSummary(session)
    ]);

    const breached = myTickets.filter((t) => t.slaDueAt && t.slaDueAt.getTime() < Date.now()).length;

    const ticketsCard: MyWorkNowCard = {
      id: "tickets",
      icon: "tickets",
      pill: "Support",
      tone: breached > 0 ? "danger" : myTickets.length > 0 ? "warning" : "success",
      value: myTickets.length,
      unit: "tickets",
      label: "Open tickets assigned to you",
      note: breached > 0 ? `${breached} breached SLA` : myTickets.length > 0 ? "All within SLA" : "Nothing waiting on you",
      action: "Open board",
      link: "/super-admin/support"
    };

    const approvalsCard: MyWorkNowCard = {
      id: "approvals",
      icon: "approvals",
      pill: "Approvals",
      tone: approvalCounts.total > 0 ? "warning" : "success",
      value: approvalCounts.total,
      unit: "items",
      label: "Awaiting your approval",
      note:
        approvalCounts.canApproveAnything
          ? `${approvalCounts.corrections} correction${approvalCounts.corrections === 1 ? "" : "s"} · ${approvalCounts.privacy} privacy request${approvalCounts.privacy === 1 ? "" : "s"}`
          : "Your role doesn't approve items directly",
      action: "Review",
      link: "/super-admin/my-work#approvals"
    };

    const schoolsCard: MyWorkNowCard = {
      id: "schools",
      icon: "schools",
      pill: schoolSignalSummary.source === "account_manager" ? "Portfolio" : "Open cases",
      tone: schoolSignalSummary.signalTotal > 0 ? "warning" : "success",
      value: schoolSignalSummary.signalTotal,
      unit: "schools",
      label: "Schools carrying a signal",
      note:
        schoolSignalSummary.source === "account_manager"
          ? `${schoolSignalSummary.portfolioTotal} in your portfolio`
          : `From schools with a case you own (no account-manager assignments yet)`,
      action: "Open directory",
      link: "/super-admin/schools"
    };

    const dealsCard: MyWorkNowCard = {
      id: "deals",
      icon: "deals",
      pill: dealSummary.source === "created_by_me" ? "Your deals" : "Platform-wide",
      tone: dealSummary.count > 0 ? "warning" : "success",
      value: dealSummary.count,
      unit: "deals",
      label: "Deal registrations expiring soon",
      note:
        dealSummary.source === "created_by_me"
          ? `Registered by you, expiring within ${DEAL_EXPIRY_WINDOW_DAYS} days`
          : dealSummary.count > 0
            ? `None registered by you — platform-wide within ${DEAL_EXPIRY_WINDOW_DAYS} days`
            : "None expiring platform-wide",
      action: "View partners",
      link: "/super-admin/partners"
    };

    return [ticketsCard, approvalsCard, schoolsCard, dealsCard];
  }

  private async getApprovalCounts(session: SessionPayload) {
    const canApproveCorrections = CAN_APPROVE_CORRECTIONS.has(session.role);
    const canApprovePrivacy = CAN_APPROVE_PRIVACY.has(session.role);

    const [corrections, privacy] = await Promise.all([
      canApproveCorrections ? prisma.dataCorrectionRecord.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
      canApprovePrivacy ? prisma.dataPrivacyRequest.count({ where: { status: "OPEN" } }) : Promise.resolve(0)
    ]);

    return {
      corrections,
      privacy,
      total: corrections + privacy,
      canApproveAnything: canApproveCorrections || canApprovePrivacy
    };
  }

  private async getExpiringDealSummary(session: SessionPayload) {
    const windowEnd = new Date(Date.now() + DEAL_EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const mine = await prisma.partnerDeal.count({
      where: { status: "REGISTERED", validUntil: { gte: new Date(), lte: windowEnd }, createdById: session.userId }
    });
    if (mine > 0) return { count: mine, source: "created_by_me" as const };

    const platformWide = await prisma.partnerDeal.count({
      where: { status: "REGISTERED", validUntil: { gte: new Date(), lte: windowEnd } }
    });
    return { count: platformWide, source: "platform_wide" as const };
  }

  // ---------------------------------------------------------------------
  // Shared: resolve which schools belong to "me" (portfolio or fallback)
  // ---------------------------------------------------------------------
  private async getMySchools(session: SessionPayload): Promise<{ schools: School[]; source: "account_manager" | "open_case"; portfolioTotal: number }> {
    const portfolio = await prisma.school.findMany({ where: { accountManagerId: session.userId, deletedAt: null } });
    if (portfolio.length > 0) {
      return { schools: portfolio, source: "account_manager", portfolioTotal: portfolio.length };
    }

    const [ticketSchools, migrationSchools] = await Promise.all([
      prisma.supportTicket.findMany({
        where: { assignedToId: session.userId, status: { in: OPEN_TICKET_STATUSES } },
        select: { schoolId: true },
        distinct: ["schoolId"]
      }),
      prisma.migrationJob.findMany({
        where: { specialistId: session.userId, status: { in: OPEN_MIGRATION_STATUSES } },
        select: { schoolId: true },
        distinct: ["schoolId"]
      })
    ]);

    const schoolIds = Array.from(new Set([...ticketSchools.map((t) => t.schoolId), ...migrationSchools.map((m) => m.schoolId)]));
    const schools = schoolIds.length
      ? await prisma.school.findMany({ where: { id: { in: schoolIds }, deletedAt: null } })
      : [];

    return { schools, source: "open_case", portfolioTotal: schools.length };
  }

  private async getSchoolSignalSummary(session: SessionPayload) {
    const { schools, source, portfolioTotal } = await this.getMySchools(session);
    if (schools.length === 0) return { signalTotal: 0, portfolioTotal: 0, source };

    const tickets = await prisma.supportTicket.findMany({
      where: { schoolId: { in: schools.map((s) => s.id) }, status: { in: OPEN_TICKET_STATUSES } }
    });

    let signalTotal = 0;
    for (const school of schools) {
      const schoolTickets = tickets.filter((t) => t.schoolId === school.id);
      const breached = schoolTickets.filter((t) => t.slaDueAt && t.slaDueAt.getTime() < Date.now()).length;
      if (schoolSignals(school, schoolTickets.length, breached).length > 0) signalTotal += 1;
    }

    return { signalTotal, portfolioTotal, source };
  }

  // ---------------------------------------------------------------------
  // "My schools" table
  // ---------------------------------------------------------------------
  private async buildMySchools(session: SessionPayload): Promise<MyWorkSummary["schools"]> {
    const { schools, source, portfolioTotal } = await this.getMySchools(session);
    if (schools.length === 0) {
      return { source, portfolioTotal: 0, signalTotal: 0, rows: [] };
    }

    const tickets = await prisma.supportTicket.findMany({
      where: { schoolId: { in: schools.map((s) => s.id) }, status: { in: OPEN_TICKET_STATUSES } }
    });

    const rows: MyWorkSchoolRow[] = [];
    for (const school of schools) {
      const schoolTickets = tickets.filter((t) => t.schoolId === school.id);
      const breached = schoolTickets.filter((t) => t.slaDueAt && t.slaDueAt.getTime() < Date.now()).length;
      const signals = schoolSignals(school, schoolTickets.length, breached);
      if (signals.length === 0) continue;

      rows.push({
        id: school.id,
        name: school.name,
        meta: [school.city, school.state].filter(Boolean).join(", ") || school.plan,
        status: school.status,
        signal: signals.join(" · "),
        action: signals[0]?.startsWith("Flagged") ? "Review" : "View",
        link: `/super-admin/schools/${school.id}`
      });
    }

    rows.sort((a, b) => (a.status === "SUSPENDED" ? -1 : b.status === "SUSPENDED" ? 1 : 0));

    return { source, portfolioTotal, signalTotal: rows.length, rows };
  }

  // ---------------------------------------------------------------------
  // "My cases" table — support, migration, data-correction, privacy
  // ---------------------------------------------------------------------
  private async buildMyCases(session: SessionPayload): Promise<MyWorkCaseRow[]> {
    const [tickets, migrations, corrections, privacyRequests] = await Promise.all([
      prisma.supportTicket.findMany({
        where: { assignedToId: session.userId, status: { in: OPEN_TICKET_STATUSES } },
        include: { school: { select: { name: true } } }
      }),
      prisma.migrationJob.findMany({
        where: { specialistId: session.userId, status: { in: OPEN_MIGRATION_STATUSES } },
        include: { school: { select: { name: true } } }
      }),
      prisma.dataCorrectionRecord.findMany({
        where: { requestedById: session.userId, status: "PENDING" },
        include: { ticket: { select: { ticketNo: true, school: { select: { name: true } } } } }
      }),
      prisma.dataPrivacyRequest.findMany({
        where: { handledById: session.userId, status: { in: ["OPEN", "IN_REVIEW"] } },
        include: { school: { select: { name: true } } }
      })
    ]);

    const rows: MyWorkCaseRow[] = [];

    for (const ticket of tickets) {
      const sla = slaCountdown(ticket);
      rows.push({
        id: `ticket-${ticket.id}`,
        subject: `#${ticket.ticketNo} — ${ticket.subject}`,
        module: ticket.school.name,
        type: "Support ticket",
        sla: sla.text,
        slaTone: sla.tone,
        age: timeAgo(ticket.createdAt.toISOString()),
        link: `/super-admin/support/${ticket.id}`
      });
    }

    for (const job of migrations) {
      rows.push({
        id: `migration-${job.id}`,
        subject: `${job.school.name} migration (${job.sourceSystem})`,
        module: job.school.name,
        type: "Migration",
        sla: "No SLA",
        slaTone: "neutral",
        age: timeAgo(job.createdAt.toISOString()),
        link: "/super-admin/migration"
      });
    }

    for (const record of corrections) {
      rows.push({
        id: `correction-${record.id}`,
        subject: `Correction — ${record.fieldCorrected}`,
        module: record.ticket.school.name,
        type: "Data correction",
        sla: "Awaiting approval",
        slaTone: "neutral",
        age: timeAgo(record.createdAt.toISOString()),
        link: "/super-admin/support?tab=corrections"
      });
    }

    for (const request of privacyRequests) {
      rows.push({
        id: `privacy-${request.id}`,
        subject: `${request.type.charAt(0)}${request.type.slice(1).toLowerCase()} request — ${request.subject}`,
        module: request.school?.name ?? "Platform-wide",
        type: "Privacy request",
        sla: request.status === "OPEN" ? "Open" : "In review",
        slaTone: "neutral",
        age: timeAgo(request.createdAt.toISOString()),
        link: "/super-admin/security"
      });
    }

    rows.sort((a, b) => (a.slaTone === "danger" ? -1 : b.slaTone === "danger" ? 1 : a.slaTone === "warning" ? -1 : b.slaTone === "warning" ? 1 : 0));

    return rows;
  }

  // ---------------------------------------------------------------------
  // "Awaiting my approval"
  // ---------------------------------------------------------------------
  private async buildApprovals(session: SessionPayload): Promise<MyWorkApprovalItem[]> {
    const items: MyWorkApprovalItem[] = [];

    if (CAN_APPROVE_CORRECTIONS.has(session.role)) {
      const corrections: (DataCorrectionRecord & { ticket: { ticketNo: string; school: { name: string } }; requestedBy: { firstName: string; lastName: string } | null })[] =
        await prisma.dataCorrectionRecord.findMany({
          where: { status: "PENDING" },
          include: {
            ticket: { select: { ticketNo: true, school: { select: { name: true } } } },
            requestedBy: { select: { firstName: true, lastName: true } }
          },
          orderBy: { createdAt: "asc" }
        });

      for (const record of corrections) {
        items.push({
          id: `correction-${record.id}`,
          title: `Correction — ${record.fieldCorrected} on ticket #${record.ticket.ticketNo}`,
          meta: `${record.ticket.school.name} · requested by ${record.requestedBy ? `${record.requestedBy.firstName} ${record.requestedBy.lastName}` : "unknown"} · ${timeAgo(record.createdAt.toISOString())}`,
          pill: "Data correction",
          tone: "brand",
          approveEndpoint: `/api/super-admin/support/data-correction/${record.id}/approve`,
          approveMethod: "PATCH",
          approveLabel: "Approve",
          declineEndpoint: `/api/super-admin/support/data-correction/${record.id}/reject`,
          declineMethod: "PATCH",
          declineNeedsReason: true
        });
      }
    }

    if (CAN_APPROVE_PRIVACY.has(session.role)) {
      const privacyRequests: (DataPrivacyRequest & { school: { name: string } | null })[] = await prisma.dataPrivacyRequest.findMany({
        where: { status: "OPEN" },
        include: { school: { select: { name: true } } },
        orderBy: { createdAt: "asc" }
      });

      for (const request of privacyRequests) {
        items.push({
          id: `privacy-${request.id}`,
          title: `${request.type.charAt(0)}${request.type.slice(1).toLowerCase()} request — ${request.subject}`,
          meta: `${request.school?.name ?? "Platform-wide"} · opened ${timeAgo(request.createdAt.toISOString())}`,
          pill: "Privacy request",
          tone: "info",
          approveEndpoint: `/api/super-admin/security/privacy-requests/${request.id}/status`,
          approveMethod: "PATCH",
          approveBody: { status: "IN_REVIEW" },
          approveLabel: "Begin review",
          declineEndpoint: `/api/super-admin/security/privacy-requests/${request.id}/status`,
          declineMethod: "PATCH",
          declineBody: { status: "REJECTED" },
          declineNeedsReason: false
        });
      }
    }

    return items;
  }

  // ---------------------------------------------------------------------
  // "My tickets" priority breakdown
  // ---------------------------------------------------------------------
  private async buildTicketBreakdown(session: SessionPayload): Promise<MyWorkTicketBreakdownRow[]> {
    const tickets = await prisma.supportTicket.findMany({
      where: { assignedToId: session.userId, status: { in: OPEN_TICKET_STATUSES } },
      select: { priority: true }
    });

    const counts = new Map<PlatformTicketPriority, number>();
    for (const priority of TICKET_PRIORITY_ORDER) counts.set(priority, 0);
    for (const ticket of tickets) counts.set(ticket.priority, (counts.get(ticket.priority) ?? 0) + 1);

    const max = Math.max(1, ...Array.from(counts.values()));

    return TICKET_PRIORITY_ORDER.map((priority) => ({
      priority: priority.charAt(0) + priority.slice(1).toLowerCase(),
      tone: priorityTone(priority),
      count: counts.get(priority) ?? 0,
      percent: Math.round(((counts.get(priority) ?? 0) / max) * 100)
    }));
  }
}
