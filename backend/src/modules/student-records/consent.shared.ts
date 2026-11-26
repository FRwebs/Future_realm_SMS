import { prisma } from "../../../../src/lib/db/prisma";

/**
 * The consents a school needs are not a fixed list — they are a list it owns, and every coverage
 * figure on the Consent tab is counted against it. Until a school defines its own, these five.
 */
export type ConsentType = {
  code: string; name: string; short: string; who: string; required: boolean; covers: string; blocks: string;
  /** "child": answered separately for each child. "family": one answer from the guardian, whatever the number of children. */
  scope: "child" | "family";
  /** The basis on which the school holds the record at all: a parent cannot switch it off in the portal, and is pointed to the school. Every other consent can be withdrawn there as easily as it was given. */
  basis: boolean;
  /** The wording a guardian answered: the day the school last edited this consent, or "standard" for the built-in one. */
  version: string;
};

export const CONSENT_DEFAULTS: ConsentType[] = [
  { code: "core", name: "Core record processing", short: "Core", who: "Every guardian", required: true, covers: "Holding and processing the child's record", blocks: "Nothing can be published to this family", scope: "child", basis: true, version: "standard" },
  { code: "health", name: "Health and welfare", short: "Health", who: "Every guardian", required: true, covers: "Medical, dietary and sick-bay records", blocks: "No health note can be held", scope: "child", basis: false, version: "standard" },
  { code: "photo", name: "Photography and image use", short: "Photo", who: "Every guardian", required: false, covers: "Photographs, video and the website", blocks: "Excluded from every publication", scope: "child", basis: false, version: "standard" },
  { code: "third-party", name: "Result publication to third parties", short: "3rd party", who: "Exam candidates", required: false, covers: "WAEC, NECO, IGCSE and equivalents", blocks: "Entries cannot be forwarded", scope: "child", basis: false, version: "standard" },
  { code: "channels", name: "Notification channels", short: "Channels", who: "Every guardian", required: true, covers: "SMS, email and WhatsApp", blocks: "Only emergency broadcasts reach them", scope: "family", basis: false, version: "standard" }
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
      blocks: String(data.blocks ?? ""),
      // A school's own consent is answered per child unless it says otherwise; only notification channels belong to the guardian.
      scope: data.scope === "family" || (data.scope === undefined && (row.code ?? row.id) === "channels") ? "family" : "child",
      // Only the consent that lets the school hold the record at all is the school's to change; the school may mark another the same way.
      basis: data.basis === undefined ? (row.code ?? row.id) === "core" : Boolean(data.basis),
      version: row.updatedAt.toISOString().slice(0, 10)
    };
  });
}

/** The child a consent answer is about, or "" for one that belongs to the guardian. */
export const FAMILY_LEVEL = "";

export const answerKey = (guardianId: string, typeCode: string, studentId: string = FAMILY_LEVEL) => ({ guardianId_typeCode_studentId: { guardianId, typeCode, studentId } });

/**
 * What a family has said, folded to one answer for a consent that is asked per child: given only when every child has it,
 * withdrawn when any child's is, and otherwise not given. The school's register of families reads this; a child's own page
 * reads the child's row.
 */
export function familyAnswer(rows: Array<{ status: string }>, children: number): "GIVEN" | "WITHDRAWN" | "NOT_GIVEN" {
  if (rows.some((row) => row.status === "WITHDRAWN")) return "WITHDRAWN";
  return children > 0 && rows.filter((row) => row.status === "GIVEN").length >= children ? "GIVEN" : "NOT_GIVEN";
}
