import type { SchoolCategory } from "@prisma/client";

import { nigerianTermGradeBands } from "../../../../src/lib/domain/grading";
import { nigerianSubjectDefaults } from "../../../../src/lib/nigerian-subjects";
import { nigeriaClassOptions } from "../../../../src/lib/school-options";

/**
 * What a school is given on day one, as data: the ladder of classes built from the levels it says it operates, the
 * subjects its sections teach, the assessment components, and the grading scale. Nigeria has its own curriculum
 * catalogue; every other country starts from a plain international set that the school edits in School Configuration —
 * nobody is made to pretend to be Nigerian.
 */

export type Section = "CRECHE" | "NURSERY" | "PRIMARY" | "JUNIOR_SECONDARY" | "SENIOR_SECONDARY";
export type Rung = { name: string; section: Section | null };

export const CATEGORY_OF: Record<Section, SchoolCategory> = { CRECHE: "NURSERY", NURSERY: "NURSERY", PRIMARY: "PRIMARY", JUNIOR_SECONDARY: "SECONDARY", SENIOR_SECONDARY: "SECONDARY" };

const rungs = (section: Section, ...names: string[]): Rung[] => names.map((name) => ({ name, section }));

/** The chips on the signup form, and the classes each one stands for. */
export const LADDERS: Record<string, Rung[]> = {
  "Crèche / Daycare": rungs("CRECHE", "Crèche"),
  "Nursery / Pre-school": rungs("NURSERY", "Nursery 1", "Nursery 2"),
  Kindergarten: rungs("NURSERY", "KG 1", "KG 2"),
  "Primary / Elementary": rungs("PRIMARY", "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"),
  "Middle School": rungs("JUNIOR_SECONDARY", "Grade 6", "Grade 7", "Grade 8"),
  "Junior Secondary": rungs("JUNIOR_SECONDARY", "JSS 1", "JSS 2", "JSS 3"),
  "Senior Secondary": rungs("SENIOR_SECONDARY", "SSS 1", "SSS 2", "SSS 3"),
  "High School": rungs("SENIOR_SECONDARY", "Grade 9", "Grade 10", "Grade 11", "Grade 12"),
  "Sixth Form / A-Level": rungs("SENIOR_SECONDARY", "Year 12", "Year 13"),
  "Vocational / Technical": rungs("SENIOR_SECONDARY", "Vocational Year 1", "Vocational Year 2"),
  "Special Needs Unit": rungs("PRIMARY", "Special Needs Unit"),
};

/** The classes for what was chosen, then whatever was typed in the free-text box, each as exactly what was written. */
export function ladderFor(levels: string[]): Rung[] {
  const seen = new Set<string>();
  const out: Rung[] = [];
  for (const level of levels) {
    for (const rung of LADDERS[level] ?? [{ name: level.trim(), section: null }]) {
      const key = rung.name.toLowerCase();
      if (!rung.name || seen.has(key)) continue;
      seen.add(key);
      out.push(rung);
    }
  }
  return out;
}

export type SubjectSeed = { name: string; code: string; section: Section; isCore: boolean; isOptional: boolean; religionSpecific: boolean; levels: string[] | null };

/** "Primary 4" → "PRIMARY_4": the value the Nigerian subject catalogue uses to say which classes a subject is for. */
export const classValueOf = (name: string) => nigeriaClassOptions.find((option) => option.label.toLowerCase() === name.toLowerCase())?.value ?? null;

const GENERIC: Record<Section, string[]> = {
  CRECHE: ["Language Development", "Number Work", "Creative Play", "Physical Development"],
  NURSERY: ["Literacy", "Numeracy", "Science and Discovery", "Creative Arts", "Physical Development"],
  PRIMARY: ["English Language", "Mathematics", "Science", "Social Studies", "Information Technology", "Physical Education", "Art and Design", "Moral and Religious Education", "Music", "Second Language"],
  JUNIOR_SECONDARY: ["English Language", "Mathematics", "Integrated Science", "Social Studies", "Information Technology", "Physical Education", "Arts", "Second Language", "Religious Studies", "Business Basics"],
  SENIOR_SECONDARY: ["English Language", "Mathematics", "Biology", "Chemistry", "Physics", "Economics", "Geography", "History", "Information Technology", "Physical Education"],
};
const CORE = new Set(["English Language", "Mathematics", "Literacy", "Numeracy", "Language Development", "Number Work", "Science", "Integrated Science", "Social Studies"]);

export function subjectsFor(country: string, section: Section): SubjectSeed[] {
  if (country === "Nigeria") {
    return nigerianSubjectDefaults.filter((subject) => subject.section === section && !subject.tradeSubject).map((subject) => ({ name: subject.name, code: subject.code, section, isCore: subject.isCore, isOptional: Boolean(subject.isOptional), religionSpecific: Boolean(subject.religionSpecific), levels: subject.applicableClassLevels as string[] }));
  }
  return GENERIC[section].map((name, index) => ({ name, code: `${section.slice(0, 3)}${index + 1}`, section, isCore: CORE.has(name), isOptional: false, religionSpecific: false, levels: null }));
}

export const SECTIONS: Section[] = ["CRECHE", "NURSERY", "PRIMARY", "JUNIOR_SECONDARY", "SENIOR_SECONDARY"];

