import { prisma } from "../../../../src/lib/db/prisma";
import { loadArm, studentResults, type Term } from "./arm";

/**
 * What the rest of the product reads. Portals, report cards and the student record read the result
 * sheet's own totals, so whenever a decision or a correction moves a score those totals are rewritten
 * from the approved sheets — and a class whose every sheet is approved is, at last, ready to publish.
 */
export async function syncResultSheets(schoolId: string, term: Term, classId: string, actorId: string, reason = "A sheet decision moved a score") {
  const startedAt = Date.now();
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
  // Kept so Infrastructure can say how long computation takes, and for which schools it keeps re-running over published results.
  // A result can be traced when what was just written is what the recorded component scores add up to.
  const written = await prisma.resultSheet.findMany({ where: { id: { in: sheets.map((sheet) => sheet.id) } }, select: { studentId: true, totalScore: true } });
  const traceChecked = written.length;
  const traceMatched = written.filter((row) => {
    const result = byStudent.get(row.studentId);
    return result !== undefined && Math.abs(Number(row.totalScore ?? 0) - Number(result.total ?? 0)) < 0.01;
  }).length;
  const records = arm.subjects.reduce((sum, subject) => sum + subject.rows.reduce((inner, row) => inner + Object.values(row.cells).filter((cell) => typeof cell === "number").length, 0), 0);
  await prisma.computationRun.create({ data: { schoolId, classId, termId: term.id, students: sheets.length, records, durationMs: Date.now() - startedAt, traceChecked, traceMatched, recompute: sheets.some((sheet) => sheet.status === "PUBLISHED"), reason } }).catch(() => undefined);
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
