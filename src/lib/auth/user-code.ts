import { randomInt } from "crypto";

import { prisma } from "@/lib/db/prisma";

/**
 * The permanent sign-in ID printed on the "you're done" screen and in the welcome email.
 * A school administrator gets six digits; a teacher who signed up alone gets TC- and four digits (five if the
 * four-digit space ever fills). The ID is never reissued, and never reused after an account is removed.
 */
export type UserCodeKind = "ADMIN" | "TEACHER";

const LOOKS_LIKE_ID = /^(\d{6}|TC-\d{4,6})$/i;

export const looksLikeUserCode = (value: string) => LOOKS_LIKE_ID.test(value.trim());

export const normaliseUserCode = (value: string) => value.trim().toUpperCase();

export async function issueUserCode(kind: UserCodeKind): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const code = kind === "ADMIN" ? String(randomInt(100_000, 1_000_000)) : `TC-${randomInt(attempt < 20 ? 1_000 : 10_000, attempt < 20 ? 10_000 : 100_000)}`;
    const taken = await prisma.user.findUnique({ where: { userCode: code }, select: { id: true } });
    if (!taken) return code;
  }
  throw new Error("Could not issue a unique User ID. Try again.");
}
