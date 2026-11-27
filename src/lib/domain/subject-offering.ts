import { normalizeNigeriaClassValue } from "@/lib/school-options";

/**
 * Which classes a subject in the catalogue is for.
 *
 * A school keeps several subjects under one name — English Studies for Lower Primary, for Upper Primary, for Junior Secondary — and
 * each says which class levels it is for. A subject is offered to a class when it names that level; one that names no levels is for
 * its section; one with neither is for anyone. Attaching a subject anywhere else is attaching the wrong subject.
 */
export type SubjectOffer = { section?: string | null; applicableClassLevels?: unknown };
export type ClassLevelRef = { name: string; schoolSection?: string | null };

const levelsOf = (subject: SubjectOffer): string[] =>
  Array.isArray(subject.applicableClassLevels) ? (subject.applicableClassLevels as unknown[]).filter((item): item is string => typeof item === "string") : [];

export function offeredAtLevel(subject: SubjectOffer, level: ClassLevelRef | null | undefined): boolean {
  if (!level) return true;
  const levels = levelsOf(subject);
  if (levels.length) {
    const code = normalizeNigeriaClassValue(level.name);
    // A level the school named in its own way cannot be matched to the standard list: it is not refused for that.
    return !code || levels.includes(code);
  }
  if (subject.section && level.schoolSection && subject.section !== level.schoolSection) return false;
  return true;
}

const PREFIX: Record<string, string> = { PRIMARY: "Primary", NURSERY: "Nursery", JSS: "JSS", SSS: "SSS", KG: "KG", PRE: "Pre" };
const words = (code: string) => code.toLowerCase().split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

/** "Primary 1–3", "JSS 1–3", "Pre Nursery, Nursery 1–2": the levels a subject is for, the way a person would say them. */
export function describeOffer(subject: SubjectOffer): string {
  const groups = new Map<string, number[]>();
  const solo: string[] = [];
  for (const code of levelsOf(subject)) {
    const match = /^(.*)_(\d+)$/.exec(code);
    if (match) groups.set(match[1]!, [...(groups.get(match[1]!) ?? []), Number(match[2])]);
    else solo.push(words(code));
  }
  const spans = [...groups.entries()].map(([prefix, numbers]) => {
    const sorted = [...new Set(numbers)].sort((a, b) => a - b);
    const label = PREFIX[prefix] ?? words(prefix);
    const contiguous = sorted.every((value, index) => index === 0 || value === sorted[index - 1]! + 1);
    if (sorted.length === 1) return `${label} ${sorted[0]}`;
    return contiguous ? `${label} ${sorted[0]}–${sorted[sorted.length - 1]}` : `${label} ${sorted.join(", ")}`;
  });
  const all = [...solo, ...spans];
  if (all.length) return all.join(", ");
  return subject.section ? words(String(subject.section)) : "";
}
