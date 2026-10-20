import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";

/**
 * "Your last 3 passwords cannot be reused." The three most recent are kept as hashes; the one in force counts as one of them.
 */
export const PASSWORD_MEMORY = 3;

export async function assertPasswordNotReused(userId: string, candidate: string, currentHash?: string | null) {
  const recent = await prisma.passwordHistory.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: PASSWORD_MEMORY, select: { hash: true } });
  const hashes = new Set([...(currentHash ? [currentHash] : []), ...recent.map((row) => row.hash)]);
  for (const hash of hashes) {
    if (verifyPassword(candidate, hash)) throw new Error(`Choose a password you have not used before. Your last ${PASSWORD_MEMORY} cannot be reused.`);
  }
}

/** Keep the hash that has just been set, and forget anything older than the memory. */
export async function rememberPassword(userId: string, hash: string) {
  await prisma.passwordHistory.create({ data: { userId, hash } });
  const stale = await prisma.passwordHistory.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip: PASSWORD_MEMORY, select: { id: true } });
  if (stale.length) await prisma.passwordHistory.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });
}

export { hashPassword };
