import { prisma } from "../../../src/lib/db/prisma";

/**
 * When a family or a student may see a mark.
 *
 * Approving a score sheet is the school's own review; it is not a release. A mark reaches a parent or a student only once the school
 * has said so: the assessment's release date has come, or the term's report card has been published — or the school has chosen to show
 * marks as soon as a sheet is approved (School Configuration → Policies, off unless chosen). Both portals ask here, so they cannot
 * disagree about what has been released.
 */

export const EARLY_SCORES_CODE = "early_assessment_scores";
const EARLY_MODE_PREFIX = "Show as soon as";

export type ReleaseCheck = {
  /** The release date set for this assessment and this class, or null where the school set none. */
  releaseAt: Date | number | null | undefined;
  /** The school shows approved marks before any release date. */
  early: boolean;
  /** The child's report card for this term has been published. */
  cardPublished: boolean;
  now: number;
};

export function isScoreReleased({ releaseAt, early, cardPublished, now }: ReleaseCheck): boolean {
  if (cardPublished) return true;
  if (releaseAt === null || releaseAt === undefined) return early;
  return (releaseAt instanceof Date ? releaseAt.getTime() : releaseAt) <= now;
}

/** The schools, among those asked about, that show approved marks before their release date. */
export async function schoolsShowingScoresEarly(schoolIds: string[]): Promise<Set<string>> {
  if (!schoolIds.length) return new Set();
  const rows = await prisma.configurationItem.findMany({
    where: { schoolId: { in: schoolIds }, resource: "school-policies", code: EARLY_SCORES_CODE, deletedAt: null },
    select: { schoolId: true, data: true },
  });
  return new Set(
    rows
      .filter((row) => String((row.data as { values?: { mode?: unknown } } | null)?.values?.mode ?? "").startsWith(EARLY_MODE_PREFIX))
      .map((row) => row.schoolId),
  );
}
