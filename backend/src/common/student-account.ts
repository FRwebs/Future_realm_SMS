import { prisma } from "../../../src/lib/db/prisma";

/** The consent a guardian gives for a child to have their own sign-in. */
export const STUDENT_ACCOUNT_CONSENT = "student-account";

const ADULT_AGE = 18;

export const STUDENT_ACCOUNT_REFUSAL =
  "A parent or guardian has not yet agreed to your student account, so you cannot sign in. Ask them to open Forms and consents in the parent portal, or ask your school to record it.";

export function isUnderage(dateOfBirth: Date, now = new Date()): boolean {
  const birthday = new Date(Date.UTC(dateOfBirth.getUTCFullYear() + ADULT_AGE, dateOfBirth.getUTCMonth(), dateOfBirth.getUTCDate()));
  return birthday.getTime() > now.getTime();
}

/**
 * Whether a student's own account may be used. A student under 18 needs a guardian's consent for it, given for that
 * child; one guardian saying no ends it, whoever else said yes. A student who is 18 or over answers for themselves.
 */
export async function studentAccountAllowed(student: { id: string; dateOfBirth: Date }, now = new Date()): Promise<boolean> {
  if (!isUnderage(student.dateOfBirth, now)) return true;
  const links = await prisma.studentGuardian.findMany({ where: { studentId: student.id }, select: { guardianId: true } });
  if (!links.length) return false;
  const rows = await prisma.familyConsent.findMany({
    where: { studentId: student.id, typeCode: STUDENT_ACCOUNT_CONSENT, guardianId: { in: links.map((link) => link.guardianId) } },
    select: { status: true },
  });
  return rows.some((row) => row.status === "GIVEN") && !rows.some((row) => row.status === "WITHDRAWN");
}
