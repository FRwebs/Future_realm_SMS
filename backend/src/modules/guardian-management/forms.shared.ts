/**
 * Forms a school sends its families to answer: a trip, a leave, an agreement.
 *
 * A form is the school's own words and two answers (yes and no, each in the school's phrasing) with an optional question for words. It
 * goes to every family, or to the families of chosen classes, and each family answers once for all its children. Forms and answers are
 * kept as the school's own configuration — low-volume, per-school, and never read across schools — rather than as a table of their own.
 */
export const FORMS = "family-forms";
export const ANSWERS = "family-form-answers";

export const FORM_KINDS = ["Trip", "Leave", "Agreement", "Other"] as const;

export type FormData = {
  title: string;
  kind: (typeof FORM_KINDS)[number];
  /** Class ids the form goes to; empty means every family at the school. */
  classIds: string[];
  audience: string;
  due: string | null;
  /** What the school needs to say, as label / value / note lines. */
  facts: Array<[string, string, string?]>;
  /** A question the family answers in words, when the yes or no is not enough ("Who is collecting?"). */
  ask: string | null;
  yes: string;
  no: string;
  status: "OPEN" | "CLOSED";
  createdAt: string;
  createdBy: string;
};

export type Answer = { decision: "YES" | "NO"; text: string; at: string; by: string };

/** The code an answer is filed under: one per family per form. */
export const answerCode = (formId: string, guardianId: string) => `${formId}:${guardianId}`;

/** Whether a form reaches a family: every family, or one with a child in a chosen class. */
export const reaches = (form: Pick<FormData, "classIds">, childClassIds: Array<string | null>) =>
  form.classIds.length === 0 || childClassIds.some((id) => id !== null && form.classIds.includes(id));

/** "Date: Friday 6 November\nWhere: Zuma Rock" → [["Date","Friday 6 November"],["Where","Zuma Rock"]]; a paragraph with no labels is one line. */
export function factsFrom(text: string): Array<[string, string, string?]> {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const labelled = lines.every((line) => /^[^:]{1,40}:\s*\S/.test(line));
  return labelled && lines.length > 0
    ? lines.map((line) => { const at = line.indexOf(":"); return [line.slice(0, at).trim(), line.slice(at + 1).trim()] as [string, string]; })
    : [["Details", lines.join(" ")]];
}
