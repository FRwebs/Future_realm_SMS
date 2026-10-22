import { prisma } from "../../../../src/lib/db/prisma";

/**
 * The mass-communication threshold, read from the same ConfigurationItem row School Configuration → Policies writes: one record shown
 * in two places. A send to more families than this waits for the Principal's decision.
 */
export async function ConfigStoreThreshold(schoolId: string): Promise<number> {
  const row = await prisma.configurationItem.findFirst({ where: { schoolId, resource: "school-policies", code: "mass_communication_threshold", deletedAt: null }, select: { data: true } });
  const mode = (row?.data as { values?: { mode?: string } } | null)?.values?.mode;
  if (mode === "Never needs approval") return Number.POSITIVE_INFINITY;
  const parsed = mode ? Number(mode.replace(/\D+/g, "")) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 150;
}