/** Six continuous-assessment components and a terminal examination: 60 and 40. */
export const COMPONENTS = [
  { name: "Assignment", code: "ASSIGNMENT", type: "ASSIGNMENT", weight: 10, maxScore: 10, order: 1 },
  { name: "Classwork", code: "CLASSWORK", type: "CLASSWORK", weight: 10, maxScore: 10, order: 2 },
  { name: "Test 1", code: "TEST_1", type: "TEST", weight: 10, maxScore: 10, order: 3 },
  { name: "Test 2", code: "TEST_2", type: "TEST", weight: 10, maxScore: 10, order: 4 },
  { name: "Project", code: "PROJECT", type: "PROJECT", weight: 10, maxScore: 10, order: 5 },
  { name: "Practical", code: "PRACTICAL", type: "PRACTICAL", weight: 10, maxScore: 10, order: 6 },
  { name: "Terminal Examination", code: "EXAM", type: "EXAMINATION", weight: 40, maxScore: 40, order: 7 },
] as const;

export const gradingFor = (country: string) => ({
  name: country === "Nigeria" ? "Nigerian termly A–F" : "Standard A–F percentage scale",
  description: country === "Nigeria" ? "The termly grading most Nigerian schools report on." : "A plain percentage scale. Change the bands in School Configuration to match your own.",
  passMark: 40,
  bands: nigerianTermGradeBands,
});

/* ───────────────────────── the calendar ───────────────────────── */

const day = (year: number, month: number, date: number) => new Date(Date.UTC(year, month, date));

/**
 * The school year the school is in today: September to July in three terms. From September to the middle of December
 * that is the First Term of a year that began this month; from January it is the year that began last September, and
 * the term is whichever one today falls in (or, in August, the one that has just ended).
 */
export function calendarFor(now = new Date()) {
  const month = now.getUTCMonth();
  const startYear = month >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const terms = [
    { name: "First Term", order: 1, startDate: day(startYear, 8, 1), endDate: day(startYear, 11, 15) },
    { name: "Second Term", order: 2, startDate: day(startYear + 1, 0, 8), endDate: day(startYear + 1, 3, 30) },
    { name: "Third Term", order: 3, startDate: day(startYear + 1, 4, 8), endDate: day(startYear + 1, 6, 31) },
  ];
  const started = terms.filter((term) => term.startDate <= now);
  const current = started.length ? started[started.length - 1] : terms[0];
  return { sessionName: `${startYear}/${startYear + 1}`, startDate: day(startYear, 8, 1), endDate: day(startYear + 1, 6, 31), terms, current };
}

/* ───────────────────────── the sample class ───────────────────────── */

const NIGERIAN_FIRST = ["Adaeze", "Chinedu", "Ifeoma", "Tunde", "Amina", "Emeka", "Funke", "Ibrahim", "Ngozi", "Seyi", "Hauwa", "Obinna", "Bisi", "Kelechi", "Zainab", "Damilola", "Chiamaka", "Yusuf", "Folake", "Uche", "Aisha", "Tobi", "Nneka", "Segun", "Halima", "Ebuka", "Titi", "Musa", "Ada", "Kunle"];
const NIGERIAN_LAST = ["Okafor", "Adeyemi", "Bello", "Nwosu", "Balogun", "Eze", "Abubakar", "Ogunleye", "Okeke", "Lawal", "Musa", "Chukwu", "Afolabi", "Ibrahim", "Obi", "Salami", "Okonkwo", "Yakubu", "Adebayo", "Nnamdi"];
const GENERAL_FIRST = ["Amara", "Daniel", "Maya", "Samuel", "Leila", "Joseph", "Sofia", "Kwame", "Zara", "Omar", "Grace", "Liam", "Nia", "Ethan", "Fatima", "Noah", "Aisha", "Lucas", "Imani", "Caleb", "Hana", "Isaac", "Layla", "Ryan", "Tara", "Victor", "Mia", "Andre", "Esther", "Kofi"];
const GENERAL_LAST = ["Mensah", "Khan", "Silva", "Okoye", "Ahmed", "Reyes", "Mwangi", "Nkosi", "Hassan", "Perera", "Ndlovu", "Costa", "Tembo", "Rahman", "Santos", "Abara", "Banda", "Ali", "Mokoena", "Cruz"];

export function sampleNames(country: string, count = 30) {
  const first = country === "Nigeria" ? NIGERIAN_FIRST : GENERAL_FIRST;
  const last = country === "Nigeria" ? NIGERIAN_LAST : GENERAL_LAST;
  return Array.from({ length: count }, (_, index) => ({ firstName: first[index % first.length], lastName: last[(index * 7 + 3) % last.length], gender: (index % 2 === 0 ? "FEMALE" : "MALE") as "FEMALE" | "MALE" }));
}

/** A repeatable stream of numbers: the same school always gets the same sample class. */
export function seeded(seed: string) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Weekdays from `from` to `to`, both included. */
export function schoolDays(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  for (let cursor = new Date(from); cursor <= to; cursor = new Date(cursor.getTime() + 86_400_000)) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) out.push(new Date(cursor));
  }
  return out;
}

/** The subjects a class of this name teaches: its own level's, once each, with the optional and faith-specific ones left for the school to add. */
export function offeredTo<T extends { name: string; isOptional: boolean; religionSpecific: boolean; applicableClassLevels: unknown }>(subjects: T[], className: string, limit = 12): T[] {
  const value = classValueOf(className);
  const seen = new Set<string>();
  const out: T[] = [];
  for (const subject of subjects) {
    if (subject.isOptional || subject.religionSpecific) continue;
    const levels = Array.isArray(subject.applicableClassLevels) ? (subject.applicableClassLevels as string[]) : null;
    if (value && levels && !levels.includes(value)) continue;
    if (seen.has(subject.name.toLowerCase())) continue;
    seen.add(subject.name.toLowerCase());
    out.push(subject);
    if (out.length >= limit) break;
  }
  return out;
}
