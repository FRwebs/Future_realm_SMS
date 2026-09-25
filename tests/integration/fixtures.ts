import { prisma } from "../../src/lib/db/prisma";

/**
 * Real identifiers from the seeded database.
 *
 * These tests used to run against an in-memory demo store with fixed ids like
 * "school_greenfield" and "stu_1". That store is gone — every service talks to
 * Prisma now — so the ids are resolved from whatever the seed actually created.
 * Nothing here asserts a particular name or count: the seed is free to change,
 * and the tests are about the services' behaviour, not the fixture's contents.
 */
export type SeededFixtures = {
  schoolId: string;
  termId: string | null;
  principal: { userId: string; email: string; name: string };
  teacher: { userId: string; email: string };
  parent: { userId: string; email: string };
  student: { userId: string; email: string; studentId: string };
  /** Children linked to the seeded parent, in the order the guardian holds them. */
  childIds: string[];
  /** A student the seeded parent is NOT linked to, for the scoping checks. */
  unlinkedChildId: string | null;
  classId: string | null;
  /** A real class the seeded student is not in, for the promotion check. */
  promotionTarget: { id: string; name: string } | null;
};

let cached: SeededFixtures | null = null;

async function userByRole(schoolId: string, role: string) {
  const user = await prisma.user.findFirst({
    where: { schoolId, role: role as never, deletedAt: null },
    select: { id: true, email: true, firstName: true, lastName: true, preferredName: true },
    orderBy: { createdAt: "asc" },
  });
  if (!user) throw new Error(`The seed has no ${role} to test with. Run \`npm run prisma:seed\`.`);
  return {
    userId: user.id,
    email: user.email,
    name: user.preferredName?.trim() || [user.firstName, user.lastName].filter(Boolean).join(" "),
  };
}

export async function seededFixtures(): Promise<SeededFixtures> {
  if (cached) return cached;

  const school = await prisma.school.findFirst({ select: { id: true } });
  if (!school) throw new Error("The database has no school. Run `npm run prisma:seed`.");

  const term = await prisma.term.findFirst({
    where: { schoolId: school.id, isCurrent: true },
    select: { id: true },
  });

  const [principal, teacher, parent] = await Promise.all([
    userByRole(school.id, "PRINCIPAL"),
    userByRole(school.id, "TEACHER"),
    userByRole(school.id, "PARENT"),
  ]);

  const guardian = await prisma.guardian.findFirst({
    where: { userId: parent.userId },
    select: { students: { select: { studentId: true } } },
  });
  const childIds = guardian?.students.map((link) => link.studentId) ?? [];

  const studentRecord = await prisma.student.findFirst({
    where: { schoolId: school.id, userId: { not: null } },
    select: { id: true, userId: true },
  });
  if (!studentRecord?.userId) {
    throw new Error("The seed has no student with a portal account. Run `npm run prisma:seed`.");
  }
  const studentUser = await prisma.user.findUniqueOrThrow({
    where: { id: studentRecord.userId },
    select: { email: true },
  });

  const unlinked = await prisma.student.findFirst({
    where: { schoolId: school.id, id: { notIn: childIds.length ? childIds : ["none"] } },
    select: { id: true },
  });

  const classRoom = await prisma.classRoom.findFirst({
    where: { schoolId: school.id },
    select: { id: true },
  });

  // A promotion only moves a child into a class that exists, so the target has
  // to be a real one — and not the one they are already in.
  const currentClassId = (
    await prisma.student.findUnique({
      where: { id: studentRecord.id },
      select: { currentClassId: true },
    })
  )?.currentClassId;
  const promotionTarget = await prisma.classRoom.findFirst({
    where: { schoolId: school.id, id: { not: currentClassId ?? "none" } },
    select: { id: true, name: true },
  });

  cached = {
    schoolId: school.id,
    termId: term?.id ?? null,
    principal,
    teacher,
    parent,
    student: { ...studentUser, userId: studentRecord.userId, studentId: studentRecord.id },
    childIds,
    unlinkedChildId: unlinked?.id ?? null,
    classId: classRoom?.id ?? null,
    promotionTarget,
  };
  return cached;
}

/** A session payload for one of the seeded accounts. */
export function sessionFor(
  who: { userId: string; email: string },
  schoolId: string,
  role: string,
) {
  return {
    userId: who.userId,
    schoolId,
    role: role as never,
    email: who.email,
    name: who.email.split("@")[0]!,
    csrfToken: "test",
    iat: 0,
    exp: 9_999_999_999,
  };
}
