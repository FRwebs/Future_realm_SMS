import { prisma } from "../../../src/lib/db/prisma";

const COUNSELLORS = ["GUIDANCE_COUNSELOR", "GUIDANCE_COUNSELLOR"] as const;
const PRINCIPALS = ["PRINCIPAL", "HEAD_TEACHER"] as const;

/**
 * Who holds a safeguarding concern: the school's counsellor — the safeguarding lead — and the Principal. Nobody else reads one, and a
 * school with no counsellor still has the Principal, so a concern never lands on nobody. One list, so the staff who are told, the staff who
 * may read, and the staff a parent is told it has reached can never disagree.
 */
export async function safeguardingLeads(schoolId: string): Promise<string[]> {
  const people = await prisma.user.findMany({
    where: { schoolId, role: { in: [...COUNSELLORS, ...PRINCIPALS] }, isActive: true, deletedAt: null },
    select: { id: true },
  });
  return people.map((person) => person.id);
}
