import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";

import { prisma } from "../../../../src/lib/db/prisma";
import type { SessionPayload } from "../../../../src/lib/auth/session-core";

/**
 * One login, several schools — how the second school gets onto an existing login.
 *
 * A school that adds a parent writes a guardian record with the parent's email.
 * That alone never reaches a login: a school office typing an address must not be
 * able to hand a child's record to whoever owns it (a mistyped address is somebody
 * else's). So the match is only ever an *offer*, shown to the person who is already
 * signed in with that very address, and nothing is linked until they accept it.
 *
 * The address is the proof: it is the one this login was created with and signs in
 * by, and only its owner can reach the account. A phone number proves nothing yet —
 * it is not verified anywhere — so it is never matched on.
 */

const open = (email: string): Prisma.GuardianWhereInput => ({
  userId: null,
  mergedIntoId: null,
  // A safeguarding restriction means nobody opens this guardian's account until the school lifts it.
  safeguardingRestrictedAt: null,
  email: { equals: email, mode: "insensitive" },
});

async function home(session: SessionPayload) {
  const user = await prisma.user.findFirst({ where: { id: session.userId, deletedAt: null }, select: { id: true, email: true } });
  if (!user) throw new NotFoundException("No account found.");
  const held = await prisma.guardian.findMany({ where: { userId: user.id, mergedIntoId: null }, select: { schoolId: true } });
  return { user, linked: [...new Set(held.map((row) => row.schoolId))] };
}

/** The school records written with this login's address that no login holds yet. */
export async function schoolOffers(session: SessionPayload) {
  const { user, linked } = await home(session);
  const rows = await prisma.guardian.findMany({
    where: { ...open(user.email.trim()), schoolId: { notIn: linked }, students: { some: {} } },
    select: {
      id: true, firstName: true, lastName: true, relationship: true,
      school: { select: { name: true, shortName: true, city: true, state: true } },
      students: { select: { student: { select: { firstName: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  // A school can hold only one record per login, so a second record at one school is not offered.
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    const key = row.school.name;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      id: row.id,
      name: `${row.firstName} ${row.lastName}`,
      relationship: row.relationship,
      school: row.school.name,
      short: row.school.shortName?.trim() || row.school.name,
      place: [row.school.city, row.school.state].filter(Boolean).join(", "),
      children: row.students.map((link) => link.student.firstName),
    }];
  });
}

/** Link one offered record to the signed-in login. The match is checked again here; the page is not trusted. */
export async function linkSchool(session: SessionPayload, guardianId: string) {
  const { user, linked } = await home(session);
  const target = await prisma.guardian.findFirst({
    where: { ...open(user.email.trim()), id: guardianId },
    select: { id: true, schoolId: true, firstName: true, lastName: true, school: { select: { name: true } }, students: { select: { studentId: true } } },
  });
  if (!target) throw new NotFoundException("That record is not open to link. Ask the school office to check the email address it holds for you.");
  if (linked.includes(target.schoolId)) throw new BadRequestException(`Your account is already linked at ${target.school.name}.`);
  try {
    await prisma.$transaction(async (tx) => {
      // The guard is in the write itself: if another login took this record a moment ago, nothing changes.
      const taken = await tx.guardian.updateMany({ where: { id: target.id, userId: null }, data: { userId: user.id } });
      if (taken.count !== 1) throw new ConflictException("That record was linked to an account a moment ago. Ask the school office.");
      await tx.guardianContact.create({
        data: { schoolId: target.schoolId, guardianId: target.id, kind: "LINK", channel: "Portal", summary: "The parent linked this record to their login", createdById: user.id },
      });
      await tx.auditLog.create({
        data: {
          schoolId: target.schoolId, actorId: user.id, action: AuditAction.UPDATE, entityType: "Guardian", entityId: target.id,
          metadata: { summary: `Guardian linked to a parent login · ${target.firstName} ${target.lastName} · ${target.students.length} children`, matchedOn: "email" },
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException(`Your account is already linked at ${target.school.name}.`);
    throw error;
  }
  return { id: target.id, school: target.school.name, children: target.students.length };
}
