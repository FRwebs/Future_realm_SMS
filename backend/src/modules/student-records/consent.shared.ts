import { prisma } from "../../../../src/lib/db/prisma";

/**
 * The consents a school needs are not a fixed list — they are a list it owns, and every coverage
 * figure on the Consent tab is counted against it. Until a school defines its own, these five.
 */
export type ConsentType = { code: string; name: string; short: string; who: string; required: boolean; covers: string; blocks: string };

export const CONSENT_DEFAULTS: ConsentType[] = [
  { code: "core", name: "Core record processing", short: "Core", who: "Every guardian", required: true, covers: "Holding and processing the child's record", blocks: "Nothing can be published to this family" },
  { code: "health", name: "Health and welfare", short: "Health", who: "Every guardian", required: true, covers: "Medical, dietary and sick-bay records", blocks: "No health note can be held" },
  { code: "photo", name: "Photography and image use", short: "Photo", who: "Every guardian", required: false, covers: "Photographs, video and the website", blocks: "Excluded from every publication" },
  { code: "third-party", name: "Result publication to third parties", short: "3rd party", who: "Exam candidates", required: false, covers: "WAEC, NECO, IGCSE and equivalents", blocks: "Entries cannot be forwarded" },
  { code: "channels", name: "Notification channels", short: "Channels", who: "Every guardian", required: true, covers: "SMS, email and WhatsApp", blocks: "Only emergency broadcasts reach them" }
];

export async function loadConsentTypes(schoolId: string): Promise<ConsentType[]> {
  const rows = await prisma.configurationItem.findMany({ where: { schoolId, resource: "consent-types", deletedAt: null }, orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] });
  if (!rows.length) return CONSENT_DEFAULTS;
  return rows.map((row) => {
    const data = (row.data ?? {}) as Record<string, unknown>;
    return {
      code: row.code ?? row.id,
      name: row.name,
      short: String(data.short ?? row.name.split(/\s+/)[0]),
      who: String(data.who ?? "Every guardian"),
      required: Boolean(data.required),
      covers: String(data.covers ?? ""),
      blocks: String(data.blocks ?? "")
    };
  });
}
