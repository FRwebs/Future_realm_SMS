import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";

/**
 * The school's own audit trail.
 *
 * The log has always been written and indexed — `@@index([schoolId, action,
 * createdAt])` is exactly this query — but the only way to read it was through
 * super-admin, which is platform-wide. A principal has to be able to see their
 * own school's log without platform access, which is what this is for.
 *
 * Every query is scoped to the session's school. Nothing here takes a schoolId
 * from the caller.
 */

export type AuditEntryView = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: string | null;
  actorRole: string | null;
  actorEmail: string | null;
  ipAddress: string | null;
  metadata: unknown;
  createdAt: string;
};

export type AuditFeed = {
  entries: AuditEntryView[];
  total: number;
  byAction: Array<{ action: string; count: number }>;
  byActor: Array<{ actor: string; count: number }>;
  /** Distinct days the log covers, oldest first — the span it can speak for. */
  firstAt: string | null;
  lastAt: string | null;
};

@Injectable()
export class AuditService {
  ok<T>(data: Promise<T> | T, message = "Request completed") {
    return Promise.resolve(data).then((resolved) => ({
      ok: true,
      success: true,
      message,
      data: resolved,
    }));
  }

  async recent(
    session: SessionPayload,
    query: { take?: string; action?: string; entityType?: string },
  ): Promise<AuditFeed> {
    const take = Math.min(Number(query.take) || 100, 500);
    const where: Prisma.AuditLogWhereInput = {
      schoolId: session.schoolId,
      ...(query.action && query.action !== "ALL" ? { action: query.action as never } : {}),
      ...(query.entityType && query.entityType !== "ALL" ? { entityType: query.entityType } : {}),
    };

    const [rows, total, byAction, bounds] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          ipAddress: true,
          metadata: true,
          createdAt: true,
          actor: {
            select: { firstName: true, lastName: true, preferredName: true, role: true, email: true },
          },
        },
      }),
      prisma.auditLog.count({ where: { schoolId: session.schoolId } }),
      prisma.auditLog.groupBy({
        by: ["action"],
        where: { schoolId: session.schoolId },
        _count: { _all: true },
      }),
      prisma.auditLog.aggregate({
        where: { schoolId: session.schoolId },
        _min: { createdAt: true },
        _max: { createdAt: true },
      }),
    ]);

    const entries = rows.map((row) => ({
      id: row.id,
      action: String(row.action),
      entityType: row.entityType,
      entityId: row.entityId ?? null,
      actor: row.actor
        ? row.actor.preferredName?.trim() ||
          [row.actor.firstName, row.actor.lastName].filter(Boolean).join(" ")
        : null,
      actorRole: row.actor?.role ?? null,
      actorEmail: row.actor?.email ?? null,
      ipAddress: row.ipAddress ?? null,
      metadata: row.metadata ?? null,
      createdAt: row.createdAt.toISOString(),
    }));

    // Who is most active, counted off the page that was read rather than the
    // whole table: grouping by actor across every row would need a join the
    // index does not cover, and the tab only ever shows the leaders.
    const actorCounts = new Map<string, number>();
    for (const entry of entries) {
      if (!entry.actor) continue;
      actorCounts.set(entry.actor, (actorCounts.get(entry.actor) ?? 0) + 1);
    }

    return {
      entries,
      total,
      byAction: byAction
        .map((group) => ({ action: String(group.action), count: group._count._all }))
        .sort((a, b) => b.count - a.count),
      byActor: Array.from(actorCounts.entries())
        .map(([actor, count]) => ({ actor, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      firstAt: bounds._min.createdAt?.toISOString() ?? null,
      lastAt: bounds._max.createdAt?.toISOString() ?? null,
    };
  }
}
