import { Injectable } from "@nestjs/common";
import { TEACHING_ROLES } from "../../common/teaching-scope";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";

/**
 * Offline drafts waiting to reach the server.
 *
 * SyncDraft is written by the offline-first clients and has never had a read,
 * so M16 described a queue nobody could see. The depth is per person — a draft
 * belongs to the teacher who took it — but the school needs the whole picture,
 * which is what this returns.
 */
@Injectable()
export class SyncService {
  ok<T>(data: Promise<T> | T, message = "Request completed") {
    return Promise.resolve(data).then((resolved) => ({
      ok: true,
      success: true,
      message,
      data: resolved,
    }));
  }

  async drafts(session: SessionPayload) {
    const rows = await prisma.syncDraft.findMany({
      where: { schoolId: session.schoolId },
      include: {
        user: { select: { firstName: true, lastName: true, preferredName: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const entries = rows.map((row) => {
      const person = row.user;
      return {
        id: row.id,
        userId: row.userId,
        userName: person
          ? person.preferredName?.trim() ||
            [person.firstName, person.lastName].filter(Boolean).join(" ")
          : null,
        userRole: person?.role ? String(person.role) : null,
        type: String(row.type),
        payload: row.payload,
        syncedAt: row.syncedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        // How long this has been held on a device, which is the figure that
        // matters: an unsynced register is a day of attendance nobody can see.
        ageHours: Math.max(0, Math.round((Date.now() - row.createdAt.getTime()) / 3_600_000)),
      };
    });

    const pending = entries.filter((entry) => !entry.syncedAt);
    const synced = entries.filter((entry) => entry.syncedAt);

    return {
      entries,
      pending: pending.length,
      synced: synced.length,
      /** The oldest thing still sitting on somebody's device. */
      oldestPendingHours: pending.length ? Math.max(...pending.map((entry) => entry.ageHours)) : 0,
      lastSyncedAt:
        synced.length
          ? synced
              .map((entry) => entry.syncedAt as string)
              .sort()
              .at(-1) ?? null
          : null,
      devices: new Set(entries.map((entry) => entry.userId)).size,
    };
  }

  /**
   * What the Sync tab reads: what has arrived but not been applied (and what the record refused, with the reason),
   * the conflicts waiting for a choice, and when the school's record last took a write.
   */
  async overview(session: SessionPayload) {
    const schoolId = session.schoolId;
    const author = { select: { firstName: true, lastName: true, preferredName: true, role: true } } as const;
    // A teaching person is asked whether *their* work is saved — not the school's.
    const own = TEACHING_ROLES.has(session.role) ? { userId: session.userId } : {};
    const [pending, conflicted, synced, lastWrite, mine] = await Promise.all([
      prisma.syncDraft.findMany({ where: { schoolId, ...own, state: { in: ["PENDING", "REJECTED"] } }, orderBy: { createdAt: "asc" }, include: { user: author }, take: 500 }),
      prisma.syncDraft.findMany({ where: { schoolId, ...own, state: "CONFLICT" }, orderBy: { createdAt: "asc" }, include: { user: author }, take: 100 }),
      prisma.syncDraft.aggregate({ where: { schoolId, ...own, state: { in: ["APPLIED", "RESOLVED"] } }, _count: { _all: true }, _max: { syncedAt: true } }),
      prisma.auditLog.findFirst({ where: { schoolId, ...(TEACHING_ROLES.has(session.role) ? { actorId: session.userId } : {}) }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      prisma.auditLog.findFirst({ where: { schoolId, actorId: session.userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    ]);
    const key = (row: (typeof pending)[number]) => `${row.type}|${row.state}`;
    const byType = new Map<string, typeof pending>();
    for (const row of pending) byType.set(key(row), [...(byType.get(key(row)) ?? []), row]);
    const name = (user: (typeof pending)[number]["user"]) => (user ? user.preferredName?.trim() || [user.firstName, user.lastName].filter(Boolean).join(" ") : "Unknown");
    const minutes = (date: Date) => Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
    type Side = { summary?: string; by?: string; at?: string | null };
    return {
      pending: pending.length,
      oldestMinutes: pending.length ? minutes(pending[0].createdAt) : null,
      devices: new Set(pending.map((row) => row.userId)).size,
      synced: synced._count._all,
      lastSyncedAt: synced._max.syncedAt?.toISOString() ?? null,
      lastWriteAt: lastWrite?.createdAt.toISOString() ?? null,
      lastWriteMineAt: mine?.createdAt.toISOString() ?? null,
      queue: Array.from(byType.entries()).map(([, rows]) => ({ type: String(rows[0].type), count: rows.length, oldestMinutes: minutes(rows[0].createdAt), who: name(rows[0].user), role: rows[0].user?.role ? String(rows[0].user.role) : null, refused: rows[0].state === "REJECTED", message: rows[0].state === "REJECTED" ? rows[0].message : null })),
      conflicts: conflicted.map((row) => {
        const detail = (row.conflict ?? {}) as { record?: string; school?: Side; device?: Side; differing?: number };
        return { id: row.id, kind: String(row.type), record: detail.record ?? "A record", school: { summary: detail.school?.summary ?? "", by: detail.school?.by ?? "Someone", at: detail.school?.at ?? null }, device: { summary: detail.device?.summary ?? "", by: detail.device?.by ?? name(row.user), at: detail.device?.at ?? row.capturedAt?.toISOString() ?? null }, differing: detail.differing ?? 0, deviceLabel: row.deviceLabel };
      }),
    };
  }
}
