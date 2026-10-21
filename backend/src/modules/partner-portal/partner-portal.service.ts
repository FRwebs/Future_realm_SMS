import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { hashPassword, verifyPassword } from "../../../../src/lib/auth/password";
import { prisma } from "../../../../src/lib/db/prisma";
import { sendNotification } from "../../../../src/lib/integrations/notifications";
import { env } from "../../../../src/lib/utils/env";
import { partnerEngine } from "../partners/partner-engine.service";

const HOUR = 3_600_000;
export const PARTNER_COOKIE = "fr_partner";
const SESSION_HOURS = 12;

const inviteSchema = z.object({
  secondEmail: z.string().trim().optional().transform((v) => v || undefined),
  secondName: z.string().trim().optional().transform((v) => v || undefined),
  welcomeNote: z.string().trim().max(600).optional().transform((v) => v || undefined)
});
const acceptSchema = z.object({ token: z.string().min(20), password: z.string().min(12, "Use at least 12 characters.") });
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const sign = (payload: string) => createHmac("sha256", env.JWT_SECRET).update(`partner:${payload}`).digest("base64url");

/** The partner portal's own sign-in: a signed cookie naming one partner account. It cannot open any school or platform screen. */
export function partnerCookieValue(accountId: string) {
  const payload = `${accountId}.${Date.now() + SESSION_HOURS * HOUR}`;
  return `${payload}.${sign(payload)}`;
}

