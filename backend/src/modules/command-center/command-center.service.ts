import { Injectable } from "@nestjs/common";
import { ResultWorkflowStatus } from "@prisma/client";
import { endOfDay, startOfDay } from "date-fns";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";

/**
 * The figures behind M01 Command Center · Today.
 *
 * One endpoint rather than six, because the tab shows them together or not at
 * all — six calls would mean six round trips to paint one row of cards, and the
 * term lookup that four of them need would run four times.
 *
 * Everything here is scoped to the session's school and, where a term applies,
 * to the current term. Nothing in this service takes a schoolId from the
 * caller: a principal reads their own school or nothing.
 */

export type CommandCenterActivity = {
  id: string;
  actor: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  at: string;
  /** How many rows this line stands for, once like ones are folded together. */
  count: number;
};

export type CommandCenterToday = {
  students: { active: number; joinedThisTerm: number; withdrawnTotal: number };
  attendance: {
    /** Null when nothing has been marked today — "no data" is not "0%". */
    ratePct: number | null;
    present: number;
    marked: number;
    classesTotal: number;
    classesUnmarked: number;
  };
  collection: { collected: number; expected: number };
  results: { submitted: number; expected: number; returned: number };
  credits: { sms: number; whatsapp: number; threshold: number; low: boolean; configured: boolean };
  sync: { pending: number; lastSyncedAt: string | null };
  activity: CommandCenterActivity[];
  term: { id: string; name: string; startsOn: string | null; endsOn: string | null } | null;
};

@Injectable()
export class CommandCenterService {
  ok<T>(data: Promise<T> | T, message = "Request completed") {
    return Promise.resolve(data).then((resolved) => ({
      ok: true,
      success: true,
      message,
      data: resolved,
    }));
  }

  async today(session: SessionPayload): Promise<CommandCenterToday> {
    const schoolId = session.schoolId;
    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);

    const term = await prisma.term.findFirst({
      where: { isCurrent: true, academicSession: { schoolId } },
      select: { id: true, name: true, startDate: true, endDate: true },
    });
    // Without a current term, "this term" has no meaning — the counts that
    // depend on one report 0 rather than silently widening to all of history.
    const termStart = term?.startDate ?? null;

