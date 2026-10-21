import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, UserRole } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { canAssignRole, isPlatformRole } from "../../../../src/lib/auth/role-architecture";
import { prisma } from "../../../../src/lib/db/prisma";
import { sendNotification } from "../../../../src/lib/integrations/notifications";

const SCHOOL_LEADERS = new Set(["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL", "ADMINISTRATOR"]);

const grantSchema = z.object({
  email: z.string().trim().toLowerCase().email("Give the email address of the person's existing account."),
  role: z.nativeEnum(UserRole),
  schoolId: z.string().trim().optional(),
  expiresAt: z.string().trim().optional().transform((v) => (v ? new Date(v) : null)),
  note: z.string().trim().max(300).optional()
});

const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

/**
 * One account, many schools. A person keeps the school they signed up in and can be given a role in others; they switch
 * between them from the profile menu without signing in again. A membership can end on a date (an external examiner).
 */
@Injectable()
export class MembershipsService {
  /** Everywhere this person belongs: where the account was made, and every live membership. */
  async listFor(userId: string) {
    const [user, memberships] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { schoolId: true, role: true, school: { select: { name: true } } } }),
      prisma.schoolMembership.findMany({ where: { userId, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } })
    ]);
    if (!user) return [];
    const schools = await prisma.school.findMany({ where: { id: { in: memberships.map((m) => m.schoolId) }, deletedAt: null }, select: { id: true, name: true } });
    const name = new Map(schools.map((s) => [s.id, s.name]));
    return [
      { schoolId: user.schoolId, schoolName: user.school.name, role: String(user.role), primary: true, expiresAt: null as string | null },
      ...memberships.filter((m) => name.has(m.schoolId)).map((m) => ({ schoolId: m.schoolId, schoolName: name.get(m.schoolId) as string, role: String(m.role), primary: false, expiresAt: m.expiresAt?.toISOString() ?? null }))
    ];
  }

  /** Whether this person may act as `role` in `schoolId` right now: their own school, or a live membership. */
  async holds(userId: string, schoolId: string, role: string): Promise<boolean> {
    const own = await prisma.user.findUnique({ where: { id: userId }, select: { schoolId: true, role: true } });
    if (own && own.schoolId === schoolId && String(own.role) === role) return true;
    const m = await prisma.schoolMembership.findUnique({ where: { userId_schoolId: { userId, schoolId } } });
    return Boolean(m && m.status === "ACTIVE" && String(m.role) === role && (!m.expiresAt || m.expiresAt > new Date()));
  }

  /** The identity to sign in as when switching to a school the person belongs to. */
  async switchTo(session: SessionPayload, schoolId: string) {
    const where = (await this.listFor(session.userId)).find((entry) => entry.schoolId === schoolId);
    if (!where) throw new ForbiddenException("You do not belong to that school.");
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true, firstName: true, lastName: true } });
    if (!user) throw new NotFoundException("Your account no longer exists.");
    return { userId: session.userId, schoolId, role: where.role, email: user.email, name: `${user.firstName} ${user.lastName}`.trim() };
  }

  /** Give an existing account a role in a school: a school's own leadership adds people to it, and the Back Office can add anyone anywhere. */
  async grant(session: SessionPayload, body: unknown) {
    const input = grantSchema.parse(body);
    const platform = isPlatformRole(session.role as never);
    const schoolId = platform ? input.schoolId : session.schoolId;
    if (!schoolId) throw new BadRequestException("Say which school.");
    if (!platform) {
      if (!SCHOOL_LEADERS.has(String(session.role))) throw new ForbiddenException("Only a school's leadership can add someone to it.");
      if (!canAssignRole(session.role as never, input.role)) throw new ForbiddenException(`You cannot give someone a ${label(input.role)} role: it is equal to or above your own authority.`);
    }
    if (isPlatformRole(input.role as never)) throw new BadRequestException("A school membership cannot carry a Back Office role.");
    const [person, school] = await Promise.all([
      prisma.user.findFirst({ where: { email: input.email, deletedAt: null }, select: { id: true, schoolId: true, firstName: true } }),
      prisma.school.findFirst({ where: { id: schoolId, deletedAt: null }, select: { id: true, name: true } })
    ]);
    if (!person) throw new NotFoundException("Nobody has an account with that email. They need to have an account first.");
    if (!school) throw new NotFoundException("That school does not exist.");
    if (person.schoolId === school.id) throw new BadRequestException("This is already where their account belongs.");
    if (input.expiresAt && Number.isNaN(input.expiresAt.getTime())) throw new BadRequestException("The end date is not a date.");
    const row = await prisma.schoolMembership.upsert({
      where: { userId_schoolId: { userId: person.id, schoolId: school.id } },
      create: { userId: person.id, schoolId: school.id, role: input.role, expiresAt: input.expiresAt, invitedById: session.userId, note: input.note ?? null },
      update: { role: input.role, status: "ACTIVE", removedAt: null, expiresAt: input.expiresAt, invitedById: session.userId, note: input.note ?? null }
    });
    await prisma.auditLog.create({ data: { schoolId: school.id, actorId: session.userId, action: AuditAction.CREATE, entityType: "SchoolMembership", entityId: row.id, metadata: { summary: `${person.firstName} added to ${school.name} as ${label(input.role)}`, expiresAt: input.expiresAt?.toISOString() ?? null } } });
    await sendNotification({ channel: "EMAIL", recipient: input.email, title: `You can now switch to ${school.name}`, body: `You have been added to ${school.name} as ${label(input.role)}${input.expiresAt ? ` until ${input.expiresAt.toDateString()}` : ""}. Sign in as usual and choose it from the menu under your name.` }).catch(() => undefined);
    return { id: row.id };
  }

  async revoke(session: SessionPayload, membershipId: string) {
    const row = await prisma.schoolMembership.findUnique({ where: { id: membershipId } });
    if (!row || row.status !== "ACTIVE") throw new NotFoundException("That membership does not exist.");
    if (!isPlatformRole(session.role as never) && (row.schoolId !== session.schoolId || !SCHOOL_LEADERS.has(String(session.role)))) throw new ForbiddenException("Only a school's leadership can remove someone from it.");
    await prisma.schoolMembership.update({ where: { id: row.id }, data: { status: "REMOVED", removedAt: new Date() } });
    // Anyone signed in to that school through this membership is signed out of it.
    await prisma.platformSession.updateMany({ where: { userId: row.userId, schoolId: row.schoolId, revokedAt: null }, data: { revokedAt: new Date() } });
    await prisma.auditLog.create({ data: { schoolId: row.schoolId, actorId: session.userId, action: AuditAction.DELETE, entityType: "SchoolMembership", entityId: row.id, metadata: { summary: "Membership removed" } } });
    return { removed: true };
  }

  /** Everyone who belongs to a school through a membership, for its own Staff & Access view. */
  async ofSchool(schoolId: string) {
    const rows = await prisma.schoolMembership.findMany({ where: { schoolId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
    const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, firstName: true, lastName: true, email: true, school: { select: { name: true } } } });
    const by = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => ({ id: r.id, name: `${by.get(r.userId)?.firstName ?? ""} ${by.get(r.userId)?.lastName ?? ""}`.trim(), email: by.get(r.userId)?.email ?? "", home: by.get(r.userId)?.school.name ?? "", role: String(r.role), expiresAt: r.expiresAt?.toISOString() ?? null, since: r.createdAt.toISOString() }));
  }
}

export const memberships = new MembershipsService();