@Injectable()
export class PartnerPortalService {
  /** Who is signed in, from the cookie alone. */
  async accountFromCookie(cookie: string | undefined) {
    if (!cookie) throw new UnauthorizedException("Sign in to the partner portal.");
    const [accountId, expires, signature] = cookie.split(".");
    const expected = sign(`${accountId}.${expires}`);
    if (!signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) || Number(expires) < Date.now()) throw new UnauthorizedException("Sign in to the partner portal.");
    const account = await prisma.partnerAccount.findUnique({ where: { id: accountId }, include: { partner: true } });
    if (!account || !account.isActive || account.partner.status === "SUSPENDED") throw new UnauthorizedException("This partner account is not active.");
    return account;
  }

  /** From the Back Office: a single-use link, valid 48 hours, to the partner's primary contact and optionally a second person. */
  async invite(session: SessionPayload, partnerId: string, body: unknown) {
    const input = inviteSchema.parse(body);
    const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException("That partner does not exist.");
    if (!partner.email) throw new BadRequestException("Record the partner’s primary contact email first — that is where the login link goes.");
    if (!partner.countersignedAt) throw new BadRequestException("The agreement has not been countersigned yet. A partner is given a login once it has.");
    if (input.secondEmail && !z.string().email().safeParse(input.secondEmail).success) throw new BadRequestException("The second login’s email is not a valid address.");
    const people = [{ email: partner.email.toLowerCase(), name: partner.primaryContactName ?? partner.name, isPrimary: true }, ...(input.secondEmail ? [{ email: input.secondEmail.toLowerCase(), name: input.secondName ?? partner.opsContactName ?? partner.name, isPrimary: false }] : [])];
    const sent: string[] = [];
    for (const person of people) {
      const token = randomBytes(32).toString("base64url");
      const existing = await prisma.partnerAccount.findUnique({ where: { email: person.email } });
      if (existing && existing.partnerId !== partnerId) throw new BadRequestException(`${person.email} already holds a login for a different partner.`);
      await prisma.partnerAccount.upsert({
        where: { email: person.email },
        create: { partnerId, email: person.email, name: person.name, isPrimary: person.isPrimary, inviteHash: sha(token), inviteExpiresAt: new Date(Date.now() + 48 * HOUR), invitedAt: new Date() },
        update: { name: person.name, inviteHash: sha(token), inviteExpiresAt: new Date(Date.now() + 48 * HOUR), invitedAt: new Date(), isActive: true }
      });
      const link = `${env.APP_URL.replace(/\/$/, "")}/partner/accept?token=${token}`;
      await sendNotification({
        channel: "EMAIL",
        recipient: person.email,
        title: `Your ${partner.name} partner portal login`,
        body: `${input.welcomeNote ? `${input.welcomeNote}\n\n` : ""}Open this link to choose your password: ${link}\n\nIt works once and expires in 48 hours. You will see the schools you brought, how they are doing, your commission and your registered deals — and nothing else. Your partner reference code is ${partner.code ?? "not yet issued"}.`
      }).catch(() => undefined);
      sent.push(person.email);
    }
    const actor = await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true } });
    await prisma.auditLog.create({ data: { actorId: actor?.id ?? null, action: AuditAction.CREATE, entityType: "PartnerAccount", entityId: partnerId, metadata: { invited: sent, validHours: 48 } } });
    return { invited: sent };
  }

  async accept(body: unknown) {
    const input = acceptSchema.parse(body);
    const account = await prisma.partnerAccount.findFirst({ where: { inviteHash: sha(input.token), inviteExpiresAt: { gt: new Date() } } });
    if (!account) throw new BadRequestException("This link has expired or was already used. Ask your partner manager for a new one.");
    await prisma.partnerAccount.update({ where: { id: account.id }, data: { passwordHash: hashPassword(input.password), inviteHash: null, inviteExpiresAt: null, lastLoginAt: new Date() } });
    return { accountId: account.id };
  }

  async login(body: unknown) {
    const input = loginSchema.parse(body);
    const account = await prisma.partnerAccount.findUnique({ where: { email: input.email }, include: { partner: { select: { status: true } } } });
    const valid = Boolean(account?.passwordHash) && verifyPassword(input.password, account!.passwordHash!);
    if (!account || !valid || !account.isActive || account.partner.status === "SUSPENDED") throw new UnauthorizedException("That email and password do not match a partner login.");
    await prisma.partnerAccount.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });
    return { accountId: account.id };
  }

  /** Only what the policy allows: their schools, how those are holding up, their commission and their deals. */
  async overview(accountId: string) {
    const account = await prisma.partnerAccount.findUnique({ where: { id: accountId }, include: { partner: true } });
    if (!account) throw new UnauthorizedException("Sign in to the partner portal.");
    const partner = account.partner;
    const [schools, deals, statements, accrued] = await Promise.all([
      partnerEngine.schoolsOf(partner.id),
      prisma.partnerDeal.findMany({ where: { partnerId: partner.id }, orderBy: { registeredAt: "desc" }, take: 100 }),
      prisma.partnerStatement.findMany({ where: { partnerId: partner.id }, orderBy: { issuedAt: "desc" }, take: 24 }),
      prisma.partnerAccrual.aggregate({ where: { partnerId: partner.id, voidedAt: null, statementId: null }, _sum: { commission: true } })
    ]);
    const now = Date.now();
    return {
      person: { name: account.name, email: account.email },
      partner: { name: partner.name, code: partner.code, tier: partner.tier, territory: partner.territory },
      schools: schools.map((school) => ({
        name: school.name,
        location: school.location,
        tier: school.plan,
        tenureMonths: Math.max(0, Math.floor((now - new Date(school.since).getTime()) / (30 * 86_400_000))),
        state: school.status,
        commission: school.commission
      })),
      deals: deals.map((deal) => ({ prospect: deal.prospectSchoolName, location: deal.prospectLocation, registeredAt: deal.registeredAt.toISOString(), validUntil: deal.validUntil.toISOString(), status: deal.status, daysLeft: Math.ceil((deal.validUntil.getTime() - now) / 86_400_000) })),
      commission: {
        accrued: Number(accrued._sum.commission ?? 0),
        statements: statements.map((statement) => ({ ref: statement.ref, period: statement.period, net: Number(statement.net), status: statement.status, dueAt: statement.dueAt.toISOString(), settledAt: statement.settledAt?.toISOString() ?? null }))
      }
    };
  }
}
