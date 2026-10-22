/**
 * What a school message is made of, in one place so the composer that shows the cost and the server that charges it agree.
 *
 * A message may carry merge fields — {Guardian}, {Child}, {Class} — that resolve against each family's own record. A field the
 * school does not know is refused before anything is sent, rather than going out as literal braces in a parent's phone.
 */

export const MERGE_FIELDS = ["Guardian", "Child", "Class"] as const;
export type MergeField = (typeof MERGE_FIELDS)[number];
export type MergeContext = Record<MergeField, string>;

const FIELD = /\{\s*([A-Za-z]+)\s*\}/g;

/** Merge fields written in the text that this school does not have. */
export function unknownFields(body: string): string[] {
  const known = new Set<string>(MERGE_FIELDS.map((field) => field.toLowerCase()));
  const found: string[] = [];
  for (const match of body.matchAll(FIELD)) {
    const name = match[1] as string;
    if (!known.has(name.toLowerCase()) && !found.includes(name)) found.push(name);
  }
  return found;
}

/** The text one family reads: every known field replaced with their own words. */
export function mergeBody(body: string, context: MergeContext): string {
  return body.replace(FIELD, (whole, name: string) => {
    const field = MERGE_FIELDS.find((entry) => entry.toLowerCase() === name.toLowerCase());
    return field ? context[field] : whole;
  });
}

/** "Ada", "Ada and Chidi", "Ada, Chidi and Ngozi". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * How many credits an SMS of this text costs one phone. One credit up to 160 characters; beyond that a message is cut into parts of
 * 153 (the rest of each part is the carrier's joining header), and each part is a credit.
 */
export function smsSegments(text: string): number {
  const length = [...text].length;
  if (length === 0) return 0;
  return length <= 160 ? 1 : Math.ceil(length / 153);
}

export type Channel = "IN_APP" | "SMS" | "EMAIL";
export type Contact = { phone: string | null; email: string | null; canSms: boolean; canEmail: boolean };

/** A Nigerian mobile number, in any of the ways people write one. */
export function normalPhone(value: string | null | undefined): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.startsWith("234") ? `0${digits.slice(3)}` : digits;
}
export const validMobile = (value: string | null | undefined): boolean => /^0[789][01]\d{8}$/.test(normalPhone(value));

/** Whether a message on this channel can reach this family, and if it cannot, why — in words the sender can act on. */
export function reachOf(channel: Channel, contact: Contact): { ok: true } | { ok: false; reason: string } {
  if (channel === "IN_APP") return { ok: true };
  if (channel === "SMS") {
    if (!contact.phone?.trim() || contact.phone.trim() === "—") return { ok: false, reason: "No phone number on file — nothing was sent." };
    if (!validMobile(contact.phone)) return { ok: false, reason: "The number on file is not a Nigerian mobile number — nothing was sent." };
    if (!contact.canSms) return { ok: false, reason: "This family has asked not to be sent SMS — nothing was sent." };
    return { ok: true };
  }
  if (!contact.email?.trim()) return { ok: false, reason: "No email address on file — nothing was sent." };
  if (!contact.canEmail) return { ok: false, reason: "This family has asked not to be sent email — nothing was sent." };
  return { ok: true };
}
