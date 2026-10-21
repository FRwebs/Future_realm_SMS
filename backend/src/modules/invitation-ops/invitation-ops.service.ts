import { createHash, randomBytes } from "crypto";

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { sendNotification } from "../../../../src/lib/integrations/notifications";

const DAY = 86_400_000;
/** The most links one account may be sent in a day — enforced here, not asked of the agent. */
export const RESENDS_PER_DAY = 5;
const LINK_DAYS = 7;

const idsSchema = z.object({ userIds: z.array(z.string()).min(1, "Choose at least one invitation.") });
const reasonSchema = idsSchema.extend({ reason: z.string().trim().min(5, "Say why — the reason goes in the audit log.") });
const correctSchema = z.object({ userId: z.string().min(1), email: z.string().trim().toLowerCase().email("That is not an email address."), reason: z.string().trim().min(5, "Say why the address is being changed.") });

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const title = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

type State = "PENDING" | "EXPIRED" | "DELIVERED" | "CANCELLED";

@Injectable()
export class InvitationOpsService {
  private async actor(session: SessionPayload) {
    return (await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true } }))?.id ?? null;
  }

  private async audit(session: SessionPayload, userId: string, schoolId: string, metadata: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId, actorId: await this.actor(session), action: AuditAction.UPDATE, entityType: "Invitation", entityId: userId, metadata } });
  }

  /** An invitation is an account someone created that has never been signed in to and still has to choose its password. */
  private inviteWhere(extra: Prisma.UserWhereInput = {}): Prisma.UserWhereInput {
    return { deletedAt: null, passwordResetRequired: true, lastLoginAt: null, school: { deletedAt: null, isPersonalWorkspace: false }, ...extra };
  }

  async list(query: { schoolId?: string; role?: string; state?: string; age?: string }) {
    const users = await prisma.user.findMany({
      where: this.inviteWhere({ ...(query.schoolId ? { schoolId: query.schoolId } : {}), ...(query.role ? { role: query.role as never } : {}) }),
      select: { id: true, firstName: true, lastName: true, email: true, role: true, schoolId: true, isActive: true, createdAt: true, school: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
      take: 500
    });
    const ids = users.map((u) => u.id);
    const [tokens, events] = await Promise.all([
      prisma.passwordResetToken.findMany({ where: { userId: { in: ids } }, select: { userId: true, createdAt: true, expiresAt: true, consumedAt: true }, orderBy: { createdAt: "desc" } }),
      prisma.auditLog.findMany({ where: { entityType: "Invitation", entityId: { in: ids } }, select: { entityId: true, createdAt: true, metadata: true }, orderBy: { createdAt: "desc" } })
    ]);
    const now = Date.now();
    const rows = users.map((user) => {
      const mine = tokens.filter((t) => t.userId === user.id);
      const latest = mine[0];
      const issued = latest?.createdAt ?? user.createdAt;
      const events_ = events.filter((e) => e.entityId === user.id);
      const lastEvent = events_.find((e) => ["DELIVERED", "CANCELLED"].includes((e.metadata as { kind?: string } | null)?.kind ?? ""));
      const kind = (lastEvent?.metadata as { kind?: string } | null)?.kind;
      let state: State = latest && latest.consumedAt === null && latest.expiresAt.getTime() > now ? "PENDING" : "EXPIRED";
      if (kind === "DELIVERED" && lastEvent && lastEvent.createdAt >= issued) state = "DELIVERED";
      if (kind === "CANCELLED" && !user.isActive) state = "CANCELLED";
      const lastDay = mine.filter((t) => now - t.createdAt.getTime() < DAY).length;
      return { userId: user.id, name: `${user.firstName} ${user.lastName}`, email: user.email, schoolId: user.schoolId, school: user.school.name, role: user.role, roleLabel: title(user.role), resends: Math.max(0, mine.length - 1), sentToday: lastDay, issuedAt: issued.toISOString(), ageDays: Math.floor((now - issued.getTime()) / DAY), state };
    });
    const filtered = rows.filter((row) => {
      const wanted = query.state ?? "waiting";
      const okState = wanted === "all" ? true : wanted === "waiting" ? row.state === "PENDING" || row.state === "EXPIRED" : row.state === wanted.toUpperCase();
      const okAge = !query.age ? true : query.age === "week" ? row.ageDays >= 7 : query.age === "fortnight" ? row.ageDays >= 14 : row.ageDays >= 30;
      return okState && okAge;
    });
    const roles = Array.from(new Set(rows.map((r) => r.role))).sort();
    return { rows: filtered, total: rows.length, waiting: rows.filter((r) => r.state === "PENDING" || r.state === "EXPIRED").length, roles: roles.map((r) => ({ value: r, label: title(r) })), limit: RESENDS_PER_DAY };
  }

  /** A new link, and every older one dead at once. */
  private async issue(userId: string, schoolId: string) {
    const token = randomBytes(32).toString("base64url");
    await prisma.passwordResetToken.updateMany({ where: { userId, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
    await prisma.passwordResetToken.create({ data: { userId, schoolId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + LINK_DAYS * DAY) } });
    return `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
  }

  private async resendOne(session: SessionPayload, userId: string, note: string) {
    const user = await prisma.user.findFirst({ where: this.inviteWhere({ id: userId }), select: { id: true, firstName: true, email: true, schoolId: true, isActive: true, school: { select: { name: true } } } });
    if (!user) return { userId, ok: false as const, why: "Not a pending invitation" };
    if (!user.isActive) return { userId, ok: false as const, why: "Cancelled — it has no seat" };
    const today = await prisma.passwordResetToken.count({ where: { userId, createdAt: { gte: new Date(Date.now() - DAY) } } });
    if (today >= RESENDS_PER_DAY) return { userId, ok: false as const, why: `Limit reached — ${RESENDS_PER_DAY} links per account per 24 hours` };
    const link = await this.issue(user.id, user.schoolId);
    await sendNotification({ channel: "EMAIL", recipient: user.email, title: `Your ${user.school.name} invitation`, body: `Hello ${user.firstName}, use this link to choose your password and open your account. It works once and is valid for ${LINK_DAYS} days; any earlier link no longer works.\n\n${link}` }).catch(() => undefined);
    await this.audit(session, user.id, user.schoolId, { kind: "RESENT", note, count: today + 1 });
    return { userId, ok: true as const };
  }

  async resend(session: SessionPayload, body: unknown) {
    const { userIds } = idsSchema.parse(body);
    const results = [];
    for (const id of userIds) results.push(await this.resendOne(session, id, "Resent by hand"));
    const refused = results.filter((r) => !r.ok);
    if (!results.some((r) => r.ok) && refused.length) throw new BadRequestException(refused[0].ok ? "Nothing was sent." : refused[0].why);
    return { resent: results.filter((r) => r.ok).length, refused: refused.map((r) => (r.ok ? null : r.why)).filter(Boolean) };
  }

  async correctAndResend(session: SessionPayload, body: unknown) {
    const input = correctSchema.parse(body);
    const user = await prisma.user.findFirst({ where: this.inviteWhere({ id: input.userId }), select: { id: true, email: true, schoolId: true } });
    if (!user) throw new NotFoundException("That is not a pending invitation.");
    if (input.email === user.email) throw new BadRequestException("That is already the address on the account.");
    if (await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } })) throw new BadRequestException("Another account already uses that address.");
    await prisma.user.update({ where: { id: user.id }, data: { email: input.email } });
    await this.audit(session, user.id, user.schoolId, { kind: "EMAIL_CORRECTED", from: user.email, to: input.email, reason: input.reason });
    const result = await this.resendOne(session, user.id, `Resent to the corrected address (${input.reason})`);
    if (!result.ok) throw new BadRequestException(`The address was corrected but the link was not sent: ${result.why}`);
    return { corrected: true, previous: user.email };
  }

  async markDelivered(session: SessionPayload, body: unknown) {
    const { userIds, reason } = reasonSchema.parse(body);
    const users = await prisma.user.findMany({ where: this.inviteWhere({ id: { in: userIds } }), select: { id: true, schoolId: true } });
    for (const user of users) await this.audit(session, user.id, user.schoolId, { kind: "DELIVERED", reason });
    return { marked: users.length };
  }

  /** The link dies and the account no longer holds a seat. */
  async cancel(session: SessionPayload, body: unknown) {
    const { userIds, reason } = reasonSchema.parse(body);
    const users = await prisma.user.findMany({ where: this.inviteWhere({ id: { in: userIds } }), select: { id: true, schoolId: true } });
    for (const user of users) {
      await prisma.passwordResetToken.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: new Date() } });
      await prisma.user.update({ where: { id: user.id }, data: { isActive: false, accountStatus: "INACTIVE" } });
      await this.audit(session, user.id, user.schoolId, { kind: "CANCELLED", reason });
    }
    return { cancelled: users.length };
  }
}
