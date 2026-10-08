import { Injectable } from "@nestjs/common";

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
}
