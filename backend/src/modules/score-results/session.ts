import { prisma } from "../../../../src/lib/db/prisma";

import { gradeOf, loadBands, ordinal, rank, round2 } from "./scores.shared";

/**
 * How a session score is worked out from the terms inside it.
 *
 * Each term standing alone is a defensible answer and stays the default —
 * nothing is invented for a school that has not chosen. What was missing was
 * any way to say otherwise: a school that reports a session average, or reads
 * the final term as the verdict, had no way to express it, so the figure got
 * worked out by hand outside the system and could not be checked.
 */
export type SessionRule = "NONE" | "MEAN" | "FINAL_TERM" | "WEIGHTED";

export const SESSION_RULES: Array<{ value: SessionRule; label: string; detail: string }> = [
  { value: "NONE", label: "Each term stands alone", detail: "No session figure is produced. The report card shows the term and nothing else." },
  { value: "MEAN", label: "Average of the terms", detail: "The mean of every term the child has a score for, so far." },
  { value: "FINAL_TERM", label: "Final term only", detail: "The last term of the session is the session's result." },
  { value: "WEIGHTED", label: "Weighted by term", detail: "Each term carries its own weight, and the weights total 100." },
];

export type TermScore = { termId: string; termName: string; order: number; average: number | null };

/**
 * The session figure for one child.
 *
 * `partial` says whether every term in the session has been scored yet. A
 * running figure part-way through a year is useful — that is the whole point of
 * a cumulative column — but it is not the same number as the final one, and a
 * report card that cannot tell the two apart will eventually print the wrong
 * one as though it were settled.
 */
export function sessionAverage(
  rule: SessionRule,
  terms: TermScore[],
  weights: number[] = [],
): { average: number | null; partial: boolean; basis: string } {
  const ordered = [...terms].sort((a, b) => a.order - b.order);
  const scored = ordered.filter((term) => term.average !== null) as Array<TermScore & { average: number }>;
  const partial = scored.length < ordered.length;

  if (rule === "NONE" || scored.length === 0) {
    return { average: null, partial, basis: "Each term stands alone" };
  }

  if (rule === "FINAL_TERM") {
    const last = scored[scored.length - 1];
    // Only the last term of the session counts, so a figure taken before that
    // term is scored is not the session result — it is the latest term's.
    const isFinal = last.termId === ordered[ordered.length - 1].termId;
    return {
      average: round2(last.average),
      partial: !isFinal,
      basis: isFinal ? `${last.termName} only` : `${last.termName} so far — the final term is not scored yet`,
    };
  }

  if (rule === "WEIGHTED" && weights.length === ordered.length && weights.reduce((sum, w) => sum + w, 0) === 100) {
    // Re-weight across the terms actually scored, so a figure part-way through
    // the year is on the same scale as the final one rather than depressed by
    // the terms that have not happened.
    const used = ordered.map((term, index) => ({ term, weight: weights[index] })).filter((entry) => entry.term.average !== null);
    const weightSum = used.reduce((sum, entry) => sum + entry.weight, 0);
    if (weightSum === 0) return { average: null, partial, basis: "No scored term carries any weight" };
    const total = used.reduce((sum, entry) => sum + (entry.term.average as number) * entry.weight, 0);
    return {
      average: round2(total / weightSum),
      partial,
      basis: used.map((entry) => `${entry.term.termName} ${entry.weight}%`).join(" · "),
    };
  }

  const total = scored.reduce((sum, term) => sum + term.average, 0);
  return {
    average: round2(total / scored.length),
    partial,
    basis: `Average of ${scored.length} term${scored.length === 1 ? "" : "s"}`,
  };
}

/** The rule a school is on, with its weights. A school with no active scheme is on NONE. */
export async function sessionRuleFor(schoolId: string): Promise<{ rule: SessionRule; weights: number[]; cumulative: boolean }> {
  const scheme = await prisma.gradingScheme.findFirst({
    where: { schoolId, isActive: true },
    select: { sessionAggregation: true, termWeights: true, cumulativeDisplay: true },
    orderBy: { updatedAt: "desc" },
  });
  const rule = (scheme?.sessionAggregation ?? "NONE") as SessionRule;
  return {
    rule: SESSION_RULES.some((entry) => entry.value === rule) ? rule : "NONE",
    weights: scheme?.termWeights ?? [],
    cumulative: scheme?.cumulativeDisplay ?? false,
  };
}

export type SessionStanding = {
  studentId: string;
  name: string;
  adm: string | null;
  terms: TermScore[];
  average: number | null;
  partial: boolean;
  basis: string;
  grade: string | null;
  position: string | null;
};

/**
 * Every child in a class, with their term scores and the session figure that
 * follows from the school's own rule.
 *
 * Positions are worked out across the class on the session figure, not carried
 * over from any one term, because a position is only meaningful against the
 * same measure it ranks.
 */
export async function sessionStandings(schoolId: string, academicSessionId: string, classId: string): Promise<{
  rule: SessionRule;
  cumulative: boolean;
  terms: Array<{ id: string; name: string; order: number }>;
  students: SessionStanding[];
}> {
  const [{ rule, weights, cumulative }, bands, terms] = await Promise.all([
    sessionRuleFor(schoolId),
    loadBands(schoolId),
    prisma.term.findMany({ where: { schoolId, academicSessionId }, orderBy: { startDate: "asc" }, select: { id: true, name: true } }),
  ]);
  const termList = terms.map((term, index) => ({ id: term.id, name: term.name, order: index + 1 }));

  const students = await prisma.student.findMany({
    where: { schoolId, status: "ACTIVE", currentClassId: classId },
    select: { id: true, firstName: true, lastName: true, admissionNumber: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  // One read for every approved result in the session, rather than a query per
  // child per term. Only an approved sheet counts: a draft is a teacher's work
  // in progress, and a session figure built partly from drafts would move under
  // the reader without the reader knowing.
  const published = await prisma.resultSheet.findMany({
    where: { schoolId, classId, termId: { in: termList.map((term) => term.id) }, status: { in: ["APPROVED", "PUBLISHED"] } },
    select: { termId: true, studentId: true, averageScore: true },
  });
  const byStudentTerm = new Map<string, number>();
  for (const sheet of published) byStudentTerm.set(`${sheet.studentId}:${sheet.termId}`, sheet.averageScore);

  const rows: SessionStanding[] = students.map((student) => {
    const termScores: TermScore[] = termList.map((term) => ({
      termId: term.id,
      termName: term.name,
      order: term.order,
      average: byStudentTerm.get(`${student.id}:${term.id}`) ?? null,
    }));
    const { average, partial, basis } = sessionAverage(rule, termScores, weights);
    return {
      studentId: student.id,
      name: `${student.firstName} ${student.lastName}`,
      adm: student.admissionNumber,
      terms: termScores,
      average,
      partial,
      basis,
      grade: gradeOf(bands.bands, average)?.label ?? null,
      position: null,
    };
  });

  const ranks = rank(rows.filter((row) => row.average !== null).map((row) => ({ id: row.studentId, value: row.average as number })));
  for (const row of rows) {
    const position = ranks.get(row.studentId);
    row.position = position ? ordinal(position) : null;
  }

  return { rule, cumulative, terms: termList, students: rows };
}
