import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";

const KEEP = 20;
const viewSchema = z.object({
  kind: z.enum(["SCHOOL", "TICKET", "PARTNER", "MIGRATION", "OTHER"]),
  entityId: z.string().min(1),
  label: z.string().trim().min(1).max(160),
  href: z.string().startsWith("/super-admin")
});

@Injectable()
export class AdminViewsService {
  private async who(session: SessionPayload) {
    return (await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true } }))?.id ?? session.userId;
  }

  async record(session: SessionPayload, body: unknown) {
    const input = viewSchema.parse(body);
    const userId = await this.who(session);
    await prisma.adminView.upsert({ where: { userId_kind_entityId: { userId, kind: input.kind, entityId: input.entityId } }, create: { userId, ...input }, update: { label: input.label, href: input.href, viewedAt: new Date() } });
    const stale = await prisma.adminView.findMany({ where: { userId }, orderBy: { viewedAt: "desc" }, skip: KEEP, select: { id: true } });
    if (stale.length) await prisma.adminView.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });
    return { ok: true };
  }

  async recent(session: SessionPayload) {
    const rows = await prisma.adminView.findMany({ where: { userId: await this.who(session) }, orderBy: { viewedAt: "desc" }, take: 8 });
    return rows.map((row) => ({ id: row.id, kind: row.kind, label: row.label, href: row.href, viewedAt: row.viewedAt.toISOString() }));
  }
}
