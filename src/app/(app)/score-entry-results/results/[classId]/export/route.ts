import { csvResponse, toCsv } from "@/lib/modules/csv";
import { loadArmResult } from "@/lib/modules/live/m5-results";

/** An arm's broadsheet as a spreadsheet: every child against every subject, with totals and positions. */
export async function GET(_request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  try {
    const arm = await loadArmResult(classId);
    const rows = arm.students.map((student) => [student.pos ?? "", student.name, student.adm, ...student.totals.map((value) => value ?? ""), student.total || "", student.average ?? "", student.grade ?? "", student.ready ? "Computed" : `Blocked — ${student.blockedBy[0] ?? ""}`]);
    return csvResponse(`broadsheet-${arm.arm.name}.csv`.replace(/\s+/g, "-"), toCsv(["Position", "Child", "Admission number", ...arm.subjects.map((subject) => subject.name), "Total", "Average", "Grade", "State"], rows));
  } catch {
    return new Response("You cannot export this broadsheet.", { status: 403 });
  }
}
