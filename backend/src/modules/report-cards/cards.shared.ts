import { prisma } from "../../../../src/lib/db/prisma";
import { ConfigStore } from "../staff-access/staff-access.shared";
import { type ArmData, studentResults } from "../score-results/arm";

/**
 * What every Report Cards tab reads the same way: where a child's card stands (scores, form master's
 * remark, the Principal's review, published), what the school's own publishing rules are, and the words
 * a remark can start from. A card is generated for a child but published for an arm, so readiness is
 * worked out per child and then folded up.
 */

export type CardState = "Published" | "Withheld" | "Blocked" | "Remark owed" | "Awaiting review" | "Ready";

export type Policy = {
  /** Whether a child with an unpaid balance is left out of a publish. Off unless the school turns it on. */
  withholdForDebt: boolean;
  /** How long a publish can be taken back. */
  reversibleMinutes: number;
  /** The shortest remark worth putting on a card. */
  minRemark: number;
};

export const POLICY_DEFAULTS: Policy = { withholdForDebt: false, reversibleMinutes: 60, minRemark: 15 };

export async function loadPolicy(schoolId: string): Promise<Policy> {
  const row = await new ConfigStore(schoolId, "report-card-policy").get<Partial<Policy>>("POLICY");
  return { ...POLICY_DEFAULTS, ...(row?.data ?? {}) };
}

export const TONES = ["Encouraging", "Plain", "Firm"];
export const REVIEW_FLAGS = ["Recommend a guardian meeting", "Recommend the subject clinic", "Recommend counselling", "Commend to the staff room"];

/** The band a remark is written for. Real bands belong to the grading scheme; these are about what to say. */
export function bandOf(average: number | null): string {
  if (average === null) return "Not scored";
  return average >= 75 ? "Excellent" : average >= 70 ? "Very good" : average >= 65 ? "Good" : average >= 50 ? "Fair" : average >= 40 ? "Weak" : "Of concern";
}
export const BANDS = ["Excellent", "Very good", "Good", "Fair", "Weak", "Of concern"];

export const toneFor = (average: number | null) => (average === null ? "Plain" : average >= 70 ? "Encouraging" : average >= 50 ? "Plain" : "Firm");

/** A sentence to start from, never to leave as it is. */
export function suggestion(average: number | null, first: string): string {
  if (average === null) return `${first} has no result yet, so nothing can be said about the term.`;
  if (average >= 75) return `An excellent result. ${first} has earned it, and the school is proud of the standard set this term.`;
  if (average >= 65) return `A good, steady term. ${first} should keep this up and push the two weaker subjects.`;
  if (average >= 50) return `${first} is capable of more than this. I expect to see a clear improvement next term.`;
  return `This result is below what ${first} can do. The school will put support in place, and I would like to meet the guardian.`;
}

export type RemarkRow = { author: string; text: string; tone: string | null; flags: string[]; state: string; authorId: string; onBehalf: boolean; submittedAt: Date | null; updatedAt: Date };

/**
 * What a remark's state is. Older results carry the sentence on the result sheet and nothing else; those are
 * read as submitted, because that is what they are, with no author recorded.
 */
export function remarkState(row: RemarkRow | undefined, legacyText: string | null | undefined): { state: "Submitted" | "Draft" | "Not written"; text: string; row?: RemarkRow } {
  if (row) return { state: row.state === "SUBMITTED" ? "Submitted" : "Draft", text: row.text, row };
  const legacy = (legacyText ?? "").trim();
  return legacy ? { state: "Submitted", text: legacy } : { state: "Not written", text: "" };
}

export type ChildCard = {
  id: string;
  name: string;
  adm: string;
  average: number | null;
  grade: string | null;
  pos: number | null;
  scores: boolean;
  blockedBy: string[];
  remark: "Submitted" | "Draft" | "Not written";
  review: boolean;
  published: boolean;
  withheld: boolean;
  owes: boolean;
  state: CardState;
  resultSheetId: string | null;
  cardId: string | null;
  revision: number;
};

