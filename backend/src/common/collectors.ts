import { prisma } from "../../../src/lib/db/prisma";

/**
 * Who may collect a child, read the same way for the school, the parent and the student.
 *
 * Two kinds of people are on one list: the guardians the school has marked as able to collect, and the named adults it has
 * authorised. A named adult added for one day drops off the list when the day is over. A guardian under a safeguarding
 * restriction is never on it.
 */
export type Collector = {
  id: string; name: string; relation: string; phone: string | null; hasPhoto: boolean; until: string | null;
  kind: "guardian" | "named"; guardianId: string | null;
};

const day = (value: Date) => value.toISOString().slice(0, 10);

export async function collectorsFor(studentIds: string[], now = new Date()): Promise<Map<string, Collector[]>> {
  const out = new Map<string, Collector[]>(studentIds.map((id) => [id, []]));
  if (!studentIds.length) return out;
  const [links, named] = await Promise.all([
    prisma.studentGuardian.findMany({
      where: { studentId: { in: studentIds }, canCollect: true, guardian: { safeguardingRestrictedAt: null, mergedIntoId: null } },
      include: { guardian: { select: { id: true, firstName: true, lastName: true, relationship: true, phone: true } } },
      orderBy: [{ isPrimary: "desc" }, { linkedAt: "asc" }],
    }),
    prisma.authorisedCollector.findMany({ where: { studentId: { in: studentIds }, OR: [{ until: null }, { until: { gte: now } }] }, orderBy: { createdAt: "asc" } }),
  ]);
  for (const link of links) {
    out.get(link.studentId)?.push({
      id: `g-${link.guardian.id}`, name: `${link.guardian.firstName} ${link.guardian.lastName}`, relation: String(link.relation || link.guardian.relationship || "Guardian"),
      phone: link.guardian.phone, hasPhoto: false, until: null, kind: "guardian", guardianId: link.guardian.id,
    });
  }
  for (const row of named) {
    if (!row.studentId) continue;
    out.get(row.studentId)?.push({ id: row.id, name: row.name, relation: row.relation, phone: row.phone, hasPhoto: Boolean(row.photoFile), until: row.until ? day(row.until) : null, kind: "named", guardianId: row.guardianId });
  }
  return out;
}

/** What a family asks for when it names someone new: for one day (`date`), or for good (`permanent`). */
export type CollectorRequest = { name?: string; relation?: string; phone?: string; date?: string; permanent?: boolean; photo?: string };

/** Until when an accepted request lets the person collect: the end of the named day, never, or — with no day given — tomorrow. */
export function collectorUntil(request: CollectorRequest, now = new Date()): Date | null {
  if (request.permanent) return null;
  return request.date ? new Date(`${request.date}T23:59:59.999Z`) : new Date(now.getTime() + 86_400_000);
}

/** Puts an accepted person on the child's list. A person already on it (same number) is kept, not added twice. */
export async function admitCollector(input: { schoolId: string; studentId: string; guardianId: string; request: CollectorRequest; addedById: string }) {
  const { request } = input;
  if (!request.name || !request.phone) return { added: false as const, reason: "This request does not say who will collect, so there is nobody to add." };
  const same = await prisma.authorisedCollector.findFirst({ where: { studentId: input.studentId, phone: request.phone } });
  const until = collectorUntil(request);
  if (same) {
    // A permanent request makes an earlier one-day entry permanent; it never shortens one.
    if (same.until && (until === null || until > same.until)) await prisma.authorisedCollector.update({ where: { id: same.id }, data: { until, photoFile: same.photoFile ?? request.photo ?? null } });
    return { added: true as const, until, already: true };
  }
  await prisma.authorisedCollector.create({
    data: { schoolId: input.schoolId, studentId: input.studentId, guardianId: input.guardianId, name: request.name, relation: request.relation || "Named by the family", phone: request.phone, photoFile: request.photo ?? null, until, addedById: input.addedById },
  });
  return { added: true as const, until, already: false };
}
