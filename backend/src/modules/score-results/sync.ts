import { prisma } from "../../../../src/lib/db/prisma";
import { loadArm, studentResults, type Term } from "./arm";

/**
 * What the rest of the product reads. Portals, report cards and the student record read the result
 * sheet's own totals, so whenever a decision or a correction moves a score those totals are rewritten
 * from the approved sheets — and a class whose every sheet is approved is, at last, ready to publish.
 */
export async function syncResultSheets(schoolId: string, term: Term, classId: string, actorId: string) {
  const arm = await loadArm(schoolId, term, classId);
  if (!arm) return { updated: 0, ready: false };
  const results = studentResults(arm, true);
  const byStudent = new Map(results.map((result) => [result.id, result]));
  const sheets = await prisma.resultSheet.findMany({ where: { schoolId, termId: term.id, student: { currentClassId: classId } } });
  const counted = arm.subjects.filter((subject) => subject.counts);
  const everySheetApproved = counted.length > 0 && counted.every((subject) => subject.state === "Approved");
  const stamp = new Date();
  let updated = 0;
  for (const sheet of sheets) {
    const result = byStudent.get(sheet.studentId);
    if (!result) continue;
    const promote = everySheetApproved && ["DRAFT", "SUBMITTED", "UNDER_REVIEW"].includes(sheet.status);
    await prisma.resultSheet.update({
      where: { id: sheet.id },
      data: {
        totalScore: result.total, averageScore: result.average ?? 0, grade: result.grade, position: result.pos,
        ...(promote ? { status: "APPROVED" as const, approvedAt: stamp, approvedById: actorId, reviewedAt: stamp } : {})
      }
    });
    if (promote) await prisma.resultApproval.create({ data: { schoolId, resultSheetId: sheet.id, actorId, action: "APPROVE", fromStatus: sheet.status, toStatus: "APPROVED", note: "Every score sheet in the arm is approved." } });
    updated += 1;
  }
  return { updated, ready: everySheetApproved };
}

/** Taking an approval back: the arm's result sheets are no longer all approved, so they step back with it. */
export async function reopenResultSheets(schoolId: string, classId: string, termId: string, actorId: string) {
  const sheets = await prisma.resultSheet.findMany({ where: { schoolId, student: { currentClassId: classId }, termId, status: "APPROVED" } });
  for (const sheet of sheets) {
    await prisma.resultSheet.update({ where: { id: sheet.id }, data: { status: "SUBMITTED", approvedAt: null, approvedById: null } });
    await prisma.resultApproval.create({ data: { schoolId, resultSheetId: sheet.id, actorId, action: "RETURN", fromStatus: "APPROVED", toStatus: "SUBMITTED", note: "A score sheet approval was reversed." } });
  }
  return sheets.length;
}
