import { csvResponse, toCsv } from "@/lib/modules/csv";
import { loadSheet } from "@/lib/modules/live/m5-review";

/** A score sheet as a spreadsheet: every child, every component as it was entered, the total and the grade. */
export async function GET(_request: Request, { params }: { params: Promise<{ classId: string; subjectId: string }> }) {
  const { classId, subjectId } = await params;
  try {
    const sheet = await loadSheet(classId, subjectId);
    const rows = sheet.rows.slice().sort((a, b) => (b.total ?? -1) - (a.total ?? -1)).map((row) => [
      row.pos ?? "", row.name, row.adm, ...sheet.columns.map((column) => (row.cells[column.key] === null || row.cells[column.key] === undefined ? "" : String(row.cells[column.key]))), row.total ?? "", row.grade ?? "", row.rating, row.standing,
    ]);
    return csvResponse(`${sheet.subject.name}-${sheet.arm.name}.csv`.replace(/\s+/g, "-"), toCsv(["Position", "Child", "Admission number", ...sheet.columns.map((column) => `${column.name} /${column.max}`), "Total", "Grade", "Rating", "Standing"], rows));
  } catch {
    return new Response("You cannot export this sheet.", { status: 403 });
  }
}
