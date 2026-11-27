/**
 * What a phone number and an email address must look like before the school keeps them.
 *
 * A number that is wrong by one digit silences a family; an address with no domain never receives a receipt. So every place a person types
 * one — enrolment, a guardian's contact, a staff record, the school's own profile, a parent's change request — asks this one rule, in one
 * set of words, and the rule reads the country's format from configuration (Country Settings › phone pattern) when the school has one.
 */

export type PhoneKind = "mobile" | "line";
export type PhoneRule = {
  /** The country's pattern from Country Settings, as a regular expression source. Without one the Nigerian mobile format is the default. */
  pattern?: string | null;
  /** A mobile is what messages and sign-in reach; a line may also be a landline (the school's own office number). */
  kind?: PhoneKind;
  /** The country's name, so a message can say "not a Nigerian mobile number" in the school's own country. */
  country?: string | null;
};

const SEPARATORS = /[\s().-]/g;

/** A Nigerian mobile number in any of the ways people write one: 0803 123 4567, 234 803 123 4567 or +234 803 123 4567. */
export const NIGERIAN_MOBILE = /^(?:\+?234|0)[789][01]\d{8}$/;

const adjective = (country?: string | null) => (!country || country === "Nigeria" ? "Nigerian" : country);

/** In the words a person typing can act on, or null when the number is fine. An empty value is not this rule's business: whether it is required is. */
export function phoneProblem(value: string | null | undefined, rule: PhoneRule = {}): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/[^\d\s().+-]/.test(raw)) return "A phone number has digits only — no letters or other marks.";
  const plain = raw.replace(SEPARATORS, "");
  if (plain.indexOf("+") > 0 || (plain.match(/\+/g)?.length ?? 0) > 1) return "The + sign goes only at the very start, as in +234.";
  const digits = plain.replace(/\D/g, "");
  if (digits.length < 7) return `That number has only ${digits.length} digit${digits.length === 1 ? "" : "s"} — give it in full.`;
  if (digits.length > 15) return "That number has too many digits — a phone number has at most 15.";

  const kind = rule.kind ?? "mobile";
  let pattern: RegExp | null = null;
  if (rule.pattern) {
    try { pattern = new RegExp(rule.pattern); } catch { pattern = null; }
  }
  if (pattern) {
    if (pattern.test(plain)) return null;
    // A landline is allowed on a line field whatever the country's mobile pattern says, as long as it is a plausible number.
    if (kind === "line") return null;
    return `That is not a valid ${adjective(rule.country)} mobile number — check the digits.`;
  }
  if (rule.country && rule.country !== "Nigeria") return null; // another country with no pattern configured: shape is all that can be checked
  if (kind === "line") return null;
  if (NIGERIAN_MOBILE.test(plain)) return null;
  return "That is not a valid Nigerian mobile number — write it like 0803 123 4567 or +234 803 123 4567.";
}

const EMAIL = /^[^\s@,;<>()[\]\\]+@[^\s@,;<>()[\]\\]+\.[^\s@,;<>()[\]\\.]{2,}$/;

/** Null when the address has a name, an @ and a domain with a dot. */
export function emailProblem(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.length > 254 || !EMAIL.test(raw) || raw.includes("..") || raw.startsWith(".") || raw.split("@")[0]!.endsWith(".")) {
    return "That email address is not complete — it needs a name, an @ and a domain, like name@school.com.";
  }
  return null;
}
