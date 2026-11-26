/**
 * A school's admission numbers: a prefix of its own, the year, and a running number — `LA/26/0001`.
 *
 * The prefix is the school's choice. Until it makes one, it is read from the school's own name, so no school is numbered with
 * another's letters. It is never taken from the student numbers a school already holds when it has said what it wants.
 */
const LETTERS = /[A-Za-z]/g;

/** Letters and digits only, upper case, two to six characters. */
export const ADMISSION_PREFIX = /^[A-Z0-9]{2,6}$/;

export function derivedAdmissionPrefix(school: { shortName?: string | null; name?: string | null }): string {
  for (const source of [school.shortName, school.name]) {
    const words = String(source ?? "").split(/[\s\-–/&]+/).map((word) => (word.match(LETTERS) ?? []).join("")).filter(Boolean);
    if (!words.length) continue;
    // Two or more words: their initials (Living Academy → LA, Greenfield College Ibadan → GCI). One word: its first three letters.
    const prefix = (words.length > 1 ? words.map((word) => word[0]).join("") : words[0]!.slice(0, 3)).toUpperCase().slice(0, 4);
    if (prefix.length >= 2) return prefix;
  }
  return "ADM";
}

/** The prefix a school numbers with: its own choice, or the one its name gives. */
export function admissionPrefixFor(school: { admissionPrefix?: string | null; shortName?: string | null; name?: string | null }): string {
  const own = String(school.admissionPrefix ?? "").trim().toUpperCase();
  return ADMISSION_PREFIX.test(own) ? own : derivedAdmissionPrefix(school);
}

export const formatAdmission = (prefix: string, year: number, sequence: number) => `${prefix}/${String(year).slice(-2)}/${String(sequence).padStart(4, "0")}`;