    const [
      activeStudents,
      joinedThisTerm,
      withdrawnTotal,
      attendanceToday,
      markedClasses,
      classesTotal,
      invoiceAgg,
      resultCounts,
      wallet,
      pendingSync,
      lastSynced,
      auditRows,
    ] = await Promise.all([
      prisma.student.count({ where: { schoolId, status: "ACTIVE" } }),
      termStart
        ? prisma.student.count({ where: { schoolId, admissionDate: { gte: termStart } } })
        : Promise.resolve(0),
      // Not "withdrawn this term": Student carries admissionDate but no record
      // of when a status changed, so the term window cannot be computed from it
      // and this is the running total. The card says so rather than implying a
      // window it does not have. Giving Student a statusChangedAt — or reading
      // the audit log for the transition — is what would narrow it.
      prisma.student.count({ where: { schoolId, status: "WITHDRAWN" } }),
      prisma.studentAttendance.groupBy({
        by: ["status"],
        where: { schoolId, date: { gte: dayStart, lte: dayEnd } },
        _count: { _all: true },
      }),
      prisma.studentAttendance.findMany({
        where: { schoolId, date: { gte: dayStart, lte: dayEnd } },
        select: { classId: true },
        distinct: ["classId"],
      }),
      prisma.classRoom.count({ where: { schoolId } }),
      prisma.invoice.aggregate({
        where: { schoolId, status: { not: "VOID" } },
        _sum: { total: true, balance: true },
      }),
      term
        ? prisma.resultSheet.groupBy({
            by: ["status"],
            where: { schoolId, termId: term.id },
            _count: { _all: true },
          })
        : Promise.resolve([] as Array<{ status: ResultWorkflowStatus; _count: { _all: number } }>),
      prisma.notificationWallet.findUnique({ where: { schoolId } }),
      prisma.syncDraft.count({ where: { schoolId, userId: session.userId, syncedAt: null } }),
      prisma.syncDraft.findFirst({
        where: { schoolId, userId: session.userId, syncedAt: { not: null } },
        orderBy: { syncedAt: "desc" },
        select: { syncedAt: true },
      }),
      prisma.auditLog.findMany({
        where: { schoolId },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          id: true,
          action: true,
          entityType: true,
          createdAt: true,
          actorId: true,
          actor: { select: { firstName: true, lastName: true, preferredName: true, role: true } },
        },
      }),
    ]);

    const marked = attendanceToday.reduce((sum, row) => sum + row._count._all, 0);
    const present = attendanceToday
      .filter((row) => row.status === "PRESENT" || row.status === "LATE")
      .reduce((sum, row) => sum + row._count._all, 0);

    const total = Number(invoiceAgg._sum.total ?? 0);
    const balance = Number(invoiceAgg._sum.balance ?? 0);

    const countOf = (...statuses: ResultWorkflowStatus[]) =>
      resultCounts
        .filter((row) => statuses.includes(row.status))
        .reduce((sum, row) => sum + row._count._all, 0);

    // "Submitted" is anything that has left the teacher's hands, which is every
    // state but DRAFT and RETURNED — a returned sheet is back with them.
    const expected = resultCounts.reduce((sum, row) => sum + row._count._all, 0);
    const submitted = expected - countOf(ResultWorkflowStatus.DRAFT, ResultWorkflowStatus.RETURNED);

    return {
      students: { active: activeStudents, joinedThisTerm, withdrawnTotal },
      attendance: {
        ratePct: marked > 0 ? Math.round((present / marked) * 1000) / 10 : null,
        present,
        marked,
        classesTotal,
        classesUnmarked: Math.max(0, classesTotal - markedClasses.length),
      },
      collection: { collected: total - balance, expected: total },
      results: {
        submitted,
        expected,
        returned: countOf(ResultWorkflowStatus.RETURNED),
      },
      credits: {
        sms: wallet?.smsBalance ?? 0,
        whatsapp: wallet?.whatsappBalance ?? 0,
        threshold: wallet?.lowBalanceThreshold ?? 0,
        low: wallet ? wallet.smsBalance <= wallet.lowBalanceThreshold : false,
        // A school with no wallet row has not set messaging up at all, which
        // the card has to say differently from a wallet that has run dry.
        configured: Boolean(wallet),
      },
      sync: { pending: pendingSync, lastSyncedAt: lastSynced?.syncedAt?.toISOString() ?? null },
      activity: this.foldActivity(auditRows),
      term: term
        ? {
            id: term.id,
            name: term.name,
            startsOn: term.startDate?.toISOString() ?? null,
            endsOn: term.endDate?.toISOString() ?? null,
          }
        : null,
    };
  }

  /**
   * "Mrs Folake Adeniyi approved 12 score sheets" is one line on the page and
   * twelve rows in the log. Consecutive rows by the same person doing the same
   * thing to the same kind of record fold into one, carrying the count — which
   * is what the mockup's Activity list shows.
   */
  private foldActivity(
    rows: Array<{
      id: string;
      action: string;
      entityType: string;
      createdAt: Date;
      actorId: string | null;
      actor: {
        firstName: string;
        lastName: string;
        preferredName: string | null;
        role: string;
      } | null;
    }>,
  ): CommandCenterActivity[] {
    const folded: CommandCenterActivity[] = [];

    for (const row of rows) {
      const name = row.actor
        ? row.actor.preferredName?.trim() ||
          [row.actor.firstName, row.actor.lastName].filter(Boolean).join(" ")
        : null;
      const previous = folded[folded.length - 1];

      if (
        previous &&
        previous.actor === name &&
        previous.action === row.action &&
        previous.entityType === row.entityType
      ) {
        previous.count += 1;
        continue;
      }

      folded.push({
        id: row.id,
        actor: name,
        actorRole: row.actor?.role ?? null,
        action: row.action,
        entityType: row.entityType,
        at: row.createdAt.toISOString(),
        count: 1,
      });

      if (folded.length >= 6) break;
    }

    return folded;
  }
}