/** Every child of an arm, with where their card stands. `published` is read from the result sheet, which is what a family sees. */
export async function childCards(schoolId: string, termId: string, arm: ArmData, owing?: Set<string>, policy?: Policy): Promise<ChildCard[]> {
  const ids = arm.students.map((student) => student.id);
  const [sheets, remarks, cards] = await Promise.all([
    prisma.resultSheet.findMany({ where: { schoolId, termId, studentId: { in: ids } }, select: { id: true, studentId: true, status: true, publishedAt: true, teacherComment: true, principalComment: true } }),
    prisma.reportRemark.findMany({ where: { schoolId, termId, studentId: { in: ids } } }),
    prisma.reportCard.findMany({ where: { schoolId, termId, studentId: { in: ids } }, select: { id: true, studentId: true, status: true, revision: true, withheldAt: true, publishedAt: true } })
  ]);
  const sheetOf = new Map(sheets.map((sheet) => [sheet.studentId, sheet]));
  const cardOf = new Map(cards.map((card) => [card.studentId, card]));
  const mine = (studentId: string, author: string) => remarks.find((row) => row.studentId === studentId && row.author === author);
  const results = studentResults(arm, true);
  return results.map((result): ChildCard => {
    const sheet = sheetOf.get(result.id);
    const card = cardOf.get(result.id);
    const fm = remarkState(mine(result.id, "FORM_MASTER"), sheet?.teacherComment);
    const pr = remarkState(mine(result.id, "PRINCIPAL"), sheet?.principalComment);
    const published = sheet?.status === "PUBLISHED" || Boolean(sheet?.publishedAt) || card?.status === "PUBLISHED";
    const withheld = !published && Boolean(card?.withheldAt);
    const scores = result.ready && Boolean(sheet);
    const owes = Boolean(policy?.withholdForDebt && owing?.has(result.id));
    const state: CardState = published ? "Published" : withheld ? "Withheld" : !scores ? "Blocked" : fm.state !== "Submitted" ? "Remark owed" : pr.state !== "Submitted" ? "Awaiting review" : "Ready";
    return { id: result.id, name: result.name, adm: result.adm, average: result.average, grade: result.grade, pos: result.pos, scores, blockedBy: result.blockedBy, remark: fm.state, review: pr.state === "Submitted", published, withheld, owes, state, resultSheetId: sheet?.id ?? null, cardId: card?.id ?? null, revision: card?.revision ?? 1 };
  });
}

export const sumState = (cards: ChildCard[]) => ({
  roll: cards.length,
  ready: cards.filter((card) => card.state === "Ready").length,
  blocked: cards.filter((card) => card.state === "Blocked").length,
  owed: cards.filter((card) => card.state === "Remark owed").length,
  inReview: cards.filter((card) => card.state === "Awaiting review").length,
  published: cards.filter((card) => card.state === "Published").length,
  withheld: cards.filter((card) => card.state === "Withheld").length
});

export function armState(sum: ReturnType<typeof sumState>): "Published" | "Ready" | "Blocked" | "Remarks owed" | "Awaiting review" | "Withheld" {
  if (sum.roll && sum.published === sum.roll) return "Published";
  if (sum.roll && sum.ready === sum.roll) return "Ready";
  if (sum.blocked) return "Blocked";
  if (sum.owed) return "Remarks owed";
  if (sum.inReview) return "Awaiting review";
  if (sum.ready) return "Ready";
  return sum.withheld ? "Withheld" : "Blocked";
}

/** Children who owe a balance this term — only read when the school has chosen to withhold for debt. */
export async function owingStudents(schoolId: string, termId: string, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await prisma.invoice.groupBy({ by: ["studentId"], where: { schoolId, studentId: { in: ids }, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] }, balance: { gt: 0 }, OR: [{ termId }, { termId: null }] }, _sum: { balance: true } });
  return new Set(rows.filter((row) => Number(row._sum.balance ?? 0) > 0).map((row) => row.studentId));
}

export const cardReference = (adm: string, term: string) => `${adm.replace(/[^A-Za-z0-9]/g, "")}-${term.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase()}`;
